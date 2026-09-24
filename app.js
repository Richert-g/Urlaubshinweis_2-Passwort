const mappingFields = [
  { key: "email", label: "E-Mail", aliases: ["email", "emailadresse", "e-mail", "mail", "dienstemail"] },
  { key: "name", label: "Name", aliases: ["name", "mitarbeiter", "mitarbeiterin", "person", "vollstandigername"] },
  { key: "emailAsp", label: "E-Mail ASP", aliases: ["emailasp", "e-mailasp", "mailasp", "aspemail", "aspmail", "emailansprechperson", "mailansprechperson"] },
  { key: "responsible", label: "Zustaendig", aliases: ["zustandig", "zustaendig", "arbeitszweigleiter", "leitung", "vorgesetzte", "vorgesetzter", "manager"] },
  { key: "entitlement", label: "Anspruch dieses Jahr", aliases: ["anspruchdiesesjahr", "anspruch", "urlaubsanspruch", "jahresurlaub", "urlaubstage"] },
  { key: "previousRemaining", label: "Rest Vorjahr", aliases: ["restvorjahr", "restausvorjahr", "vorjahresurlaub", "urlaubvorjahr", "uebertrag", "ubertrag"] },
  { key: "taken", label: "Genommen", aliases: ["genommen", "genommenerurlaub", "verbrauchterurlaub", "urlaubgenommene tage", "urlaubstagegenommen"] },
  { key: "remaining", label: "Offen / Resturlaub aus Excel", aliases: ["offen", "resturlaub", "offenerurlaub", "verbleibend", "ubrig", "saldo"] },
  { key: "vacationTaken", label: "Urlaub genommen", aliases: ["urlaubgenommen", "urlaubgenutzt", "urlaubbereitsgenommen"] },
];

const state = {
  corrections: loadCorrections(),
  employees: [],
  expandedActions: new Set(),
  filter: "open",
  fileName: "",
  headers: [],
  log: loadLog(),
  mapping: {},
  rawRows: [],
  smtpAvailable: false,
  validation: [],
};

const selectors = {
  applyMappingButton: document.querySelector("#applyMappingButton"),
  aspTemplateInput: document.querySelector("#aspTemplateInput"),
  clearLogButton: document.querySelector("#clearLogButton"),
  configBackButton: document.querySelector("#configBackButton"),
  configPanel: document.querySelector("#configPanel"),
  configToggleButton: document.querySelector("#configToggleButton"),
  deleteAllButton: document.querySelector("#deleteAllButton"),
  deadlineInput: document.querySelector("#deadlineInput"),
  dropZone: document.querySelector("#dropZone"),
  employeeTable: document.querySelector("#employeeTable"),
  exportLogButton: document.querySelector("#exportLogButton"),
  exportMailListButton: document.querySelector("#exportMailListButton"),
  fileInput: document.querySelector("#fileInput"),
  loggedCount: document.querySelector("#loggedCount"),
  mappingGrid: document.querySelector("#mappingGrid"),
  mappingPanel: document.querySelector("#mappingPanel"),
  openCount: document.querySelector("#openCount"),
  resetTemplateButton: document.querySelector("#resetTemplateButton"),
  remindAllButton: document.querySelector("#remindAllButton"),
  roundingInput: document.querySelector("#roundingInput"),
  sendAllButton: document.querySelector("#sendAllButton"),
  sendAspButton: document.querySelector("#sendAspButton"),
  senderInput: document.querySelector("#senderInput"),
  smtpStatus: document.querySelector("#smtpStatus"),
  templateInput: document.querySelector("#templateInput"),
  templateVersionInput: document.querySelector("#templateVersionInput"),
  thresholdInput: document.querySelector("#thresholdInput"),
  totalCount: document.querySelector("#totalCount"),
  validationList: document.querySelector("#validationList"),
  validationSummary: document.querySelector("#validationSummary"),
};

const defaultTemplate = `Liebe/r {{name}},

dies ist eine automatisch generierte eMail. Wir möchten Dich informieren, daß Du noch folgende Urlaubsansprüche besitzt:

- Anspruch aus Vorjahr: {{previousRemaining}}
- Anspruch lfd. Jahr: {{entitlement}}
- Resturlaub: {{remaining}}
- Ansprechperson: {{manager}}

Solltest Du noch einen Urlaubsanspruch aus dem Vorjahr besitzen, kläre bitte schnellstmöglich, wann dieser genommen werden kann.

Herzlichen Dank für Deine Unterstützung! Deine SMD-KI.
---------------------------------
Urlaubregel (Stand 2025)
Der Urlaub jeden Jahres ist bis zum 31.12. zu planen und zu nehmen. In Rücksprache mit Eurem Arbeitszweigleiter kann dieser auch bis zum 31.03. der Folgejahres genommen werden - dies hat schriftlich mit Begründung zu erfolgen. Sollte auch dies in sehr besonderen Fällen nicht möglich sein, kann durch die Vorstandsgenehmigung im Jahr 2025 der Urlaub bis zum 30.06. des Folge-jahres genommen werden. Die gewährten schriftlichen Verlängerungen sind der Personalabteilung zu übermitteln.`;

const defaultAspTemplate = `Liebe/r {{responsible}},

dies ist eine automatisch generierte eMail. Wir möchten Dich informieren, daß Deine Mitarbeiter noch folgende Urlaubsansprüche besitzen:

{{employeeList}}

Die oben aufgeführten Mitarbeiter wurden über ihren Urlaubsanspruch informiert und gebeten, mit Dir Rücksprache zu nehmen, um ihren Vorjahrsanspruch schnellstmöglich zu nehmen und den Urlaub dieses Jahres mit Dir zu planen.

Herzlichen Dank für Deine Unterstützung! Deine SMD-KI.
---------------------------------
Urlaubregel (Stand 2025)
Der Urlaub jeden Jahres ist bis zum 31.12. zu planen und zu nehmen. In Rücksprache mit Eurem Arbeitszweigleiter kann dieser auch bis zum 31.03. der Folgejahres genommen werden - dies hat schriftlich mit Begründung zu erfolgen. Sollte auch dies in sehr besonderen Fällen nicht möglich sein, kann durch die Vorstandsgenehmigung im Jahr 2025 der Urlaub bis zum 30.06. des Folge-jahres genommen werden. Die gewährten schriftlichen Verlängerungen sind der Personalabteilung zu übermitteln.`;

const smtpRequestTimeoutMs = 45000;

init();

function init() {
  const currentYear = new Date().getFullYear();
  selectors.deadlineInput.value = `${currentYear}-12-31`;
  selectors.templateInput.value = localStorage.getItem("vacationNoticeTemplate") || defaultTemplate;
  selectors.aspTemplateInput.value = localStorage.getItem("vacationNoticeAspTemplate") || defaultAspTemplate;
  selectors.templateVersionInput.value = localStorage.getItem("vacationNoticeTemplateVersion") || "Urlaubshinweis 2026-01";
  selectors.senderInput.value = localStorage.getItem("vacationNoticeSender") || "";
  restoreAppState();

  selectors.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) readWorkbook(file);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    selectors.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      selectors.dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    selectors.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      selectors.dropZone.classList.remove("drag-over");
    });
  });

  selectors.dropZone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (file) readWorkbook(file);
  });

  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      setActiveFilterButton();
      saveAppState();
      render();
    });
  });

  selectors.applyMappingButton.addEventListener("click", () => {
    readMappingFromControls();
    rebuildEmployees();
  });
  selectors.configToggleButton.addEventListener("click", () => {
    selectors.configPanel.classList.toggle("hidden");
  });
  selectors.configBackButton.addEventListener("click", () => {
    selectors.configPanel.classList.add("hidden");
  });
  selectors.deleteAllButton.addEventListener("click", deleteEverything);

  selectors.templateInput.addEventListener("input", () => {
    localStorage.setItem("vacationNoticeTemplate", selectors.templateInput.value);
  });
  selectors.aspTemplateInput.addEventListener("input", () => {
    localStorage.setItem("vacationNoticeAspTemplate", selectors.aspTemplateInput.value);
  });
  selectors.templateVersionInput.addEventListener("input", () => {
    localStorage.setItem("vacationNoticeTemplateVersion", selectors.templateVersionInput.value);
  });
  selectors.senderInput.addEventListener("input", () => {
    localStorage.setItem("vacationNoticeSender", selectors.senderInput.value);
    saveAppState();
    render();
  });
  selectors.deadlineInput.addEventListener("input", () => {
    saveAppState();
    render();
  });
  selectors.thresholdInput.addEventListener("input", () => {
    saveAppState();
    render();
  });
  selectors.roundingInput.addEventListener("input", () => {
    saveAppState();
    rebuildEmployees();
  });

  selectors.resetTemplateButton.addEventListener("click", () => {
    selectors.templateInput.value = defaultTemplate;
    selectors.aspTemplateInput.value = defaultAspTemplate;
    selectors.templateVersionInput.value = "Urlaubshinweis 2026-01";
    localStorage.setItem("vacationNoticeTemplate", defaultTemplate);
    localStorage.setItem("vacationNoticeAspTemplate", defaultAspTemplate);
    localStorage.setItem("vacationNoticeTemplateVersion", selectors.templateVersionInput.value);
  });

  selectors.exportLogButton.addEventListener("click", exportLog);
  selectors.exportMailListButton.addEventListener("click", exportMailList);
  selectors.sendAllButton.addEventListener("click", sendAllEmails);
  selectors.remindAllButton.addEventListener("click", sendAllReminderEmails);
  selectors.sendAspButton.addEventListener("click", sendAspSummaries);
  selectors.clearLogButton.addEventListener("click", () => {
    if (!confirm("Sollen lokales Versandprotokoll und Urlaubskorrekturen wirklich geloescht werden?")) return;
    state.corrections = {};
    state.log = {};
    saveCorrections();
    saveLog();
    rebuildEmployees();
  });

  checkSmtpHealth();
  render();
}

function deleteEverything() {
  const firstConfirm = confirm("ACHTUNG: Dadurch werden alle lokalen Daten geloescht: Protokoll, Korrekturen, geladene Tabelle und gespeicherte E-Mail-Texte. Fortfahren?");
  if (!firstConfirm) return;
  const secondConfirm = confirm("Letzte Warnung: Dieser Schritt kann nicht rueckgaengig gemacht werden. Wirklich ALLES loeschen?");
  if (!secondConfirm) return;

  [
    "vacationNoticeAspTemplate",
    "vacationNoticeCorrections",
    "vacationNoticeLog",
    "vacationNoticeSender",
    "vacationNoticeState",
    "vacationNoticeTemplate",
    "vacationNoticeTemplateVersion",
  ].forEach((key) => localStorage.removeItem(key));

  state.corrections = {};
  state.employees = [];
  state.expandedActions.clear();
  state.fileName = "";
  state.headers = [];
  state.log = {};
  state.mapping = {};
  state.rawRows = [];
  state.validation = [];

  selectors.fileInput.value = "";
  selectors.senderInput.value = "";
  selectors.thresholdInput.value = "0";
  selectors.roundingInput.value = "1";
  selectors.deadlineInput.value = `${new Date().getFullYear()}-12-31`;
  selectors.templateInput.value = defaultTemplate;
  selectors.aspTemplateInput.value = defaultAspTemplate;
  selectors.templateVersionInput.value = "Urlaubshinweis 2026-01";
  selectors.mappingPanel.classList.add("hidden");
  selectors.mappingGrid.innerHTML = "";
  render();
}

function restoreAppState() {
  const saved = loadAppState();
  if (!saved) return;

  state.fileName = saved.fileName || "";
  state.filter = saved.filter || "open";
  state.headers = Array.isArray(saved.headers) ? saved.headers : [];
  state.mapping = saved.mapping && typeof saved.mapping === "object" ? saved.mapping : {};
  state.rawRows = Array.isArray(saved.rawRows) ? saved.rawRows : [];

  if (saved.deadline) selectors.deadlineInput.value = saved.deadline;
  if (saved.threshold !== undefined) selectors.thresholdInput.value = saved.threshold;
  if (saved.sender !== undefined) selectors.senderInput.value = saved.sender;
  if (saved.roundingDecimals !== undefined) selectors.roundingInput.value = saved.roundingDecimals;

  renderMappingPanel();
  state.employees = normalizeRows(state.rawRows).map(applyStoredCorrection).filter((employee) => !employee.deleted);
  state.validation = validateEmployees(state.employees);
  setActiveFilterButton();
}

function loadAppState() {
  try {
    return JSON.parse(localStorage.getItem("vacationNoticeState") || "null");
  } catch {
    return null;
  }
}

function saveAppState() {
  const data = {
    deadline: selectors.deadlineInput.value,
    fileName: state.fileName,
    filter: state.filter,
    headers: state.headers,
    mapping: state.mapping,
    rawRows: state.rawRows,
    roundingDecimals: selectors.roundingInput.value,
    sender: selectors.senderInput.value,
    threshold: selectors.thresholdInput.value,
  };
  localStorage.setItem("vacationNoticeState", JSON.stringify(data));
}

function setActiveFilterButton() {
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function readWorkbook(file) {
  if (!window.XLSX) {
    alert("Die Excel-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung pruefen und neu laden.");
    return;
  }

  if (file.name.toLowerCase().endsWith(".csv")) {
    readCsvFile(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const workbook = XLSX.read(new Uint8Array(event.target.result), { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
    state.fileName = file.name;
    state.expandedActions.clear();
    state.rawRows = rows;
    state.headers = collectHeaders(rows);
    state.mapping = autoBuildMapping(state.headers);
    renderMappingPanel();
    rebuildEmployees();
  };
  reader.readAsArrayBuffer(file);
}

function readCsvFile(file) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const rows = parseCsvText(String(event.target.result || ""));
    state.fileName = file.name;
    state.expandedActions.clear();
    state.rawRows = rows;
    state.headers = collectHeaders(rows);
    state.mapping = autoBuildMapping(state.headers);
    renderMappingPanel();
    rebuildEmployees();
  };
  reader.readAsText(file, "utf-8");
}

function parseCsvText(text) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = detectDelimiter(normalized);
  const rows = parseDelimitedRows(normalized, delimiter).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

function detectDelimiter(text) {
  const firstLine = text.split("\n").find((line) => line.trim()) || "";
  const semicolons = (firstLine.match(/;/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  if (tabs > semicolons && tabs > commas) return "\t";
  if (semicolons >= commas) return ";";
  return ",";
}

function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function collectHeaders(rows) {
  const headers = new Set();
  rows.forEach((row) => Object.keys(row).forEach((key) => headers.add(key)));
  return Array.from(headers);
}

function autoBuildMapping(headers) {
  const normalizedHeaders = headers.map((header) => ({ header, key: normalizeKey(header) }));
  return Object.fromEntries(
    mappingFields.map((field) => {
      const match = normalizedHeaders.find((item) => field.aliases.includes(item.key));
      return [field.key, match ? match.header : ""];
    }),
  );
}

function renderMappingPanel() {
  if (!state.headers.length) {
    selectors.mappingPanel.classList.add("hidden");
    selectors.mappingGrid.innerHTML = "";
    return;
  }

  selectors.mappingPanel.classList.remove("hidden");
  selectors.mappingGrid.innerHTML = mappingFields
    .map((field) => {
      const options = [
        `<option value="">Nicht verwenden</option>`,
        ...state.headers.map((header) => {
          const selected = state.mapping[field.key] === header ? "selected" : "";
          return `<option value="${escapeHtml(header)}" ${selected}>${escapeHtml(header)}</option>`;
        }),
      ].join("");
      return `<label>
        <span>${escapeHtml(field.label)}</span>
        <select data-map-field="${field.key}">${options}</select>
      </label>`;
    })
    .join("");
}

function readMappingFromControls() {
  selectors.mappingGrid.querySelectorAll("[data-map-field]").forEach((select) => {
    state.mapping[select.dataset.mapField] = select.value;
  });
  saveAppState();
}

function rebuildEmployees() {
  state.employees = normalizeRows(state.rawRows).map(applyStoredCorrection).filter((employee) => !employee.deleted);
  state.validation = validateEmployees(state.employees);
  saveAppState();
  render();
}

function normalizeRows(rows) {
  return rows
    .map((row, index) => {
      const normalized = {};
      Object.entries(row).forEach(([key, value]) => {
        normalized[normalizeKey(key)] = value;
      });

      if (isEmptyImportRow(row, normalized)) return null;

      const name = readField(row, normalized, "name");
      const email = readField(row, normalized, "email");
      const emailAsp = readField(row, normalized, "emailAsp");
      const responsible = readField(row, normalized, "responsible");
      const entitlement = roundVacationNumber(toNumber(readField(row, normalized, "entitlement")));
      const previousRemaining = roundVacationNumber(toNumber(readField(row, normalized, "previousRemaining")));
      const taken = roundVacationNumber(toNumber(readField(row, normalized, "taken")));
      const vacationTakenFlag = toBoolean(readField(row, normalized, "vacationTaken"));
      const remainingFromFile = roundVacationNumber(toNumber(readField(row, normalized, "remaining")));
      const remaining = remainingFromFile;

      return {
        id: stableEmployeeId(email, name, index),
        rowNumber: index + 2,
        name: String(name || "").trim(),
        email: String(email || "").trim(),
        emailAsp: String(emailAsp || "").trim(),
        entitlement,
        previousRemaining,
        taken,
        remaining,
        noVacationTaken: vacationTakenFlag === false || taken === 0,
        department: String(responsible || "").trim(),
        manager: String(responsible || "").trim(),
        responsible: String(responsible || "").trim(),
        raw: row,
      };
    })
    .filter(Boolean)
    .filter((employee) => employee.name || employee.email || hasUsefulRawData(employee.raw));
}

function readField(row, normalized, fieldKey) {
  const mappedHeader = state.mapping[fieldKey];
  if (mappedHeader && row[mappedHeader] !== undefined) return row[mappedHeader];
  const field = mappingFields.find((item) => item.key === fieldKey);
  return field ? pick(normalized, field.aliases) : "";
}

function normalizeKey(key) {
  return String(key)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9-]/g, "");
}

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
}

function hasUsefulRawData(row) {
  return Object.values(row).some((value) => String(value || "").trim() !== "");
}

function isEmptyImportRow(row, normalized) {
  const identityFields = ["name", "email", "emailAsp", "responsible"];
  const vacationFields = ["entitlement", "previousRemaining", "taken", "remaining"];
  const hasIdentity = identityFields.some((field) => String(readField(row, normalized, field) || "").trim() !== "");
  if (hasIdentity) return false;

  return vacationFields.every((field) => isEmptyOrZero(readField(row, normalized, field)));
}

function isEmptyOrZero(value) {
  if (value === "" || value === null || value === undefined) return true;
  const text = String(value).trim();
  if (!text) return true;
  const number = toNumber(value);
  return Number.isFinite(number) && number === 0;
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return Number.NaN;
  if (typeof value === "number") return value;
  const match = String(value).trim().match(/-?[\d.,]+/);
  if (!match) return Number.NaN;

  let normalized = match[0];
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : Number.NaN;
}

function roundVacationNumber(value) {
  if (!Number.isFinite(value)) return Number.NaN;
  const factor = 10 ** getRoundingDecimals();
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function getRoundingDecimals() {
  const decimals = Number(selectors.roundingInput?.value ?? 1);
  if (!Number.isFinite(decimals)) return 1;
  return Math.min(Math.max(Math.trunc(decimals), 0), 3);
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  if (["ja", "yes", "true", "wahr", "1"].includes(text)) return true;
  if (["nein", "no", "false", "falsch", "0"].includes(text)) return false;
  return undefined;
}

function validateEmployees(employees) {
  const issues = [];
  const seenEmails = new Map();

  employees.forEach((employee) => {
    if (!employee.name) {
      issues.push(issue("error", employee, "Name fehlt", "Ohne Name ist der Nachweis schwer zuzuordnen."));
    }
    if (!employee.email) {
      issues.push(issue("error", employee, "E-Mail fehlt", "Fuer diese Person kann keine Nachricht vorbereitet werden."));
    } else if (!isEmail(employee.email)) {
      issues.push(issue("error", employee, "E-Mail ist ungueltig", emailValidationMessage(employee.email)));
    }
    if (employee.email) {
      const lowerEmail = employee.email.toLowerCase();
      if (seenEmails.has(lowerEmail)) {
        issues.push(issue("warn", employee, "E-Mail doppelt vorhanden", `Auch in Zeile ${seenEmails.get(lowerEmail)}.`));
      } else {
        seenEmails.set(lowerEmail, employee.rowNumber);
      }
    }
    if (!Number.isFinite(employee.remaining) && !employee.noVacationTaken) {
      issues.push(issue("warn", employee, "Offen nicht ermittelbar", "Spalte Offen pruefen. Dieser Wert wird aus der Datei uebernommen und nicht berechnet."));
    }
    if (Number.isFinite(employee.remaining) && employee.remaining < 0) {
      issues.push(issue("warn", employee, "Negativer Resturlaub", "Bitte Ausgangsdaten pruefen."));
    }
    if (needsNotice(employee) && !employee.emailAsp) {
      issues.push(issue("warn", employee, "E-Mail ASP fehlt", "Diese Person erscheint in keiner ASP-Zusammenfassung."));
    } else if (needsNotice(employee) && employee.emailAsp && !isEmail(employee.emailAsp)) {
      issues.push(issue("warn", employee, "E-Mail ASP ist ungueltig", emailValidationMessage(employee.emailAsp)));
    }
  });

  return issues;
}

function isDocumented(employee) {
  return Boolean(state.log[employee.id] || employee.correction);
}

function deliveryCountLabel(logEntry) {
  const count = Array.isArray(logEntry?.deliveries) ? logEntry.deliveries.length : 1;
  return count > 1 ? ` (${count}x)` : "";
}

function issue(level, employee, title, detail) {
  return {
    detail,
    employeeId: employee.id,
    level,
    rowNumber: employee.rowNumber,
    title,
  };
}

function render() {
  const openEmployees = state.employees.filter(needsNotice);
  const loggedEmployees = state.employees.filter(isDocumented);
  const visible = state.employees.filter((employee) => {
    if (state.filter === "all") return true;
    if (state.filter === "logged") return isDocumented(employee);
    return needsNotice(employee) && !state.log[employee.id];
  });

  selectors.totalCount.textContent = String(state.employees.length);
  selectors.openCount.textContent = String(openEmployees.length);
  selectors.loggedCount.textContent = String(loggedEmployees.length);
  renderValidation();

  if (!state.employees.length) {
    selectors.employeeTable.innerHTML = `<tr class="empty-row"><td colspan="9">Noch keine Datei geladen.</td></tr>`;
    return;
  }

  if (!visible.length) {
    selectors.employeeTable.innerHTML = `<tr class="empty-row"><td colspan="9">Keine passenden Eintraege fuer diesen Filter.</td></tr>`;
    return;
  }

  selectors.employeeTable.innerHTML = visible.map(renderRow).join("");
  selectors.employeeTable.querySelectorAll("[data-toggle-actions]").forEach((button) => {
    button.addEventListener("click", () => toggleActions(button.dataset.toggleActions));
  });
  selectors.employeeTable.querySelectorAll("[data-mark]").forEach((button) => {
    button.addEventListener("click", () => markAsSent(button.dataset.mark));
  });
  selectors.employeeTable.querySelectorAll("[data-send]").forEach((button) => {
    button.addEventListener("click", () => sendEmail(button.dataset.send, button));
  });
  selectors.employeeTable.querySelectorAll("[data-remind]").forEach((button) => {
    button.addEventListener("click", () => sendReminderEmail(button.dataset.remind, button));
  });
  selectors.employeeTable.querySelectorAll("[data-correct]").forEach((button) => {
    button.addEventListener("click", () => correctVacation(button.dataset.correct));
  });
  selectors.employeeTable.querySelectorAll("[data-take-all]").forEach((button) => {
    button.addEventListener("click", () => markVacationFullyTaken(button.dataset.takeAll));
  });
  selectors.employeeTable.querySelectorAll("[data-set-rest]").forEach((button) => {
    button.addEventListener("click", () => setRemainingVacation(button.dataset.setRest));
  });
  selectors.employeeTable.querySelectorAll("[data-set-entitlement]").forEach((button) => {
    button.addEventListener("click", () => setVacationEntitlement(button.dataset.setEntitlement));
  });
  selectors.employeeTable.querySelectorAll("[data-set-email]").forEach((button) => {
    button.addEventListener("click", () => setEmployeeEmail(button.dataset.setEmail));
  });
  selectors.employeeTable.querySelectorAll("[data-delete-row]").forEach((button) => {
    button.addEventListener("click", () => deleteEmployeeRow(button.dataset.deleteRow));
  });
}

function renderValidation() {
  if (!state.rawRows.length) {
    selectors.validationSummary.textContent = "Keine Datei geladen.";
    selectors.validationList.innerHTML = "";
    return;
  }

  const errors = state.validation.filter((item) => item.level === "error").length;
  const warnings = state.validation.filter((item) => item.level === "warn").length;
  selectors.validationSummary.textContent = `${errors} Fehler, ${warnings} Hinweise`;

  if (!state.validation.length) {
    selectors.validationList.innerHTML = `<div class="validation-item ok"><div><strong>Import sieht gut aus</strong><span>Alle benoetigten Kerndaten wurden erkannt.</span></div></div>`;
    return;
  }

  selectors.validationList.innerHTML = state.validation
    .slice(0, 8)
    .map((item) => `<div class="validation-item ${item.level === "error" ? "error" : ""}">
      <div>
        <strong>Zeile ${item.rowNumber}: ${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </div>
    </div>`)
    .join("");
}

function renderRow(employee) {
  const logEntry = state.log[employee.id];
  const hasOpenVacation = needsNotice(employee);
  const actionsExpanded = state.expandedActions.has(employee.id);
  const blockingIssue = state.validation.find((item) => item.employeeId === employee.id && item.level === "error");
  const statusClass = logEntry ? "done" : blockingIssue ? "error" : hasOpenVacation ? "open" : "done";
  const statusText = logEntry
    ? `Gesendet ${formatDateTime(logEntry.sentAt)}${deliveryCountLabel(logEntry)}`
    : employee.correction
      ? `Korrigiert ${formatDateTime(employee.correction.correctedAt)}`
    : blockingIssue
      ? blockingIssue.title
      : hasOpenVacation
        ? "Hinweis noetig"
        : "Kein Resturlaub";
  const mailTo = buildMailTo(employee);

  return `<tr>
    <td>${escapeHtml(employee.email || "-")}</td>
    <td>${escapeHtml(employee.name || "Zeile " + employee.rowNumber)}</td>
    <td>${escapeHtml(employee.responsible || "-")}</td>
    <td>${formatNumber(employee.entitlement)}</td>
    <td>${formatNumber(employee.previousRemaining)}</td>
    <td>${formatNumber(employee.taken)}</td>
    <td><strong>${formatRemaining(employee)}</strong></td>
    <td><span class="pill ${statusClass}">${escapeHtml(statusText)}</span></td>
    <td>
      <div class="action-cell">
        <button class="mark-button" type="button" data-toggle-actions="${escapeHtml(employee.id)}">${actionsExpanded ? "Schliessen" : "Korrektur"}</button>
        <div class="action-details ${actionsExpanded ? "" : "is-hidden"}">
          ${isEmail(employee.email) && hasOpenVacation && !logEntry ? `<button class="send-button" type="button" data-send="${escapeHtml(employee.id)}">Direkt senden</button>` : ""}
          ${isEmail(employee.email) && hasOpenVacation && logEntry ? `<button class="send-button" type="button" data-remind="${escapeHtml(employee.id)}">Erinnerung senden</button>` : ""}
          ${isEmail(employee.email) && hasOpenVacation ? `<a class="action-link" href="${mailTo}">E-Mail oeffnen</a>` : ""}
          ${isEmail(employee.email) && hasOpenVacation && !logEntry ? `<button class="mark-button" type="button" data-mark="${escapeHtml(employee.id)}">Als gesendet dokumentieren</button>` : ""}
          ${renderCorrectionControl(employee)}
        </div>
      </div>
    </td>
  </tr>`;
}

function toggleActions(id) {
  if (state.expandedActions.has(id)) {
    state.expandedActions.delete(id);
  } else {
    state.expandedActions.add(id);
  }

  render();
}

function renderCorrectionControl(employee) {
  const defaultAmount = Number.isFinite(employee.remaining) ? employee.remaining : "";
  const defaultEntitlement = Number.isFinite(employee.entitlement) ? employee.entitlement : "";
  return `<div class="correction-control">
    <label>
      <span>E-Mail korrigieren</span>
      <input data-email-input="${escapeHtml(employee.id)}" type="email" value="${escapeHtml(employee.email)}" />
    </label>
    <button class="mark-button" type="button" data-set-email="${escapeHtml(employee.id)}">E-Mail setzen</button>
    <label>
      <span>Nachtraeglich genommen</span>
      <input data-correction-input="${escapeHtml(employee.id)}" type="number" min="0" step="0.5" value="${escapeHtml(defaultAmount)}" />
    </label>
    <button class="mark-button" type="button" data-correct="${escapeHtml(employee.id)}">Buchen</button>
    <button class="mark-button" type="button" data-take-all="${escapeHtml(employee.id)}">Alles genommen</button>
    <label>
      <span>Offen korrigieren</span>
      <input data-rest-input="${escapeHtml(employee.id)}" type="number" min="0" step="0.5" value="${escapeHtml(defaultAmount)}" />
    </label>
    <button class="mark-button" type="button" data-set-rest="${escapeHtml(employee.id)}">Offen setzen</button>
    <label>
      <span>Anspruch dieses Jahr</span>
      <input data-entitlement-input="${escapeHtml(employee.id)}" type="number" min="0" step="0.5" value="${escapeHtml(defaultEntitlement)}" />
    </label>
    <button class="mark-button" type="button" data-set-entitlement="${escapeHtml(employee.id)}">Anspruch setzen</button>
    <button class="danger-button" type="button" data-delete-row="${escapeHtml(employee.id)}">Zeile loeschen</button>
  </div>`;
}

function buildMailTo(employee) {
  return `mailto:${encodeURIComponent(employee.email)}?subject=${encodeURIComponent(buildSubject())}&body=${encodeURIComponent(buildMessage(employee))}`;
}

function buildSubject() {
  return `Hinweis zu offenem Urlaub bis ${formatDate(selectors.deadlineInput.value)}`;
}

function buildMessage(employee) {
  const sender = selectors.senderInput.value.trim() || "Ihre Leitung";
  return selectors.templateInput.value
    .replaceAll("{{name}}", employee.name || "Guten Tag")
    .replaceAll("{{remaining}}", formatRemaining(employee))
    .replaceAll("{{offen}}", formatRemaining(employee))
    .replaceAll("{{entitlement}}", formatNumber(employee.entitlement))
    .replaceAll("{{previousRemaining}}", formatNumber(employee.previousRemaining))
    .replaceAll("{{taken}}", formatNumber(employee.taken))
    .replaceAll("{{email}}", employee.email)
    .replaceAll("{{emailAsp}}", employee.emailAsp)
    .replaceAll("{{deadline}}", formatDate(selectors.deadlineInput.value))
    .replaceAll("{{sender}}", sender)
    .replaceAll("{{company}}", "")
    .replaceAll("{{department}}", employee.department)
    .replaceAll("{{manager}}", employee.manager)
    .replaceAll("{{responsible}}", employee.responsible || "deiner zustaendigen Person");
}

function buildAspGroups() {
  const groups = new Map();
  state.employees
    .filter((employee) => needsNotice(employee) && isEmail(employee.emailAsp))
    .forEach((employee) => {
      const key = employee.emailAsp.toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, {
          emailAsp: employee.emailAsp,
          employees: [],
          responsibleNames: new Set(),
        });
      }
      const group = groups.get(key);
      group.employees.push(employee);
      if (employee.responsible) group.responsibleNames.add(employee.responsible);
    });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    responsible: Array.from(group.responsibleNames).join(", ") || "Ansprechperson",
  }));
}

function buildAspSubject(group) {
  return `Offene Urlaubsansprueche Deiner Mitarbeitenden (${group.employees.length})`;
}

function buildAspMessage(group) {
  const employeeList = buildAspEmployeeTable(group.employees);

  return selectors.aspTemplateInput.value
    .replaceAll("{{responsible}}", group.responsible)
    .replaceAll("{{Zuständig}}", group.responsible)
    .replaceAll("{{Zustaendig}}", group.responsible)
    .replaceAll("{{employeeList}}", employeeList)
    .replaceAll("{{employeeTable}}", employeeList)
    .replaceAll("{{sender}}", selectors.senderInput.value.trim() || "SMD-KI")
    .replaceAll("{{company}}", "");
}

function buildAspHtmlMessage(group) {
  const employeeTable = buildAspHtmlTable(group.employees);
  const content = textToHtml(selectors.aspTemplateInput.value)
    .replaceAll("{{responsible}}", escapeHtml(group.responsible))
    .replaceAll("{{ZustÃ¤ndig}}", escapeHtml(group.responsible))
    .replaceAll("{{Zustaendig}}", escapeHtml(group.responsible))
    .replaceAll("{{employeeList}}", employeeTable)
    .replaceAll("{{employeeTable}}", employeeTable)
    .replaceAll("{{sender}}", escapeHtml(selectors.senderInput.value.trim() || "SMD-KI"))
    .replaceAll("{{company}}", "");

  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; color: #20242a; line-height: 1.45; }
      table { border-collapse: collapse; width: 100%; max-width: 760px; margin: 16px 0; }
      th, td { border: 1px solid #d9e0e7; padding: 8px 10px; text-align: left; }
      th { background: #eef4f3; font-weight: 700; }
      .number { text-align: right; white-space: nowrap; }
    </style>
  </head>
  <body>${content}</body>
</html>`;
}

function buildAspHtmlTable(employees) {
  const rows = employees.map((employee) => {
    return `<tr>
      <td>${escapeHtml(employee.name || "-")}</td>
      <td class="number">${escapeHtml(formatNumber(employee.previousRemaining))}</td>
      <td class="number">${escapeHtml(formatNumber(employee.entitlement))}</td>
      <td class="number">${escapeHtml(formatNumber(employee.taken))}</td>
      <td class="number">${escapeHtml(formatRemaining(employee))}</td>
    </tr>`;
  }).join("");

  return `<table>
      <thead>
        <tr>
          <th>Person</th>
          <th>Anspruch aus Vorjahr</th>
          <th>Anspruch lfd. Jahr</th>
          <th>Genommen</th>
          <th>Offen</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function textToHtml(value) {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function buildAspEmployeeTable(employees) {
  const rows = employees.map((employee) => ({
    current: formatNumber(employee.entitlement),
    name: employee.name || "-",
    open: formatRemaining(employee),
    previous: formatNumber(employee.previousRemaining),
    taken: formatNumber(employee.taken),
  }));
  const nameWidth = Math.min(
    Math.max("Person".length, ...rows.map((row) => row.name.length)),
    34,
  );
  const columns = [
    { key: "name", label: "Person", width: nameWidth, align: "left" },
    { key: "previous", label: "Vorjahr", width: 10, align: "right" },
    { key: "current", label: "Lfd. Jahr", width: 10, align: "right" },
    { key: "taken", label: "Genommen", width: 10, align: "right" },
    { key: "open", label: "Offen", width: 8, align: "right" },
  ];
  const header = columns.map((column) => padCell(column.label, column.width, column.align)).join("  ");
  const divider = columns.map((column) => "-".repeat(column.width)).join("  ");
  const body = rows.map((row) => {
    return columns.map((column) => {
      const value = column.key === "name" ? truncateCell(row[column.key], column.width) : row[column.key];
      return padCell(value, column.width, column.align);
    }).join("  ");
  });
  return [header, divider, ...body].join("\n");
}

function padCell(value, width, align = "left") {
  const text = truncateCell(String(value ?? ""), width);
  return align === "right" ? text.padStart(width, " ") : text.padEnd(width, " ");
}

function truncateCell(value, width) {
  const text = String(value ?? "");
  if (text.length <= width) return text;
  return `${text.slice(0, Math.max(0, width - 1))}.`;
}

async function sendEmail(id, button) {
  const employee = state.employees.find((item) => item.id === id);
  if (!employee) return;
  if (!isEmail(employee.email)) {
    alert(`Diese Person hat keine gueltige E-Mail-Adresse:\n${emailValidationMessage(employee.email)}`);
    return;
  }

  const previousText = button.textContent;
  button.disabled = true;
  button.textContent = "Sende...";

  try {
    const result = await sendEmployeeBySmtp(employee);
    markAsSent(id, "smtp", result);
  } catch (error) {
    alert(`E-Mail konnte nicht gesendet werden: ${error.message}`);
    button.disabled = false;
    button.textContent = previousText;
  }
}

async function sendReminderEmail(id, button) {
  const employee = state.employees.find((item) => item.id === id);
  if (!employee) return;
  if (!isEmail(employee.email)) {
    alert(`Diese Person hat keine gueltige E-Mail-Adresse:\n${emailValidationMessage(employee.email)}`);
    return;
  }

  if (!confirm(`Soll die Erinnerung erneut an ${employee.email} gesendet werden?`)) return;

  const previousText = button.textContent;
  button.disabled = true;
  button.textContent = "Sende...";

  try {
    const result = await sendEmployeeBySmtp(employee);
    markAsSent(id, "smtp-reminder", result);
    alert("Erinnerung wurde gesendet und im Protokoll ergaenzt.");
  } catch (error) {
    alert(`Erinnerung konnte nicht gesendet werden: ${error.message}`);
    button.disabled = false;
    button.textContent = previousText;
  }
}

async function sendAllEmails() {
  const openNotLogged = state.employees.filter((employee) => needsNotice(employee) && !state.log[employee.id]);
  const invalidEmployees = openNotLogged.filter((employee) => !isEmail(employee.email));
  const employeesToSend = openNotLogged.filter((employee) => isEmail(employee.email));

  if (!employeesToSend.length) {
    const invalidText = invalidEmployees.length
      ? `\n\nUngueltige Adressen:\n${invalidEmployees.map((employee) => `${employee.name || "Ohne Name"}: ${emailValidationMessage(employee.email)}`).join("\n")}`
      : "";
    alert(`Keine offenen, versendbaren E-Mails vorhanden.${invalidText}`);
    return;
  }

  const invalidNotice = invalidEmployees.length
    ? `\n\n${invalidEmployees.length} Eintraege mit ungueltiger E-Mail werden uebersprungen und am Ende als Fehler angezeigt.`
    : "";
  if (!confirm(`Sollen jetzt ${employeesToSend.length} E-Mails direkt per SMTP gesendet werden?${invalidNotice}`)) return;

  const previousText = selectors.sendAllButton.textContent;
  selectors.sendAllButton.disabled = true;
  const failures = invalidEmployees.map((employee) => {
    return `${employee.name || "Ohne Name"}: ${emailValidationMessage(employee.email)}`;
  });

  try {
    for (let index = 0; index < employeesToSend.length; index += 1) {
      const employee = employeesToSend[index];
      selectors.sendAllButton.textContent = `Sende ${index + 1}/${employeesToSend.length}`;
      try {
        const result = await sendEmployeeBySmtp(employee);
        markAsSent(employee.id, "smtp", result, false);
      } catch (error) {
        failures.push(`${employee.name || employee.email}: ${error.message}`);
      }
    }
  } finally {
    selectors.sendAllButton.disabled = false;
    selectors.sendAllButton.textContent = previousText;
    render();
  }

  if (failures.length) {
    alert(`Fertig mit ${failures.length} Fehlern:\n\n${failures.join("\n")}`);
    return;
  }
  alert(`${employeesToSend.length} E-Mails wurden erfolgreich gesendet und dokumentiert.`);
}

async function sendAllReminderEmails() {
  const alreadyLogged = state.employees.filter((employee) => needsNotice(employee) && state.log[employee.id]);
  const invalidEmployees = alreadyLogged.filter((employee) => !isEmail(employee.email));
  const employeesToSend = alreadyLogged.filter((employee) => isEmail(employee.email));

  if (!employeesToSend.length) {
    const invalidText = invalidEmployees.length
      ? `\n\nUngueltige Adressen:\n${invalidEmployees.map((employee) => `${employee.name || "Ohne Name"}: ${emailValidationMessage(employee.email)}`).join("\n")}`
      : "";
    alert(`Keine bereits dokumentierten, offenen Mitarbeitenden fuer eine Erinnerung gefunden.${invalidText}`);
    return;
  }

  const invalidNotice = invalidEmployees.length
    ? `\n\n${invalidEmployees.length} Eintraege mit ungueltiger E-Mail werden uebersprungen und am Ende als Fehler angezeigt.`
    : "";
  if (!confirm(`Sollen jetzt ${employeesToSend.length} bereits dokumentierte Mitarbeitende erneut erinnert werden?${invalidNotice}`)) return;

  const previousText = selectors.remindAllButton.textContent;
  selectors.remindAllButton.disabled = true;
  const failures = invalidEmployees.map((employee) => {
    return `${employee.name || "Ohne Name"}: ${emailValidationMessage(employee.email)}`;
  });

  try {
    for (let index = 0; index < employeesToSend.length; index += 1) {
      const employee = employeesToSend[index];
      selectors.remindAllButton.textContent = `Erinnere ${index + 1}/${employeesToSend.length}`;
      try {
        const result = await sendEmployeeBySmtp(employee);
        markAsSent(employee.id, "smtp-reminder", result, false);
      } catch (error) {
        failures.push(`${employee.name || employee.email}: ${error.message}`);
      }
    }
  } finally {
    selectors.remindAllButton.disabled = false;
    selectors.remindAllButton.textContent = previousText;
    render();
  }

  if (failures.length) {
    alert(`Erinnerungsversand fertig mit ${failures.length} Fehlern:\n\n${failures.join("\n")}`);
    return;
  }
  alert(`${employeesToSend.length} Erinnerungen wurden erfolgreich gesendet und im Protokoll ergaenzt.`);
}

async function sendAspSummaries() {
  const groups = buildAspGroups();
  const invalidAspEmployees = state.employees.filter((employee) => {
    return needsNotice(employee) && employee.emailAsp && !isEmail(employee.emailAsp);
  });
  if (!groups.length) {
    const invalidText = invalidAspEmployees.length
      ? `\n\nUngueltige ASP-Adressen:\n${invalidAspEmployees.map((employee) => `${employee.name || "Ohne Name"}: ${emailValidationMessage(employee.emailAsp)}`).join("\n")}`
      : "";
    alert(`Keine offenen Datensaetze mit gueltiger E-Mail ASP vorhanden.${invalidText}`);
    return;
  }

  const totalEmployees = groups.reduce((sum, group) => sum + group.employees.length, 0);
  const invalidNotice = invalidAspEmployees.length
    ? `\n\n${invalidAspEmployees.length} Eintraege mit ungueltiger E-Mail ASP werden uebersprungen.`
    : "";
  if (!confirm(`Sollen jetzt ${groups.length} ASP-Zusammenfassungen fuer ${totalEmployees} offene Mitarbeitende gesendet werden?${invalidNotice}`)) return;

  const previousText = selectors.sendAspButton.textContent;
  selectors.sendAspButton.disabled = true;
  const failures = invalidAspEmployees.map((employee) => {
    return `${employee.name || "Ohne Name"} / ASP ${employee.emailAsp || "-"}: ${emailValidationMessage(employee.emailAsp)}`;
  });

  try {
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      selectors.sendAspButton.textContent = `ASP ${index + 1}/${groups.length}`;
      try {
        const result = await sendAspGroupBySmtp(group);
        markAspAsSent(group, result);
      } catch (error) {
        failures.push(`${group.emailAsp}: ${error.message}`);
      }
    }
  } finally {
    selectors.sendAspButton.disabled = false;
    selectors.sendAspButton.textContent = previousText;
    render();
  }

  if (failures.length) {
    alert(`ASP-Versand fertig mit ${failures.length} Fehlern:\n\n${failures.join("\n")}`);
    return;
  }
  alert(`${groups.length} ASP-Zusammenfassungen wurden erfolgreich gesendet und dokumentiert.`);
}

async function sendEmployeeBySmtp(employee) {
  const response = await fetchWithTimeout(`${apiBaseUrl()}/api/send`, {
    body: JSON.stringify({
      message: buildMessage(employee),
      subject: buildSubject(),
      templateVersion: selectors.templateVersionInput.value.trim(),
      to: employee.email,
      toName: employee.name,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "SMTP-Versand fehlgeschlagen.");
  return result;
}

async function sendAspGroupBySmtp(group) {
  const response = await fetchWithTimeout(`${apiBaseUrl()}/api/send`, {
    body: JSON.stringify({
      html: buildAspHtmlMessage(group),
      message: buildAspMessage(group),
      subject: buildAspSubject(group),
      templateVersion: `${selectors.templateVersionInput.value.trim()} ASP`,
      to: group.emailAsp,
      toName: group.responsible,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "SMTP-Versand fehlgeschlagen.");
  return result;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = smtpRequestTimeoutMs) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Zeitueberschreitung nach ${Math.round(timeoutMs / 1000)} Sekunden. Die E-Mail wurde nicht dokumentiert.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function markAsSent(id, method = "mailto", sendResult = {}, shouldRender = true) {
  const employee = state.employees.find((item) => item.id === id);
  if (!employee) return;

  const previousLog = state.log[id];
  const logEntry = {
    company: "",
    deadline: selectors.deadlineInput.value,
    department: employee.department,
    email: employee.email,
    emailAsp: employee.emailAsp,
    entitlement: employee.entitlement,
    fileName: state.fileName,
    manager: employee.manager,
    message: buildMessage(employee),
    method,
    name: employee.name,
    previousRemaining: employee.previousRemaining,
    remaining: employee.remaining,
    remainingLabel: formatRemaining(employee),
    rowNumber: employee.rowNumber,
    sender: selectors.senderInput.value.trim(),
    sentAt: new Date().toISOString(),
    smtpMessageId: sendResult.messageId || "",
    subject: buildSubject(),
    templateVersion: selectors.templateVersionInput.value.trim(),
  };
  const previousDeliveries = Array.isArray(previousLog?.deliveries)
    ? previousLog.deliveries
    : previousLog
      ? [previousLog]
      : [];
  state.log[id] = {
    ...logEntry,
    deliveries: [...previousDeliveries, logEntry],
  };
  saveLog();
  if (shouldRender) render();
}

function markAspAsSent(group, sendResult = {}) {
  const key = `asp:${group.emailAsp.toLowerCase()}`;
  state.log[key] = {
    aspEmployees: group.employees.map((employee) => ({
      email: employee.email,
      entitlement: employee.entitlement,
      name: employee.name,
      previousRemaining: employee.previousRemaining,
      remaining: employee.remaining,
      taken: employee.taken,
    })),
    company: "",
    email: group.emailAsp,
    fileName: state.fileName,
    message: buildAspMessage(group),
    method: "smtp-asp",
    name: group.responsible,
    rowNumber: "",
    sender: selectors.senderInput.value.trim(),
    sentAt: new Date().toISOString(),
    smtpMessageId: sendResult.messageId || "",
    subject: buildAspSubject(group),
    templateVersion: `${selectors.templateVersionInput.value.trim()} ASP`,
  };
  saveLog();
}

function correctVacation(id) {
  const employee = state.employees.find((item) => item.id === id);
  const input = selectors.employeeTable.querySelector(`[data-correction-input="${cssEscape(id)}"]`);
  const amount = toNumber(input ? input.value : "");
  if (!employee || !Number.isFinite(amount) || amount <= 0) {
    alert("Bitte eine gueltige Anzahl genommener Urlaubstage eintragen.");
    return;
  }
  storeVacationCorrection(employee, amount, "Nachtraeglich genommen");
}

function markVacationFullyTaken(id) {
  const employee = state.employees.find((item) => item.id === id);
  if (!employee) return;
  const amount = Number.isFinite(employee.remaining) ? Math.max(employee.remaining, 0) : 0;
  storeVacationCorrection(employee, amount, "Als vollstaendig genommen markiert", true);
}

function setRemainingVacation(id) {
  const employee = state.employees.find((item) => item.id === id);
  const input = selectors.employeeTable.querySelector(`[data-rest-input="${cssEscape(id)}"]`);
  const remaining = toNumber(input ? input.value : "");
  if (!employee || !Number.isFinite(remaining) || remaining < 0) {
    alert("Bitte einen gueltigen offenen Urlaub eintragen.");
    return;
  }
  storeRemainingCorrection(employee, remaining);
}

function setVacationEntitlement(id) {
  const employee = state.employees.find((item) => item.id === id);
  const input = selectors.employeeTable.querySelector(`[data-entitlement-input="${cssEscape(id)}"]`);
  const entitlement = toNumber(input ? input.value : "");
  if (!employee || !Number.isFinite(entitlement) || entitlement < 0) {
    alert("Bitte einen gueltigen Urlaubsanspruch eintragen.");
    return;
  }
  storeEntitlementCorrection(employee, entitlement);
}

function setEmployeeEmail(id) {
  const employee = state.employees.find((item) => item.id === id);
  const input = selectors.employeeTable.querySelector(`[data-email-input="${cssEscape(id)}"]`);
  const email = String(input ? input.value : "").trim();
  if (!employee || !isEmail(email)) {
    alert(`Bitte eine gueltige E-Mail-Adresse eintragen:\n${emailValidationMessage(email)}`);
    return;
  }
  storeEmailCorrection(employee, email);
}

function deleteEmployeeRow(id) {
  const employee = state.employees.find((item) => item.id === id);
  if (!employee) return;
  const label = employee.name || employee.email || `Zeile ${employee.rowNumber}`;
  if (!confirm(`Soll der Datensatz "${label}" wirklich aus der Tabelle geloescht werden?`)) return;
  storeDeletedCorrection(employee);
}

function storeDeletedCorrection(employee) {
  const previous = state.corrections[employee.id];
  const now = new Date().toISOString();

  state.corrections[employee.id] = {
    correctedAt: now,
    correctionTotal: previous?.correctionTotal || 0,
    deleted: true,
    deletedAt: now,
    email: previous?.emailOverride ?? employee.email,
    emailOverride: previous?.emailOverride ?? employee.email,
    fileName: state.fileName,
    history: [
      ...(previous?.history || []),
      { amount: "", at: now, note: "Zeile in der App geloescht" },
    ],
    name: employee.name,
    originalEmail: previous?.originalEmail ?? employee.email,
    originalEntitlement: previous?.originalEntitlement ?? employee.entitlement,
    originalPreviousRemaining: previous?.originalPreviousRemaining ?? employee.previousRemaining,
    originalRemaining: previous?.originalRemaining ?? employee.remaining,
    originalTaken: previous?.originalTaken ?? employee.taken,
    entitlementOverride: previous?.entitlementOverride ?? employee.entitlement,
    previousRemainingOverride: previous?.previousRemainingOverride ?? employee.previousRemaining,
    remainingOverride: previous?.remainingOverride ?? employee.remaining,
    rowNumber: employee.rowNumber,
    takenOverride: previous?.takenOverride ?? employee.taken,
  };
  state.expandedActions.delete(employee.id);
  saveCorrections();
  rebuildEmployees();
}

function storeEmailCorrection(employee, email) {
  const previous = state.corrections[employee.id];
  const originalEmail = previous ? previous.originalEmail : employee.email;
  const now = new Date().toISOString();

  state.corrections[employee.id] = {
    correctedAt: now,
    correctionTotal: previous?.correctionTotal || 0,
    email,
    emailOverride: email,
    fileName: state.fileName,
    history: [
      ...(previous?.history || []),
      { amount: "", at: now, note: `E-Mail korrigiert von ${originalEmail || "-"} auf ${email}` },
    ],
    name: employee.name,
    originalEmail,
    originalEntitlement: previous?.originalEntitlement ?? employee.entitlement,
    originalPreviousRemaining: previous?.originalPreviousRemaining ?? employee.previousRemaining,
    originalRemaining: previous?.originalRemaining ?? employee.remaining,
    originalTaken: previous?.originalTaken ?? employee.taken,
    entitlementOverride: previous?.entitlementOverride ?? employee.entitlement,
    previousRemainingOverride: previous?.previousRemainingOverride ?? employee.previousRemaining,
    remainingOverride: previous?.remainingOverride ?? employee.remaining,
    rowNumber: employee.rowNumber,
    takenOverride: previous?.takenOverride ?? employee.taken,
  };
  saveCorrections();
  rebuildEmployees();
}

function storeVacationCorrection(employee, amount, note, forceRemainingZero = false) {
  const previous = state.corrections[employee.id];
  const previousTotal = previous?.correctionTotal || 0;
  const originalTaken = previous ? previous.originalTaken : employee.taken;
  const originalRemaining = previous ? previous.originalRemaining : employee.remaining;
  const originalPreviousRemaining = previous ? previous.originalPreviousRemaining : employee.previousRemaining;
  const total = previousTotal + amount;
  const takenBase = Number.isFinite(originalTaken) ? originalTaken : 0;
  const nextTaken = takenBase + total;
  const nextRemaining = forceRemainingZero
    ? 0
    : Number.isFinite(originalRemaining)
      ? Math.max(0, originalRemaining - total)
      : Number.NaN;
  const now = new Date().toISOString();

  state.corrections[employee.id] = {
    correctedAt: now,
    correctionTotal: total,
    email: previous?.emailOverride ?? employee.email,
    emailOverride: previous?.emailOverride ?? employee.email,
    fileName: state.fileName,
    history: [
      ...(previous?.history || []),
      { amount, at: now, note },
    ],
    name: employee.name,
    originalEmail: previous?.originalEmail ?? employee.email,
    originalRemaining,
    originalTaken,
    originalEntitlement: previous?.originalEntitlement ?? employee.entitlement,
    originalPreviousRemaining,
    entitlementOverride: previous?.entitlementOverride ?? employee.entitlement,
    previousRemainingOverride: previous?.previousRemainingOverride ?? employee.previousRemaining,
    remainingOverride: nextRemaining,
    rowNumber: employee.rowNumber,
    takenOverride: nextTaken,
  };
  saveCorrections();
  rebuildEmployees();
}

function storeRemainingCorrection(employee, remaining) {
  const previous = state.corrections[employee.id];
  const originalTaken = previous ? previous.originalTaken : employee.taken;
  const originalRemaining = previous ? previous.originalRemaining : employee.remaining;
  const originalEntitlement = previous ? previous.originalEntitlement : employee.entitlement;
  const originalPreviousRemaining = previous ? previous.originalPreviousRemaining : employee.previousRemaining;
  const now = new Date().toISOString();

  state.corrections[employee.id] = {
    correctedAt: now,
    correctionTotal: previous?.correctionTotal || 0,
    email: previous?.emailOverride ?? employee.email,
    emailOverride: previous?.emailOverride ?? employee.email,
    fileName: state.fileName,
    history: [
      ...(previous?.history || []),
      { amount: remaining, at: now, note: "Offener Urlaub manuell korrigiert" },
    ],
    name: employee.name,
    originalEmail: previous?.originalEmail ?? employee.email,
    originalRemaining,
    originalTaken,
    originalEntitlement,
    originalPreviousRemaining,
    entitlementOverride: previous?.entitlementOverride ?? employee.entitlement,
    previousRemainingOverride: previous?.previousRemainingOverride ?? employee.previousRemaining,
    remainingOverride: remaining,
    rowNumber: employee.rowNumber,
    takenOverride: previous?.takenOverride ?? employee.taken,
  };
  saveCorrections();
  rebuildEmployees();
}

function storeEntitlementCorrection(employee, entitlement) {
  const previous = state.corrections[employee.id];
  const originalTaken = previous ? previous.originalTaken : employee.taken;
  const originalRemaining = previous ? previous.originalRemaining : employee.remaining;
  const originalEntitlement = previous ? previous.originalEntitlement : employee.entitlement;
  const originalPreviousRemaining = previous ? previous.originalPreviousRemaining : employee.previousRemaining;
  const now = new Date().toISOString();

  state.corrections[employee.id] = {
    correctedAt: now,
    correctionTotal: previous?.correctionTotal || 0,
    email: previous?.emailOverride ?? employee.email,
    emailOverride: previous?.emailOverride ?? employee.email,
    entitlementOverride: entitlement,
    fileName: state.fileName,
    history: [
      ...(previous?.history || []),
      { amount: entitlement, at: now, note: "Urlaubsanspruch manuell korrigiert" },
    ],
    name: employee.name,
    originalEmail: previous?.originalEmail ?? employee.email,
    originalEntitlement,
    originalPreviousRemaining,
    originalRemaining,
    originalTaken,
    previousRemainingOverride: previous?.previousRemainingOverride ?? employee.previousRemaining,
    remainingOverride: previous?.remainingOverride ?? employee.remaining,
    rowNumber: employee.rowNumber,
    takenOverride: previous?.takenOverride ?? employee.taken,
  };
  saveCorrections();
  rebuildEmployees();
}

function exportLog() {
  const mailRows = Object.values(state.log).flatMap(expandLogEntry).map((entry) => ({
    Art: entry.method === "smtp-asp" ? "ASP-Zusammenfassung" : entry.method === "smtp-reminder" ? "E-Mail-Erinnerung" : "E-Mail-Hinweis",
    Name: entry.name,
    "E-Mail": entry.email,
    "E-Mail ASP": entry.emailAsp || (entry.method === "smtp-asp" ? entry.email : ""),
    Zustaendig: entry.department || entry.name,
    "Anspruch dieses Jahr": entry.method === "smtp-asp" ? "" : entry.entitlement,
    "Rest Vorjahr": entry.method === "smtp-asp" ? "" : entry.previousRemaining,
    Genommen: "",
    Offen: entry.method === "smtp-asp" ? `${entry.aspEmployees?.length || 0} Mitarbeitende` : entry.remainingLabel || entry.remaining,
    Stichtag: formatDate(entry.deadline),
    "Gesendet am": formatDateTime(entry.sentAt),
    Versandkanal: entry.method || "mailto",
    "SMTP Message-ID": entry.smtpMessageId || "",
    Betreff: entry.subject,
    Textversion: entry.templateVersion,
    Absender: entry.sender,
    Datei: entry.fileName,
    Zeile: entry.rowNumber,
    Hinweistext: entry.message,
  }));
  const correctionRows = Object.values(state.corrections).map((entry) => ({
    Art: entry.deleted ? "Zeile geloescht" : "Urlaubskorrektur",
    Name: entry.name,
    "E-Mail": entry.email,
    "E-Mail urspruenglich": entry.originalEmail || entry.email,
    "E-Mail ASP": "",
    Zustaendig: "",
    "Anspruch dieses Jahr": formatStoredNumber(entry.entitlementOverride),
    "Rest Vorjahr": formatStoredNumber(entry.previousRemainingOverride),
    Genommen: formatStoredNumber(entry.takenOverride),
    Offen: formatStoredNumber(entry.remainingOverride),
    Stichtag: "",
    "Gesendet am": "",
    Versandkanal: "Korrektur in App",
    Betreff: "",
    Textversion: "",
    Absender: selectors.senderInput.value.trim(),
    Datei: entry.fileName,
    Zeile: entry.rowNumber,
    Hinweistext: `${entry.deleted ? `Zeile wurde am ${formatDateTime(entry.deletedAt || entry.correctedAt)} in der App geloescht. ` : ""}E-Mail neu: ${entry.email || "-"}. E-Mail urspruenglich: ${entry.originalEmail || entry.email || "-"}. Nachtraeglich genommene Urlaubstage: ${formatStoredNumber(entry.correctionTotal)}. Anspruch dieses Jahr neu: ${formatStoredNumber(entry.entitlementOverride)}. Rest Vorjahr: ${formatStoredNumber(entry.previousRemainingOverride)}. Genommen neu: ${formatStoredNumber(entry.takenOverride)}. Offen neu: ${formatStoredNumber(entry.remainingOverride)}. Korrigiert am: ${formatDateTime(entry.correctedAt)}.`,
  }));
  downloadCsv([...mailRows, ...correctionRows], "urlaubshinweis-protokoll.csv");
}

function expandLogEntry(entry) {
  if (Array.isArray(entry.deliveries) && entry.deliveries.length) return entry.deliveries;
  return [entry];
}

function exportMailList() {
  const rows = state.employees
    .filter((employee) => needsNotice(employee) && isEmail(employee.email) && !state.log[employee.id])
    .map((employee) => ({
      "E-Mail": employee.email,
      Name: employee.name,
      "E-Mail ASP": employee.emailAsp,
      Zustaendig: employee.responsible,
      "Anspruch dieses Jahr": formatNumber(employee.entitlement),
      "Rest Vorjahr": formatNumber(employee.previousRemaining),
      Genommen: formatNumber(employee.taken),
      Offen: formatRemaining(employee),
      Betreff: buildSubject(),
      Textversion: selectors.templateVersionInput.value.trim(),
      Nachricht: buildMessage(employee),
    }));
  downloadCsv(rows, "urlaubshinweis-email-liste.csv");
}

function needsNotice(employee) {
  const threshold = Number(selectors.thresholdInput.value || 0);
  if (Number.isFinite(employee.remaining)) return employee.remaining > threshold;
  return employee.noVacationTaken;
}

async function checkSmtpHealth() {
  if (!selectors.smtpStatus) return;
  selectors.smtpStatus.textContent = "SMTP pruefen...";
  selectors.smtpStatus.classList.remove("ready", "error");

  try {
    const response = await fetch(`${apiBaseUrl()}/api/health`);
    const result = await response.json();
    state.smtpAvailable = Boolean(result.smtpConfigured);
    selectors.smtpStatus.textContent = state.smtpAvailable ? "SMTP bereit" : "SMTP nicht konfiguriert";
    selectors.smtpStatus.classList.toggle("ready", state.smtpAvailable);
    selectors.smtpStatus.classList.toggle("error", !state.smtpAvailable);
  } catch {
    state.smtpAvailable = false;
    selectors.smtpStatus.textContent = "Lokaler Server fehlt";
    selectors.smtpStatus.classList.add("error");
  }
}

function apiBaseUrl() {
  if (window.location.protocol === "file:") return "http://localhost:3000";
  return "";
}

function applyStoredCorrection(employee) {
  const correction = state.corrections[employee.id];
  if (!correction) return employee;
  return {
    ...employee,
    correction,
    deleted: Boolean(correction.deleted),
    email: correction.emailOverride || correction.email || employee.email,
    entitlement: Number.isFinite(correction.entitlementOverride) ? correction.entitlementOverride : employee.entitlement,
    noVacationTaken: false,
    previousRemaining: Number.isFinite(correction.previousRemainingOverride) ? correction.previousRemainingOverride : employee.previousRemaining,
    remaining: Number.isFinite(correction.remainingOverride) ? correction.remainingOverride : employee.remaining,
    taken: Number.isFinite(correction.takenOverride) ? correction.takenOverride : employee.taken,
  };
}

function downloadCsv(rows, fileName) {
  if (!rows.length) {
    alert("Keine Daten zum Exportieren vorhanden.");
    return;
  }

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(";")),
  ].join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function loadLog() {
  try {
    return JSON.parse(localStorage.getItem("vacationNoticeLog") || "{}");
  } catch {
    return {};
  }
}

function saveLog() {
  localStorage.setItem("vacationNoticeLog", JSON.stringify(state.log));
}

function loadCorrections() {
  try {
    return JSON.parse(localStorage.getItem("vacationNoticeCorrections") || "{}");
  } catch {
    return {};
  }
}

function saveCorrections() {
  localStorage.setItem("vacationNoticeCorrections", JSON.stringify(state.corrections));
}

function stableEmployeeId(email, name, index) {
  const base = `${email || name || "zeile"}-${index}`;
  return base.toLowerCase().replace(/[^a-z0-9@._-]/g, "-");
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE").format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: getRoundingDecimals() }).format(value);
}

function formatStoredNumber(value) {
  return Number.isFinite(value) ? formatNumber(value) : "-";
}

function formatRemaining(employee) {
  if (Number.isFinite(employee.remaining)) return formatNumber(employee.remaining);
  if (employee.noVacationTaken) return "nicht beziffert";
  return "-";
}

function isEmail(value) {
  return emailValidationMessage(value) === "";
}

function emailValidationMessage(value) {
  const email = String(value || "").trim();
  if (!email) return "E-Mail-Adresse fehlt.";
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
  if (!/^[a-z]{2,63}$/i.test(labels.at(-1))) return `${email}: Domain-Endung ist ungueltig.`;
  if (!/^[^\s@(),:;<>[\]\\"]+$/.test(localPart)) return `${email}: der Teil vor dem @ enthaelt ungueltige Zeichen.`;

  return "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replaceAll('"', '\\"').replaceAll("\\", "\\\\");
}
