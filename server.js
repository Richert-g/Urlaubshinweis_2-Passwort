const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const env = loadEnv(path.join(root, ".env"));
const authSecret = env.AUTH_SECRET || crypto.randomBytes(32).toString("hex");
const sessions = new Set();
const smtpTimeoutMs = Number(env.SMTP_TIMEOUT_MS || 30000);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    addCors(res);
    if (req.method === "OPTIONS") return sendJson(res, 204, {});

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/login") {
      return sendLoginPage(res);
    }
    if (req.method === "POST" && url.pathname === "/login") {
      return handleLogin(req, res);
    }
    if (req.method === "POST" && url.pathname === "/logout") {
      return handleLogout(req, res);
    }
    if (!isAuthenticated(req)) {
      if (url.pathname.startsWith("/api/")) return sendJson(res, 401, { error: "Bitte zuerst anmelden." });
      return redirect(res, "/login");
    }

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        smtpConfigured: isSmtpConfigured(),
        from: env.SMTP_FROM || env.SMTP_USER || "",
      });
    }

    if (req.method === "POST" && url.pathname === "/api/send") {
      return handleSend(req, res);
    }

    if (req.method === "GET") {
      return serveStatic(url.pathname, res);
    }

    sendJson(res, 405, { error: "Methode nicht erlaubt." });
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Serverfehler." });
  }
});

server.listen(port, () => {
  console.log(`Urlaubshinweis App laeuft auf http://localhost:${port}`);
  console.log(env.APP_PASSWORD ? "Passwortschutz ist aktiv." : "Passwortschutz ist nicht eingerichtet. Bitte APP_PASSWORD in .env setzen.");
  console.log(isSmtpConfigured() ? "SMTP ist konfiguriert." : "SMTP ist noch nicht konfiguriert. Bitte .env bearbeiten.");
});

async function handleLogin(req, res) {
  const body = await readForm(req);
  const password = cleanString(body.password);
  const expected = getAppPassword();

  if (!expected) {
    return sendLoginPage(res, "Es ist noch kein APP_PASSWORD in der .env Datei gesetzt.");
  }

  if (!sameValue(password, expected)) {
    return sendLoginPage(res, "Das Passwort ist nicht korrekt.");
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.add(hashSession(token));
  res.writeHead(302, {
    "Location": "/",
    "Set-Cookie": cookieHeader("urlaub_session", token, 60 * 60 * 8),
  });
  res.end();
}

function handleLogout(req, res) {
  const token = readCookie(req, "urlaub_session");
  if (token) sessions.delete(hashSession(token));
  res.writeHead(302, {
    "Location": "/login",
    "Set-Cookie": cookieHeader("urlaub_session", "", 0),
  });
  res.end();
}

async function handleSend(req, res) {
  if (!isSmtpConfigured()) {
    return sendJson(res, 400, { error: "SMTP ist nicht konfiguriert. Bitte .env ausfuellen und Server neu starten." });
  }

  const body = await readJson(req);
  const to = cleanString(body.to);
  const subject = cleanString(body.subject);
  const text = cleanString(body.message);
  const html = cleanString(body.html);

  if (!isEmail(to)) return sendJson(res, 400, { error: emailValidationMessage(to) });
  if (!subject) return sendJson(res, 400, { error: "Betreff fehlt." });
  if (!text) return sendJson(res, 400, { error: "Nachricht fehlt." });

  const transporter = nodemailer.createTransport({
    auth: env.SMTP_USER || env.SMTP_PASS ? {
      pass: env.SMTP_PASS || "",
      user: env.SMTP_USER || "",
    } : undefined,
    connectionTimeout: smtpTimeoutMs,
    greetingTimeout: smtpTimeoutMs,
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: String(env.SMTP_SECURE || "").toLowerCase() === "true" || Number(env.SMTP_PORT) === 465,
    socketTimeout: smtpTimeoutMs,
  });

  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      html: html || undefined,
      replyTo: env.SMTP_REPLY_TO || undefined,
      subject,
      text,
      to,
    });

    sendJson(res, 200, {
      accepted: info.accepted || [],
      messageId: info.messageId || "",
      ok: true,
    });
  } catch (error) {
    sendJson(res, 502, { error: smtpErrorMessage(error) });
  }
}

function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(root, safePath));
  if (!filePath.startsWith(root)) return sendText(res, 403, "Zugriff verweigert.");

  fs.readFile(filePath, (error, data) => {
    if (error) return sendText(res, 404, "Nicht gefunden.");
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function sendLoginPage(res, error = "") {
  const errorHtml = error ? `<p class="error">${escapeHtml(error)}</p>` : "";
  const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Urlaubshinweis App - Anmeldung</title>
    <style>
      :root { color-scheme: light; --ink: #20242a; --muted: #66717f; --line: #d9e0e7; --page: #f4f7f6; --accent: #196b69; --danger: #9a2f2f; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--page); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(420px, calc(100% - 32px)); padding: 28px; border: 1px solid var(--line); border-radius: 8px; background: white; box-shadow: 0 12px 38px rgba(22, 33, 43, 0.08); }
      h1 { margin: 0 0 8px; font-size: 1.7rem; line-height: 1.1; }
      p { margin: 0 0 18px; color: var(--muted); line-height: 1.45; }
      label { display: grid; gap: 8px; font-weight: 800; }
      input { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 6px; font: inherit; }
      button { width: 100%; min-height: 44px; margin-top: 14px; border: 0; border-radius: 6px; background: var(--accent); color: white; font: inherit; font-weight: 800; cursor: pointer; }
      .error { padding: 10px 12px; border: 1px solid #e3b2b2; border-radius: 6px; background: #f8e6e6; color: var(--danger); font-weight: 700; }
    </style>
  </head>
  <body>
    <main>
      <h1>Urlaubshinweis App</h1>
      <p>Bitte melde Dich an, bevor Du Mitarbeiterdaten und E-Mail-Funktionen öffnest.</p>
      ${errorHtml}
      <form method="post" action="/login">
        <label>
          Passwort
          <input name="password" type="password" autocomplete="current-password" autofocus required />
        </label>
        <button type="submit">Anmelden</button>
      </form>
    </main>
  </body>
</html>`;
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function loadEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"(.*)"$/, "$1");
    values[key] = value;
  }
  return { ...process.env, ...values };
}

function getAppPassword() {
  return cleanString(env.APP_PASSWORD);
}

function isSmtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && (env.SMTP_FROM || env.SMTP_USER));
}

function smtpErrorMessage(error) {
  const code = error?.code ? ` (${error.code})` : "";
  const message = error?.message || "Unbekannter SMTP-Fehler.";
  if (["ETIMEDOUT", "ESOCKET", "ECONNECTION"].includes(error?.code)) {
    return `SMTP-Server antwortet nicht rechtzeitig${code}. Bitte Verbindung, Port und Firewall pruefen.`;
  }
  if (["EAUTH", "EENVELOPE", "EMESSAGE"].includes(error?.code)) {
    return `SMTP-Versand abgelehnt${code}: ${message}`;
  }
  return `SMTP-Versand fehlgeschlagen${code}: ${message}`;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Anfrage ist zu gross."));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("Ungueltiges JSON."));
      }
    });
    req.on("error", reject);
  });
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) {
        req.destroy();
        reject(new Error("Anfrage ist zu gross."));
      }
    });
    req.on("end", () => {
      const params = new URLSearchParams(raw);
      resolve(Object.fromEntries(params.entries()));
    });
    req.on("error", reject);
  });
}

function cleanString(value) {
  return String(value || "").trim();
}

function isEmail(value) {
  return emailValidationMessage(value) === "";
}

function emailValidationMessage(value) {
  const email = String(value || "").trim();
  if (!email) return "Empfaengeradresse fehlt.";
  if (/[\s\r\n]/.test(email)) return `${email}: enthaelt Leerzeichen oder Zeilenumbrueche.`;
  if (/[;,]/.test(email)) return `${email}: bitte nur eine einzelne E-Mail-Adresse eintragen.`;
  if ((email.match(/@/g) || []).length !== 1) return `${email}: muss genau ein @ enthalten.`;

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return `${email}: lokaler Teil oder Domain fehlt.`;
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    return `${email}: der Teil vor dem @ ist ungueltig.`;
  }
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return `${email}: die Domain ist ungueltig.`;
  }

  const labels = domain.split(".");
  if (labels.length < 2) return `${email}: Domain muss einen Punkt enthalten.`;
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) {
    return `${email}: Domain enthaelt ungueltige Zeichen.`;
  }
  if (!/^[a-z]{2,63}$/i.test(labels[labels.length - 1])) return `${email}: Domain-Endung ist ungueltig.`;
  if (!/^[^\s@(),:;<>[\]\\"]+$/.test(localPart)) return `${email}: der Teil vor dem @ enthaelt ungueltige Zeichen.`;

  return "";
}

function addCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  if (status === 204) return res.end();
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function isAuthenticated(req) {
  const token = readCookie(req, "urlaub_session");
  return Boolean(token && sessions.has(hashSession(token)));
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  const parts = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = parts.find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

function cookieHeader(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax; Path=/`;
}

function hashSession(token) {
  return crypto.createHmac("sha256", authSecret).update(String(token)).digest("hex");
}

function sameValue(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function redirect(res, location) {
  res.writeHead(302, { "Location": location });
  res.end();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
