# Beiträge und Prüfungen

MIRoKIT ist ein proprietäres Projekt. Änderungen dürfen nur im autorisierten
Arbeitskontext und mit geklärten Rechten für Code, Medien, Logos, Fonts und
Daten eingebracht werden.

## Arbeitsregeln

- Keine Secrets, Tokens, privaten Schlüssel oder personenbezogenen Daten committen.
- Bestehende Hostnamen, öffentliche URL-Pfade, Sprachschlüssel und API-Verträge nur nach Prüfung ändern.
- Neue redaktionelle Inhalte müssen RU, EN und DE berücksichtigen, sofern der betreffende Bereich mehrsprachig ist.
- Lokale Runtime-Dateien wie `.env*`, `.dev.vars`, `.wrangler/` und `node_modules/` bleiben ignoriert.
- Access, D1, R2, Secrets und Lifecycle-Regeln werden getrennt vom Git-Commit in Cloudflare konfiguriert.
- Deployment erfolgt erst nach ausdrücklicher Freigabe und einer Prüfung der Zielumgebung.

## Lokale Prüfungen

Aus dem Repository-Stamm:

```bash
node scripts/check-js.mjs
git diff --check
```

Aus `worker/`:

```bash
npm test -- --run
XDG_CONFIG_HOME=/tmp/mirokit-wrangler-config npx wrangler deploy --dry-run
```

Für diese Prüfungen Node.js 24 oder neuer verwenden; die Medientests führen die
echten SQL-Abfragen mit `node:sqlite` gegen die Repository-Migrationen aus.
`npm test` verwendet den Node-Thread-Pool. Der alternative `test:workers`-Befehl
ist kein Ersatz für diese Node-Tests.

`.github/workflows/ci.yml` führt diese Checks auf Pull Requests, auf `master`/`main`
und in einer Merge Queue als `mirokit-ci` aus. Der Workflow enthält nur einen
lokalen Wrangler-Dry-Run und keine Deployment-Credentials. Der Repository-Owner
muss den Check separat im GitHub-Ruleset verpflichtend machen. `CODEOWNERS` und
Dependabot werden erst nach Aufnahme der Dateien in GitHub wirksam.

Bei Änderungen an HTML/CSS zusätzlich IDs, Asset- und API-Pfade sowie die
Darstellung in mehreren Viewports manuell prüfen. Ein erfolgreicher Syntaxcheck
oder Wrangler-Dry-Run ersetzt keinen Test mit Access, D1, R2, Turnstile und
E-Mail-Versand in der Zielumgebung.

Bei Änderungen an Gallery oder den eigenständigen Unterseiten zusätzlich mit
Firefox bei mindestens 390 × 844 und einem Desktop-Viewport prüfen: Gallery-
Ordner, Mehrfachupload, Slug-Validierung, Admin-Vorschau, Sammelveröffentlichung,
öffentliche `folders`-Antwort, Rücknavigation und leere/API-Fehlerzustände. Die
statische Browserprüfung belegt nur Layout und Fallback-Verhalten; sie ersetzt
keinen Test gegen Worker, Access, D1 oder R2.

## Git-Workflow

Änderungen gehören auf einen thematischen Zweig. Vor dem Commit den vollständigen
Status, den staged Diff und die Ziel-Remote prüfen. Commit-Nachrichten sollen
den tatsächlichen Umfang beschreiben. Push und Deployment sind getrennte Schritte;
vor einem Push muss geprüft werden, ob außerhalb dieses Repositorys eine
Cloudflare-Build-Integration oder andere Deployment-Automation eingerichtet ist.
Eine Freigabe zum lokalen Arbeiten ist keine Deployment-Freigabe.

Vor einem Release müssen außerdem die betroffenen Markdown-Verträge, der
vollständige staged Diff und der Ziel-Remote gemeinsam geprüft werden. Ein
GitHub-Push und ein Cloudflare-Deployment bleiben getrennte, ausdrücklich zu
bestätigende Schritte.
