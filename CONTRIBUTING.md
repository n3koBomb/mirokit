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
node --check site/source/scripts/main.js
node --check site/admin/admin.js
git diff --check
```

Aus `worker/`:

```bash
npm test -- --run
XDG_CONFIG_HOME=/tmp/mirokit-wrangler-config npx wrangler deploy --dry-run
```

Bei Änderungen an HTML/CSS zusätzlich IDs, Asset- und API-Pfade sowie die
Darstellung in mehreren Viewports manuell prüfen. Ein erfolgreicher Syntaxcheck
oder Wrangler-Dry-Run ersetzt keinen Test mit Access, D1, R2, Turnstile und
E-Mail-Versand in der Zielumgebung.

## Git-Workflow

Änderungen gehören auf einen thematischen Zweig. Vor dem Commit den vollständigen
Status, den staged Diff und die Ziel-Remote prüfen. Commit-Nachrichten sollen
den tatsächlichen Umfang beschreiben. Push und Deployment sind getrennte Schritte;
ein Push veröffentlicht keine Worker-Änderung bei Cloudflare.
