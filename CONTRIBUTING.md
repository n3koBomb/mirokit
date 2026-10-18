# Beiträge und Prüfungen

MIRoKIT ist proprietär; autorisierte Mitarbeit richtet sich nach [LICENSE.md](LICENSE.md). Dieses Dokument beschreibt den technischen Ablauf, Stand 18. Oktober 2026.

## Änderungen vorbereiten

1. `git status --short` und vorhandenen Diff lesen. Fremde oder bereits laufende Änderungen erhalten; keine pauschalen Resets, Stashes oder Bereinigungen.
2. Den betroffenen Vertrag in [ARCHITECTURE.md](ARCHITECTURE.md), der Admin-Anleitung oder den Fach-Dokumenten prüfen und mit dem tatsächlichen Code vergleichen.
3. Pfade, Payloads, Speicherstatus, Sprachschlüssel und Frontend-Verbraucher gemeinsam betrachten. Öffentliche URLs nicht unbeabsichtigt brechen.
4. Änderungen auf den beauftragten Umfang begrenzen. Für einen Dokumentationsauftrag offene Codefehler benennen, statt stillschweigend Anwendungslogik zu verändern.

Secrets, private Schlüssel, Formularinhalte und nicht freigegebene personenbezogene Medien gehören nicht in Git. `.env*`, `.dev.vars*`, `.wrangler/` und `node_modules/` bleiben lokal; Beispieldateien enthalten ausschließlich Platzhalter.

## UI- und Inhaltsverträge

Freigegebene Texte, Section-Header und etablierte Seitenstrukturen erhalten. Neue sichtbare Texte und Attribute über RU/EN/DE-Schlüssel pflegen; bestehende separate Wörterbücher berücksichtigen. Das Sprachereignis heißt `mirokit:languagechange`.

Asset-Pfade beziehen sich auf `site/` als Document Root. Browser laden `/public/...`, `/source/...` oder `/admin/...`, niemals `/site/public/...`. Nach Verschiebungen alle HTML-, JS-, CSS- und verzögerten Referenzen gemeinsam prüfen und veröffentlichte Alt-URLs gegebenenfalls weiterleiten.

Gallery-Collection `gallery`, Online-Fotos `online-projects`, normale Videos `general`, Interview-Videos `interviews` und Online-Video/PDF-JSON sind unterschiedliche Bestände. Ihre Upload-, Publish- und Archivierungsverträge nicht vermischen.

Rechtstexte und Impressumsangaben nur aus freigegebenen Quellen pflegen. Technische Platzhalter sind kein veröffentlichungsfertiger Rechtstext. Keine erfundenen Betreiberangaben oder Übersetzungen ergänzen.

## Lokale Checks

Voraussetzung ist Node.js 24 oder neuer. Es gibt nur im Verzeichnis `worker/` ein npm-Paket.

Vom Repository-Stamm:

```bash
node scripts/check-js.mjs
git diff --check
```

Aus `worker/`:

```bash
npm ci
npm test -- --run
XDG_CONFIG_HOME=/tmp/mirokit-wrangler-config npx --no-install wrangler deploy --dry-run
```

`npm ci` ist für Einrichtung und Änderungen am Lockfile erforderlich, nicht vor jedem einzelnen Testlauf. Abhängigkeitskonflikte anhand der Manifest-/Lockfile-Versionen lösen; keine Umgehung mit `--force` oder `--legacy-peer-deps`.

Die [Testdokumentation](docs/testing.md) erklärt Thread-Pool, SQLite, gemockte Bindings, die optionale Vitest-Oberfläche und die Grenzen von `test:workers`. Tests für veränderte Verträge und relevante Fehlerfälle ergänzen. Ein zusätzlicher Test sollte einen beobachtbaren Vertrag absichern.

`check-js.mjs` prüft eigene JS-/Inline-Skripte, überspringt unter anderem `public/` und prüft weder Typen noch Browserfunktionalität. Der Dry-Run bündelt den Worker ohne Deployment und ohne Migrationen. Syntax, Unit-/SQL-Tests, Browser und Produktion sind unterschiedliche Nachweise.

## Browserprüfung

Bei Frontend-Änderungen Firefox bei schmalem Mobilformat, Tablet und Desktop verwenden; etwa 390 × 844 sowie 320 px Breite prüfen. Zusätzlich Tastatur, Fokus, Zoom, reduzierte Bewegung, Hell/Dunkel, RU/EN/DE, leere Antworten, API-Fehler und horizontales Overflow prüfen.

Für Medienänderungen gehören Upload, private Vorschau, Veröffentlichung, Archivierung, erneuter Abruf, Navigation und Player-Cleanup dazu. Bei Playerzustand zusätzlich Reload, `pagehide`, Medienwechsel, Lautstärke und Vollbild prüfen. Kontakt-/Datenschutz-Tabs benötigen Hash-Deep-Links, Browser-Zurück/Vorwärts sowie Pfeiltasten/Home/End.

Der vorhandene optionale Online-Medien-Harness verwendet Chromium/Edge und R2-Testdaten im Arbeitsspeicher. Er ist kein Firefox- oder Cloudflare-Runtime-Nachweis; siehe [Medien-Dokumentation](docs/online-project-media.md#optionale-browserprüfung). Wenn ein Browsercheck nicht ausführbar ist, ihn als offen berichten.

## CI und Git

`.github/workflows/ci.yml` definiert `mirokit-ci` für Pull Requests, Pushes auf `master`/`main`, Merge Queue und manuelle Ausführung. Er verwendet Node 24, SHA-gepinnte Actions und lesende Token-Rechte; Schritte sind Syntax, Whitespace, `npm ci`, Tests und Wrangler-Dry-Run. Der Workflow enthält kein Deployment.

`CODEOWNERS` benennt den Repository-Owner, Dependabot prüft npm in `/worker` und GitHub Actions wöchentlich. Wirksame Reviewpflicht, Branchschutz, Bypasses und Statuscheck-Anforderungen müssen separat in GitHub geprüft werden. Ihre Existenz lässt sich nicht aus YAML oder Markdown beweisen.

Vor einem autorisierten Commit den vollständigen Status und den tatsächlich gestagten Diff prüfen. Ein Auftrag zum Testen oder Dokumentieren umfasst keinen automatischen Commit/Push. Vor einem Push Ziel-Remote und externe Build-/Deployment-Automation prüfen.

## Betrieb und Nachweise

Produktive Migrationen, News-Seeds, Secrets, Access-Regeln, Custom Domains, TLS/HSTS, R2-Lifecycle-Regeln und Deployment benötigen den passenden Betriebsauftrag. Ein Push ist kein vom Repository-Workflow ausgeführtes Deployment; eine externe Workers-Builds-Integration kann dennoch auf ihn reagieren.

Nach Änderungen Bindings, APIs, Frontend und Dokumentation zusammen prüfen. `wrangler types` ist nach Binding-Änderungen gemäß [worker/AGENTS.md](worker/AGENTS.md) auszuführen; dieser Dokumentationsauftrag ändert keine Bindings.

Berichte nennen konkret: welche Dateien geändert wurden, welche Checks liefen, deren Ergebnisse sowie offene Browser-, Laufzeit- oder Produktionsprüfungen. Alte Screenshots und frühere Testergebnisse als historische Artefakte kennzeichnen.
