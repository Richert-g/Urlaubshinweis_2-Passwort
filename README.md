# Urlaubshinweis App

Lokale Web-App zum Importieren von Urlaubslisten, Versenden von Urlaubshinweisen per SMTP und Dokumentieren des Versands.

Die App ist fuer den lokalen Rechner oder ein vertrautes internes Netzwerk gedacht. Zugangsdaten und Passwoerter gehoeren nicht ins Repository.

## Was die App kann

- CSV- und Excel-Dateien importieren.
- Offene Urlaubsansprueche aus der Spalte `Offen` uebernehmen.
- Deutsche Kommazahlen wie `30,5` korrekt lesen.
- Mitarbeitende per E-Mail informieren.
- Alle offenen Mitarbeiter-E-Mails gesammelt senden.
- ASP / Ansprechpersonen mit einer HTML-Tabelle ihrer offenen Mitarbeitenden informieren.
- Versandzeitpunkte dokumentieren.
- Nachtraegliche Korrekturen speichern:
  - E-Mail-Adresse korrigieren
  - offene Urlaubstage setzen
  - Anspruch dieses Jahr setzen
  - Urlaub als genommen buchen
  - Zeilen ausblenden / loeschen
- Protokoll als CSV exportieren.
- Den letzten Stand lokal im Browser wieder laden.

## Erwartete Spalten

Die Importdatei sollte diese Spalten enthalten:

```text
E-Mail;Name;E-Mail ASP;Zustaendig;Anspruch dieses Jahr;Rest Vorjahr;Genommen;Offen
```

Die Spalte `Offen` wird nicht berechnet, sondern direkt aus der Datei uebernommen. Zahlenwerte aus Excel oder CSV werden nach der in der App eingestellten Rundung verarbeitet. Standard ist eine Nachkommastelle. Aus `18,44` wird dann `18,4`.

## Installation

1. Node.js LTS installieren: <https://nodejs.org/>
2. `installieren-und-starten.bat` doppelklicken.
3. Beim ersten Start wird aus `.env.example` lokal eine `.env` erstellt.
4. Die `.env` oeffnet sich in Notepad.
5. Dort lokal Passwort und SMTP-Daten eintragen.
6. Datei speichern und Notepad schliessen.

Danach kann die App mit `starten.bat` gestartet werden.

## Lokale Konfiguration

Die Datei `.env` bleibt nur auf dem jeweiligen Rechner und wird nicht in Git aufgenommen.

Beispiel:

```env
PORT=3000

APP_PASSWORD=

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_TIMEOUT_MS=30000

SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SMTP_REPLY_TO=
```

Wichtig:

- `.env` niemals committen.
- Keine echten Passwoerter in `.env.example`, README, Screenshots oder Tickets schreiben.
- Bei Microsoft 365 muss SMTP AUTH fuer das Postfach erlaubt sein.
- Wenn SMTP AUTH gesperrt ist, muss die IT eine passende Versandloesung bereitstellen.

## Start

Per Batch-Datei:

```text
starten.bat
```

Oder per Konsole:

```bash
npm install
npm start
```

Die App laeuft danach unter:

```text
http://localhost:3000
```

## Netzwerkzugriff

Auf einem anderen Rechner im gleichen Netzwerk:

```text
http://IP-DES-APP-RECHNERS:3000
```

Dafuer muss Windows Firewall den Port `3000` zulassen.

Die App sollte nicht oeffentlich ins Internet gestellt werden.

## Anmeldung

Vor der App liegt eine Passwortseite.

Das Passwort steht nur lokal in `.env`:

```env
APP_PASSWORD=
```

Wenn kein `APP_PASSWORD` gesetzt ist, zeigt der Server eine Fehlermeldung auf der Login-Seite. Es gibt kein Standardpasswort im Repository.

## Nutzung

1. App starten und anmelden.
2. CSV- oder Excel-Datei hochladen.
3. Falls noetig unter `Konfiguration` die Spaltenzuordnung pruefen.
4. Validierung lesen.
5. E-Mail-Texte unter `Konfiguration` pruefen.
6. Bei Bedarf links `Rundung Nachkommastellen` einstellen.
7. Einzelne Zeilen ueber `Korrektur` bearbeiten.
8. Einzelne Mitarbeiter direkt senden oder `Alle Mitarbeiter senden` verwenden.
9. Optional `ASP informieren` senden.
10. Protokoll exportieren und ablegen.

## Verfuegbare Variablen in E-Mail-Texten

Wichtige Variablen:

- `{{name}}`
- `{{email}}`
- `{{emailAsp}}`
- `{{responsible}}`
- `{{manager}}`
- `{{entitlement}}`
- `{{previousRemaining}}`
- `{{taken}}`
- `{{remaining}}`
- `{{offen}}`
- `{{sender}}`
- `{{deadline}}`

Fuer ASP-Mails:

- `{{employeeList}}`
- `{{employeeTable}}`

## Repository-Regeln

Diese Dateien duerfen ins Repository:

- Quellcode: `index.html`, `app.js`, `styles.css`, `server.js`
- Startskripte
- `package.json`
- `package-lock.json`
- `.env.example` ohne echte Werte
- Beispieldaten ohne echte personenbezogene Daten

Diese Dateien duerfen nicht ins Repository:

- `.env`
- `.env.*` mit Ausnahme von `.env.example`
- `node_modules`
- echte Exporte / echte Urlaubstabellen
- Dateien mit Passwoertern, SMTP-Zugangsdaten oder personenbezogenen Echtdaten

## Entwicklung

Syntax pruefen:

```bash
node --check app.js
node --check server.js
```

Starten:

```bash
npm start
```
