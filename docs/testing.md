# Worker- und Website-Prüfungen

Stand: **18. Oktober 2026**. Die Tests liegen neben dem Worker-Code unter `worker/src/`; der SQLite-Helfer liegt unter `worker/test/helpers/`. Einstieg und Betriebsgrenzen stehen in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Befehle

Node.js 24 oder neuer verwenden. Im Repository-Stamm existiert kein npm-Paket.

```bash
# Repository-Stamm
node scripts/check-js.mjs
git diff --check
```

```bash
# worker/
npm ci
npm test -- --run
npm test -- --run src/media.test.js
npm test -- --run --reporters=dot
```

`npm test` verwendet `vitest --pool=threads`; ohne `--run` bleibt Vitest im Watch-Modus. Der Konfigurationsstand wählt den ausführlichen Reporter, `--reporters=dot` überschreibt ihn für einen kompakten Lauf. `@vitest/ui` ist eine Entwicklungsabhängigkeit; eine optionale lokale Oberfläche kann mit `npm test -- --ui` geöffnet werden. Ein eigener `test:ui`-Befehl ist nicht definiert.

`worker/html/` enthält im vorliegenden Arbeitsstand einen generierten Vitest-Bericht. Er gehört weder zum Worker-Einstieg noch zum Static-Assets-Verzeichnis `site/` und ist kein Anwendungscode. Der derzeitige Vitest-Konfigurationsstand definiert selbst keinen HTML-Reporter; das Vorhandensein des Ordners macht ihn nicht zu einem reproduzierbaren Build-Schritt.

## Testdateien

| Testdatei unter `worker/src/` | Wesentliche Verträge |
| --- | --- |
| `access.test.js` | Echte RSA-Signaturen, Claims, Allowlist, JWKS-TTL/Rotation/Fehler |
| `admin-methods.test.js` | Alle deklarierten Content-Adminpfade, Methoden, Trailing Slash und `Allow` |
| `contact-receipt.test.js` | Kontakt-/Liga-Versand, Sprachen, Schalter, Inhaltsgrenzen und Versandfehler |
| `content.test.js` | World-/Partner-Validierung, SQL-Upserts, Übersetzungen und öffentliche Sortierung |
| `hosts.test.js` | Alle acht Hostzuordnungen und unerlaubte Hostformen |
| `index.test.js` | Formularfelder, Rate-Limit, Inhalte und API-/Admin-Verträge |
| `interviews.test.js` | Materialien, Metadaten, Dateipfade, SQL und öffentliche Projektion |
| `media.test.js` | Veröffentlichungsstatus, D1-Referenzen, Cache, ETag, Range und Vorschau |
| `news.test.js` | Datums-/Link-/Übersetzungsvalidierung, SQL, Terminfreigabe und Datenformen |
| `online-project-media.test.js` | Video/PDF, Signaturen, private Datensätze, Publish/Archive, Konflikte und Cleanup |
| `projects.test.js` | Datumsgrenzen, Phasen, Übersetzungen und SQL |
| `remote-media.test.js` | Drive-Hosts, Weiterleitungen, Formate, Streamlimits, Reader-Cleanup und Fehler |
| `security-headers.test.js` | CSP-Direktiven und Gleichheit statischer/Worker-Header |
| `status.test.js` | Zähler, Datenschutzfilter, Bot-/DNT-/GPC-Gruppen, Paginierung, Routing und Probes |
| `videos.test.js` | Quellen, Collections, YouTube, WebVTT, Join-Deduplizierung und SQL |
| `admin-preview.test.js` | Frontend-Helfer für Token-, URL-, Blob- und konkurrierende Vorschauen |
| `gallery-page.test.js` | Gallery-Routing, Sammlungsgrenzen und Video-Zeitstempel |
| `online-projects.test.js` | Topics und normale Gallery-Ordner einschließlich Upload, Append und Reorder |
| `security.test.js` | Übergreifende Hosts, CSP, Methoden und Drive-Grenzen |

Der aktuelle Lauf umfasst **578 Tests in 19 Dateien**. Eine eigene Testdatei für jedes Laufzeitmodul ist keine Zusage von 100 Prozent Zeilen-/Zweigabdeckung. Die offenen Fälle im [Audit](repository-audit.md#konkrete-offene-befunde) sind trotz erfolgreicher Suite nicht abgesichert.

## Umgebung und Isolation

Die Tests rufen den Worker direkt mit Request-/Response-Objekten auf. R2, Assets, Mail, Rate-Limit und Netzwerk werden je Test durch Fakes oder Mocks ersetzt. Access-Tests signieren und prüfen echte RSA-JWTs.

`createDatabase()` öffnet SQLite im Arbeitsspeicher und wendet alle zehn SQL-Migrationen sortiert an. `executeStatements()` führt erzeugte Statements innerhalb einer lokalen Transaktion aus und rollt sie bei Fehler zurück. Die Domänentests prüfen damit echte SQL-/Schema-Verträge; sie emulieren keine D1-Replikation, Cloudflare-Limits oder R2-Transaktionen. Weitere Testdateien verwenden gezielt reduzierte Schemas oder eigene Fakes.

Der Test für einen fehlenden Kontakt-Rate-Limiter übergibt absichtlich eine leere Umgebung. Er fängt `console.error` lokal ab und prüft die erwartete Meldung sowie das sichere Fehlerergebnis. Produktionslogging wird dadurch nicht deaktiviert. Taucht dieselbe Meldung außerhalb des Tests auf, Binding und tatsächlich gestartete Wrangler-Konfiguration prüfen.

## Cloudflare-Laufzeit und Bundle

```bash
# worker/, keine Veröffentlichung
XDG_CONFIG_HOME=/tmp/mirokit-wrangler-config npx --no-install wrangler deploy --dry-run
```

Ein Bundle-Dry-Run prüft Zusammenstellung und Konfiguration, führt aber keine reale Anfrage, Migration, Access-Anmeldung oder Mailzustellung aus.

`npm run test:workers -- --run` wählt alternativ den Workers-Pool. Die gesamte Suite ist dafür derzeit nicht portabel: Node-spezifische Testmodule, insbesondere `node:sqlite`, gehören zum dokumentierten Thread-Pool-Weg. Kein erfolgreicher Workers-Pool-Lauf wird behauptet. Cloudflare beschreibt die Laufzeitintegration in der [Vitest-Dokumentation](https://developers.cloudflare.com/workers/testing/vitest-integration/).

## Browser- und Produktionsgrenzen

`check-js.mjs` prüft Syntax und Inline-JavaScript, aber weder DOM-Verträge noch CSS-Rendering, Barrierefreiheit, Bildrechte oder externe Medien. Es überspringt `public/`, Abhängigkeiten und generierte Worker-Berichte; der SQLite-Helfer wird durch die importierenden Tests geladen.

Frontend-Änderungen separat mit Firefox prüfen. Der vorhandene Chromium-/Edge-Harness für Online-Medien ist optional und arbeitet mit lokalen Testdaten; Anleitung und Grenzen stehen in [online-project-media.md](online-project-media.md#optionale-browserprüfung). Ein alter Screenshot oder HTML-Testbericht bestätigt den aktuellen Stand nicht.

Produktionsnachweise benötigen die tatsächliche Umgebung: Hostrouting, Access-Policies, Bindings, private Bucket-Einstellungen, Turnstile und E-Mail-Berechtigungen. Diese Tests greifen nicht auf produktive Daten zu.

## Getrennter lokaler Prototyp

Das ignorierte `claude-philosophy/` besitzt eigene TypeScript-, ESLint-,
i18n- und Webtests. Es gehört nicht zu den 578 Worker-Tests. Vor den
workspaceübergreifenden Checks muss `npm run build --workspace @mirokit/shared`
seine importierten JS-/Typausgaben erzeugen. Im aktuellen Audit bestanden
dieser Build, ESLint und der i18n-Check mit Warnungen; der Web-Typecheck
scheitert weiterhin an nicht auflösbarem `@mirokit/shared` (vorhandener Workspace-Symlink zeigt auf einen alten Pfad), Folge-Typfehlern und der `test`-Eigenschaft in `vite.config.ts`. Alle drei Webtestsuiten
brechen beim Import an nicht verfügbarem `localStorage` ab. Details und
Befehle stehen im [Audit](repository-audit.md#ignorierter-react-express-prototyp).
