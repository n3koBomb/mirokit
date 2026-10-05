# Online-Projekte und Admin-Panel

Die Änderungen liegen vollständig im lokalen Projekt. Es wurden keine Inhalte
auf GitHub oder Cloudflare veröffentlicht, keine Commits erstellt und keine
entfernten Daten oder Konfigurationen verändert.

## Ergebnis

Die öffentliche Seite bietet Fotos, Videos und Dokumente in einer eigenen Leiste.
Fotos behalten die zehn Themenbuttons und ihren bisherigen Bilddialog. Videos
und Dokumente verwenden eine Themenauswahl und eigene Karten. Videos besitzen
native Wiedergabesteuerung und optional einen aufklappbaren Videotext. PDFs zeigen
die erste Seite als gespeichertes Vorschaubild; ihr Link öffnet die Datei mit
`target="_blank"` und `rel="noopener noreferrer"` in einem neuen Tab.

Im Admin-Bereich **Online-Projekte** wechseln drei Schaltflächen zwischen den
Medienarten. Neue Videos und PDFs lassen sich hochladen, mehrsprachig beschriften,
als private Entwürfe speichern, veröffentlichen und archivieren. Thema und Texte
gespeicherter Inhalte bleiben bearbeitbar. Archivierte Inhalte können erneut
veröffentlicht werden. Fotos behalten ihren sofortigen Veröffentlichungsablauf;
optionale Titel und Bildbeschreibungen lassen sich jetzt beim Upload ergänzen.

Die vorhandene Admin-Gestaltung und bereits bestehenden lokalen Änderungen wurden
weitergeführt. Eingeklappte Kurzanleitung, unabhängige Sprachgruppen, vorhandene
IDs, Sprachzuordnungen, Imports und API-Verbindungen bleiben erhalten. Der entfernte
`.rail-link` wurde nicht ergänzt. Die neue Oberfläche verwendet dieselben Abstände,
Systemschrift, Feldgrößen und Farben. Der Sprunglink hat auch im dunklen Design
einen ausreichenden Textkontrast.

## Dateien und lokale Verwendung

- `site/page/onlineProjects/`: Seitenstruktur, Mediennavigation, Filter und Karten.
- `site/source/scripts/language.js`: neue Beschriftungen für RU, EN und DE.
- `site/admin/index.html`, `admin.css`, `admin.js`: Bedienoberfläche und Einbindung.
- `site/admin/online-project-media.js`: Uploads, Vorschauen, Speicheraktionen und Listen.
- `site/public/vendor/pdfjs/`: lokal mitgelieferte PDF.js-Dateien einschließlich Lizenz.
- `worker/src/online-project-media.js`: neue Medien-Schnittstelle und Datensätze.
- `worker/src/index.js`, `admin-methods.js`, `media.js`: Routing und geschützter Dateizugriff.
- `worker/src/online-project-media.test.js`: 19 zusätzliche Funktionstests.
- `worker/scripts/check-online-project-media.mjs`: wiederholbare lokale Browserprüfung.

Es sind keine neuen Bindings oder Datenbankmigrationen nötig. Die bestehende
`SITE_MEDIA`-Anbindung wird verwendet. Website und Worker-Code gehören zusammen;
ein reiner HTML-Dateiaufruf stellt die Upload-Schnittstellen nicht bereit.
Für die lokale Anwendung den vorhandenen lokalen Worker starten und `/admin/`
bzw. `/page/onlineProjects/` öffnen. Die ausführliche Bedienung und die
API-Felder stehen in [site/admin/README.md](../site/admin/README.md).

## Durchgeführte Prüfungen

- **172 Funktionstests in 8 Testdateien erfolgreich**, einschließlich der bisherigen
  153 Tests. Ausgeführt mit Vitest im Thread-Pool, ohne Cloudflare-Verbindung.
- Neue Tests prüfen privaten Upload, Veröffentlichung, Archivierung und erneute
  Veröffentlichung, Zugriff auf PDF und Vorschaubild, Videotypen und Byte-Ranges,
  Authentifizierung, Ursprungskontrolle, Pflichtfelder, Dateisignaturen, Dateigrößen,
  ungültige Updates, Schreibkonflikte, Bereinigung fehlgeschlagener Uploads,
  geschützte JSON-Datensätze und paginierte Listen.
- JavaScript-Syntaxprüfung der neuen Module sowie der geänderten Admin- und
  Projektseitenskripte erfolgreich; `git diff --check` ohne Befund.
- **Headless-Edge-Browserprüfung mit Playwright**: echte PDF-Vorschau aus einer
  Test-PDF, Upload, privater Entwurf, Veröffentlichung, Bearbeitung, Archivierung,
  erneute Veröffentlichung, Themen- und Statusfilter, Sprachwechsel, Verlauf,
  separates PDF-Tab und Wiedergabe einer erzeugten WebM-Testdatei.
- Bestehende Fotofilter und Bilddialog einschließlich Pfeiltasten, Escape und
  Fokusrückgabe geprüft. Foto-Upload mit mehrsprachigen Beschriftungen über die
  vorhandene Galerie-Schnittstelle geprüft. Dabei wurde ein bestehender Fehler
  behoben: Unsichtbare Ordnerfelder einschließlich einer Slug-Prüfung dürfen
  Online-Projekte-Uploads nach einem Bereichswechsel nicht blockieren.
- Validierung geschlossener Sprachgruppen im neuen Medienformular und im bestehenden
  Meldungsformular, Sprunglink, Tastaturnavigation und eindeutige DOM-IDs geprüft.
- Darstellung bei **1440, 768, 390 und 320 px** ohne horizontalen Seitenüberlauf,
  **200 % Textgröße**, helle und dunkle Darstellung, reduzierte Bewegung und
  erzwungene Kontrastfarben geprüft.
- **axe-core 4.10.3** mit WCAG-A/AA-Regeln: keine automatischen Befunde in den geprüften
  Admin-, Dokument- und Videoansichten, einschließlich Admin und Dokumenten im
  dunklen mobilen Design. Ein zunächst gefundener Kontrastfehler des Admin-Sprunglinks
  wurde behoben und nachgeprüft.
- Zusätzliche Kontrastberechnung für die verwendeten Admin-Farben: Feldrahmen
  **3,43:1** (hell) bzw. **4,10:1** (dunkel), weißer Text auf primären Schaltflächen
  **6,76:1** (hell) bzw. **6,36:1** (dunkel). Die ausgewählte Medienart erreicht
  **6,12:1** bzw. **6,16:1**. Das deckt die wesentlichen neuen Bedienelemente ab;
  eine vollständige manuelle Kontrastprüfung aller Zustände bleibt ergänzend nötig.

Die Browserprüfung verwendete einen lokalen HTTP-Server, den tatsächlichen
Worker-Code für die neuen Medien und Galerie-Fotos sowie einen R2-Speicher im
Arbeitsspeicher. Unbeteiligte Inhaltslisten waren Testdaten. Es wurden keine
produktiven Uploads oder Speicheraktionen ausgeführt.

## Grenzen der Prüfung

Automatische Prüfungen belegen keine vollständige Barrierefreiheit. Eine manuelle
Screenreader-Prüfung, tatsächlicher Browser-Zoom, Safari/Firefox, die redaktionelle
Qualität der PDF-Inhalte und ein Test in der produktiven Access-/R2-Umgebung bleiben
offen. Ein Produktionstest wurde entsprechend der Vorgabe nicht durchgeführt.
Videos unterstützen einen optionalen Videotext; zeitbezogene Untertitel werden
im neuen Online-Projekte-Bereich noch nicht verwaltet.

## Lokale Screenshots

Die Screenshots verwenden lokale Testinhalte. Vorhandene Admin-Screenshots wurden
im Projekt nicht gefunden.

- [Admin, Desktop](screenshots/online-project-admin-desktop.png)
- [Dokumente, Desktop](screenshots/online-project-documents-desktop.png)
- [Admin, mobiles dunkles Design](screenshots/online-project-admin-mobile-dark.png)
- [Dokumente, mobil](screenshots/online-project-documents-mobile.png)
