# MIRoKIT

MIRoKIT verbindet Spiel, Kultur, Kreativität und Dialog für Kinder und Jugendliche. Dieses Repository enthält die öffentliche Website und ihren geschützten Content Desk. Projektidentität und projektspezifische Inhalte sind initiative-erLeben zugeordnet; die Nutzungsbedingungen stehen in [LICENSE.md](LICENSE.md).

Dokumentationsstand: **18. Oktober 2026**, anhand des lokalen Arbeitsstands. Implementierung und lokale Tests bestätigen keinen Produktionsbetrieb. Die [Bestandsaufnahme](docs/repository-audit.md) nennt geprüfte Bereiche, konkrete offene Fehler und Nachweisgrenzen.

## Einstieg

| Aufgabe | Dokument |
| --- | --- |
| Lokal starten | Anleitung unten |
| Module, APIs, Daten und Cache verstehen | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Inhalte bearbeiten | [Content Desk](site/admin/README.md) |
| Tests ausführen und einordnen | [Testdokumentation](docs/testing.md) |
| Änderungen und Releases vorbereiten | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Sicherheitsproblem melden | [SECURITY.md](SECURITY.md) |
| Sicherheitsmaßnahmen und offene Betriebsarbeiten | [SECURITY_PLAN.md](SECURITY_PLAN.md) |
| Online-Projekte mit Fotos, Videos und PDFs | [Medienvertrag](docs/online-project-media.md) |
| Dienststatus und Aufrufstatistik | [Statusdokumentation](docs/site-status.md) |

## Aufbau und Funktionen

`site/` ist der Document Root. HTML, CSS und Vanilla JavaScript benötigen keinen Frontend-Build. `worker/` ist das npm-Paket des aktiven Cloudflare-Betriebspfads und enthält den Cloudflare Worker, Wrangler, Vitest und zehn D1-Migrationen. Es gibt kein `package.json` im Repository-Stamm. Das ignorierte `claude-philosophy/` enthält einen separaten React-/Express-Workspace mit eigenen Paketen und historischen Inhaltsplänen; es ist nicht Teil dieses Deployments. Dessen Prüfstand steht im [Audit](docs/repository-audit.md#ignorierter-react-express-prototyp).

```text
site/
  index.html                   Landingpage, Programme, Projekte, Karte und Formulare
  source/scripts/              Sprache, News-Ausgangsdaten, Interaktion und Karte
  source/style/                Gemeinsame Styles und Unterseiten-Header
  page/                        Gallery, News, Interviews, Online Projects,
                               Ansprechpartner/Impressum und Datenschutz
  status/                      Öffentliche Dienst- und Aufrufansichten
  admin/                       Geschützter Content Desk und Aufrufdetails
  public/                      Assets, Favicons, Manifest und PDF.js
worker/
  src/                         15 Laufzeitmodule und zugehörige Tests
  migrations/                  0001 bis 0010
  scripts/                     News-Seed und optionale Medien-Browserprüfung
  test/helpers/                SQLite-Testdatenbank
  wrangler.jsonc               Produktionskonfiguration
  wrangler.local.jsonc         Lokale Konfiguration
scripts/check-js.mjs            Syntaxprüfung des eigenen Anwendungscodes
.github/                       CI, CODEOWNERS und Dependabot
```

Die Website bietet RU/EN/DE, Themes, Programme, History und Projektansichten, eine Weltkarte, Partner, News-Dialoge, Gallery-Ordner sowie Kontakt- und Liga-Formulare. Einzelne Bereiche und Platzhalter bleiben redaktionell unvollständig. Die Programme-Karten sind informativ.

| Seite | Browserpfad | Datenquelle |
| --- | --- | --- |
| Startseite | `/` | HTML-Ausgangsinhalte und Content-APIs |
| Gallery | `/page/gallery/` | `/api/v1/gallery?collection=gallery`, `/api/v1/videos` |
| News | `/page/news/` | Gebündelte News, anschließend `/api/v1/news` |
| Interviews | `/page/interviews/` | `/api/v1/interviews` für Gespräche und Materialien |
| Online Projects | `/page/onlineProjects/` | Gallery-Collection `online-projects` sowie `/api/v1/online-projects/media` |
| Ansprechpartner / Impressum | `/page/contactPersons/` | Statische Profilkarten und Rechtstext-Platzhalter |
| Datenschutz | `/page/privacyPolicy/` | Russisches Dokument und englischer EU-Platzhalter |
| Status | `/status/` | `/api/v1/status`, `/api/v1/status/visits` |
| Redaktion / Aufrufdetails | `/admin/`, `/admin/status/` | Authentifizierte Admin-APIs |

Browser-URLs enthalten niemals `/site/`, mit Ausnahme des ausdrücklich weitergeleiteten Alias `/site/status`. Statische Assets beginnen mit `/public/`, hochgeladene Medien mit `/media/v1/`.

## Lokal starten

Voraussetzungen: Git, Node.js **24 oder neuer** und npm. CI verwendet Node 24; die Tests benötigen `node:sqlite`.

```bash
cd worker
npm ci
```

Beim ersten Einrichten `.dev.vars.example` nach `.dev.vars` kopieren; vorhandene lokale Werte erhalten. `ADMIN_DEV_TOKEN` durch einen eigenen lokalen Wert ersetzen.

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

Website und Redaktion liegen unter `http://localhost:8787/` und `http://localhost:8787/admin/`. Im Content Desk den lokalen Token eingeben. Er wird als `mirokitAdminToken` in `sessionStorage` gespeichert und als `X-MiroKIT-Admin-Token` gesendet.

Die lokale Konfiguration verwendet `mirokit-database-local`, `mirokit-media-local` und den Kontakt-Rate-Limiter. Sie bindet keinen echten E-Mail-Versand; Kontaktmails benötigen eine gesonderte Versandumgebung. Lokale Turnstile-Testdaten umgehen nicht die übrige Formularvalidierung. Externe Fonts, Kartenbibliotheken, Kartendaten und Turnstile benötigen Netzwerkzugriff.

Optionale lokale News-Erstbefüllung:

```bash
npm run seed:news -- mirokit-database-local --local --dry-run
npm run seed:news -- mirokit-database-local --local
```

Der Seed überschreibt vorhandene Inhalte gleicher ID und setzt sie auf `published`. Ohne `--local` zielt das Skript auf eine entfernte Datenbank. Er ist keine laufende Synchronisation und kein notwendiger Startschritt.

Für eine Vorschau ohne Worker, vom Repository-Stamm:

```bash
python3 -m http.server 8080 --directory site
```

Diese Vorschau stellt keine APIs, Authentifizierung, Uploads, Statistik oder Mailzustellung bereit. `file://` eignet sich nicht für die Modul- und Fetch-Aufrufe.

## Redaktion und Veröffentlichung

News, Videos, Interviews, Projects, World Points und Partners verwenden D1. Normale Gallery-Fotos verwenden R2-Custom-Metadaten, Gallery-Zitate D1. Online-Projekte-Fotos bleiben in einer getrennten Gallery-Collection; ihre Videos/PDFs verwenden JSON-Datensätze in R2 und keine zusätzliche D1-Tabelle.

- Normale Gallery: mehrere Bilder in einem Ordner privat hochladen, prüfen, sortieren und explizit veröffentlichen. Maximal 100 Schlüssel pro Publish-/Reorder-Anfrage; Teilfehler sind möglich.
- Online-Projekte-Fotos: Thema wählen und sofort veröffentlichen. Videos/PDFs zuerst als private Entwürfe hochladen, danach veröffentlichen oder archivieren.
- News: drei Sprachversionen und Veröffentlichungsdatum pflegen. Der Hero wählt die drei neuesten verfügbaren Meldungen und ordnet diese nach Feature-Rang.
- Projects: `past` bei `endDate < heutiges UTC-Datum`, `upcoming` vor dem Startdatum, sonst `current`. Kein Cronjob verschiebt Datensätze.
- Interviews: eigene Video-Collection `interviews` sowie Dokumente, Prospekte, Formulare und Anfragen. Der normale Gallery-Videobestand bleibt getrennt.

API-Fehler lassen in einigen Ansichten gebündelte Inhalte stehen. Eine erfolgreiche leere Liste wird je Bereich unterschiedlich behandelt; siehe [Architektur](ARCHITECTURE.md#ausgangsinhalte-und-leerzustände).

## Bindings und Variablen

| Name | Aufgabe |
| --- | --- |
| `ASSETS` | Statische Website aus `../site` |
| `SITE_DB` | Redaktion, Aufrufzähler und Diagnosegruppen in D1 |
| `SITE_MEDIA` | Uploads, Gallery-Metadaten und Online-Medien-Datensätze in R2 |
| `CONTACT_FORM_RATE_LIMITER` | Kontaktbegrenzung; konfiguriert mit 5 Anfragen je 60 Sekunden pro Formulartyp/Client-Schlüssel |
| `CONTACT_EMAIL`, `MAIL_TO` | Moderationsmail und Zielpostfach |
| `CONTACT_RECEIPT_EMAIL` | Automatische Eingangsbestätigung an Besucher |
| `USE_SEND_EMAIL_RESPONSE` | Nur Eingangsbestätigung ein-/ausschalten |
| `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES` | Serverseitige Bot-Prüfung |
| `ALLOWED_ORIGINS` | Exakte erlaubte Kontakt-Origins |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE`, `ACCESS_ADMIN_EMAILS` | Access-JWT und Admin-Allowlist |
| `ADMIN_DEV_TOKEN` | Nur lokale Admin-Authentifizierung |

`.dev.vars` wirkt lokal. Produktive Werte müssen in der tatsächlichen Zielumgebung eingerichtet sein. Die Produktionsdatei nennt die vier Apex-Domains `mirokit.com`, `mirokit.ru`, `ligamirokit.com`, `ligamirokit.ru`, `mirokit-database` und `mirokit-media`. Die Host-Allowlist kennt zusätzlich `www`; daraus folgt keine eingerichtete `www`-Route.

Nach Annahme der Moderationsmail läuft die Eingangsbestätigung über `ctx.waitUntil()`; ohne Kontext wird auf sie gewartet. Die Vorlagen unterstützen Kontakt/Liga und RU/EN/DE, mit Rückfall RU. Eingegebene Namen, Texte und Links werden nicht übernommen. Fehler der Bestätigung ändern den Erfolg der angenommenen Anfrage nicht.

`USE_SEND_EMAIL_RESPONSE=false` deaktiviert nur die Bestätigung. Nur der getrimmte, ohne Groß-/Kleinschreibung verglichene Wert `true` aktiviert sie; ein fehlender Wert gilt ebenfalls als aktiv. Leere oder andere Werte deaktivieren sie. Lokal ist `false` vorgegeben. Beide Produktions-Mailbindings begrenzen Absender; nur die Moderationsbindung hat eine feste Zieladresse. Tatsächliche Versandberechtigung und Zustellung müssen gegen den Account geprüft werden: [Cloudflare Send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/).

## Prüfungen und Betrieb

Vom Repository-Stamm:

```bash
node scripts/check-js.mjs
git diff --check
```

Aus `worker/`:

```bash
npm test -- --run
XDG_CONFIG_HOME=/tmp/mirokit-wrangler-config npx --no-install wrangler deploy --dry-run
```

Die lokale Testsuite enthält 578 Tests in 19 Dateien. Die [Testdokumentation](docs/testing.md) erklärt Abdeckung und Grenzen. Ein Test-Pass ist kein Beleg vollständiger Zweigabdeckung oder einer Cloudflare-Laufzeitprüfung.

CI führt Syntax, Whitespace, `npm ci`, Tests und Bundle-Dry-Run aus. Dieser Workflow veröffentlicht nicht. Externe Workers-Builds-Automation kann separat existieren und muss vor einem Push geprüft werden.

Produktive Migrationen, Seeds, Secrets, Access-Policies, Bucket-Regeln und Deployments sind gezielte Betriebsaktionen nach Prüfung und Freigabe. Referenzbefehle aus `worker/` sind `npm run db:migrate:remote` und `npm run deploy`; sie werden nicht für Dokumentationsarbeiten ausgeführt. Direkte öffentliche R2-Endpunkte müssen ausgeschlossen sein, damit der Worker-Veröffentlichungsschutz wirksam bleibt.

## Gestaltung und Inhalte

Sichtbare neue UI-Texte und Attribute über RU/EN/DE-Schlüssel pflegen. Einzelne Module besitzen zusätzlich eigene Wörterbücher; nicht alle vorhandenen Strings sind zentralisiert. Freigegebene Texte und Section-Header erhalten. Profil- und Impressumsangaben dürfen nicht aus Annahmen ergänzt werden.

Ansprechpartner-Tabs verwenden `#ansprechpartner` und `#impressum`; die Datenschutz-Tabs `#privacy-russia` und `#privacy-eu`. Pfeiltasten, Home/End und Browser-Verlauf sind implementiert. Der EU-Tab enthält den englischen Originaltext der gelieferten Global Privacy Policy; das Impressum enthält noch Platzhalterangaben. Die [Datenschutz-Seitendokumentation](site/page/privacyPolicy/PRIVACY_POLICY_PLAN.md) beschreibt die Inhaltsgrenzen.

Statische Medien und ihre Ablage stehen in der [Asset-Dokumentation](site/public/assets/README.md). Eingebundene Drittkomponenten behalten ihre eigenen Rechte; PDF.js liegt mit Lizenz und Begleitdateien unter `site/public/vendor/pdfjs/`.

Copyright © 2026 initiative-erLeben & MIRoKIT. Alle Rechte vorbehalten.
