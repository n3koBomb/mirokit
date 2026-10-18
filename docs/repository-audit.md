# Repository-Abgleich und Dokumentationsaudit

Datum: **18. Oktober 2026**. Grundlage ist der vorhandene lokale Arbeitsstand einschließlich bereits laufender Änderungen. Dieses Dokument hält den Umfang, reproduzierte Befunde und die bei diesem Dokumentationsauftrag tatsächlich ausgeführten Prüfungen fest.

## Umfang und Vorgehen

Geprüft wurden Aufbau und Verträge der eigenen HTML-/CSS-/JavaScript-Dateien, aller 15 Worker-Laufzeitmodule, der Tests, der zehn SQL-Migrationen, Wrangler-/npm-/CI-Konfiguration und sämtlicher 24 vorhandener Projekt-Markdown-Dateien einschließlich zehn ignorierter Prototyp-/Inhaltspläne. URL-Verbraucher, Veröffentlichung, Admin-Identität, Medienzustand, Lokalisierung, Statuszählung und Kontaktversand wurden miteinander abgeglichen.

Das Dateiinventar enthält auch Assets, lokale Screenshots und die PDF.js-Distribution. Bei Binärdateien und minifizierter Drittanbietersoftware wurden Ablage, Verwendung, Version und Lizenzhinweise betrachtet; es wurde kein vollständiges Reverse Engineering, CVE-/Secret-Scanning oder Rechteaudit jedes Mediums durchgeführt. Abhängigkeiten unter `node_modules/`, Git-Interna, private Runtime-Dateien und der generierte Bericht `worker/html/` sind keine eigenen Anwendungsmodule.

Die semantische Prüfung konzentrierte sich auf die genannten Daten- und Sicherheitsverträge. Sie ist keine Garantie, dass jede mögliche Ausführung jeder Codezeile fehlerfrei ist. Der fehlende fallow-Binary wurde nicht nachinstalliert; es liegen keine fallow-Metriken oder vollständigen dynamischen Browsertraces vor.

## Dokumente

| Bestehende Datei | Änderung aus dem Abgleich |
| --- | --- |
| [README.md](../README.md) | Aktuelle Einstiegspunkte, Speicherwege, Mail-/Test-/Betriebsgrenzen |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Alle Worker-/Frontendbereiche, API-Methoden, zehn Migrationen und Cachematrix |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Arbeitsverzeichnis, Tests, UI-Verträge, Browser- und Release-Nachweise |
| [SECURITY.md](../SECURITY.md) | Meldeweg, vorhandene Zugriffskontrollen und Betriebsgrenzen |
| [SECURITY_PLAN.md](../SECURITY_PLAN.md) | Veralteten Maßnahmenentwurf durch aktuellen Kontrollstand und echte Restarbeiten ersetzt |
| [LICENSE.md](../LICENSE.md) | Nur technischen Verzeichnis-/Drittanbieterhinweis ergänzt; bisherige Rechtebedingungen erhalten |
| [FUTURE_IDEAS.md](../FUTURE_IDEAS.md) | Tatsächlich offene Karteninteraktion und weitere begrenzte Ideen statt vermeintlich fehlender Implementierungen |
| [Online-Medien](online-project-media.md) | Eigener Player, R2-JSON, Uploadsignaturen, ETags, Grenzen und historische Screenshots |
| [Status](site-status.md) | Exakte Hosttrennung, Methoden, Kontextabhängigkeit und aktuelle Testgrenzen |
| [Content Desk](../site/admin/README.md) | Alle Bereiche einschließlich Interviews, Publish/Archive, Vorschaufehler und Uploadgrenzen |
| [Assets](../site/public/assets/README.md) | Tatsächliche Verzeichnisse, gemeinsames SVG, Öffentlichkeit und Referenzprüfung |
| [PDF.js](../site/public/vendor/pdfjs/README.md) | Admin-Import, lokale Begleitdateien, Rendergrenzen und Updateverfahren |
| [Datenschutzseite](../site/page/privacyPolicy/PRIVACY_POLICY_PLAN.md) | Russische Richtlinie und englischen EU-Platzhalter vom alten Seitenbauplan getrennt |
| [Worker-Anweisungen](../worker/AGENTS.md) | Vorhandene Cloudflare-Vorgaben erhalten; lokale Befehle und Anwendungsverträge ergänzt |

Neu sind dieser Bericht und [docs/testing.md](testing.md). `FUTURE_IDEAS.md` und `worker/AGENTS.md` sind durch vorhandene Ignore-Regeln ausgeschlossen; ihre lokalen Aktualisierungen erscheinen nicht automatisch als normale Git-Änderungen. Es wurden keine Ignore-Regeln geändert.

## Konkrete offene Befunde

Diese Punkte wurden dokumentiert, nicht durch eine Änderung der Anwendungslogik behoben. Die vorhandenen Tests bestehen weiterhin; die genannten Grenzfälle benötigen zusätzliche Regressionstests.

### 1. Pending-Gallery-Vorschau liefert 404

**Auswirkung:** Nach dem Upload kann eine private normale Gallery-Vorschau aus der API nicht geladen werden. Der Dateipreview vor dem Upload ist ein anderer Weg.

`galleryItemFromObject()` in `worker/src/index.js` erzeugt für Pending-Dateien `/api/v1/admin/media/${encodeURIComponent(object.key)}`. Der Schlüssel enthält dadurch `%2F`. `handleMediaRequest()` in `worker/src/media.js` prüft dagegen den unbearbeiteten `url.pathname` gegen Pfadmuster mit echten `/`.

Lokale Reproduktion mit gültigem Test-Admin-Token und R2-Fake:

```text
key: gallery/pending/test/ab-12.webp
API-URL: /api/v1/admin/media/gallery%2Fpending%2Ftest%2Fab-12.webp
Abruf: 404, bevor SITE_MEDIA.head aufgerufen wird
```

**Nächster Schritt:** URL-Erzeugung und Schlüsseldekodierung auf einen gemeinsamen, validierten Vertrag bringen und genau die von der Listen-API erzeugte URL im Regressionstest abrufen. Traversal-/Kodierungsgrenzen dabei erhalten.

### 2. Interview-Materialien verlieren ihren Admin-Status

**Auswirkung:** Geladene veröffentlichte oder archivierte Materialien können im Admin als Entwurf erscheinen; die Archiv-Schaltfläche bekommt keinen verlässlichen Status.

`INTERVIEW_MATERIAL_ADMIN_QUERY` in `worker/src/interviews.js` entsteht durch Entfernen des öffentlichen `WHERE`-Filters, fügt aber `m.status` nicht in die SELECT-Liste ein. `rowsToInterviewMaterials()` liest `row.status`; die Admin-UI verwendet ihn für Beschriftung und Archivzustand.

Lokal gegen Migrationen 0004/0008 ausgeführtes `statement.columns()` bestätigt: `status` fehlt. Die öffentliche Materialabfrage filtert weiterhin korrekt auf `published`; daraus folgt keine Freigabe unveröffentlichter Dateien.

**Nächster Schritt:** Status in der Admin-Projektion erhalten und Draft/Published/Archived gegen die tatsächliche SQL-Abfrage round-trip testen.

### 3. Kontakt-JSON `null` wirft eine ungefangene Ausnahme

**Auswirkung:** Eine syntaktisch gültige, strukturell ungültige JSON-Anfrage erhält nicht die beabsichtigte kontrollierte Validierungsantwort.

Nach `await request.json()` destrukturiert `worker/src/index.js` `payload`, ohne zuvor ein Objekt zu verlangen. Ein lokaler Aufruf mit erlaubter Origin, `Content-Type: application/json` und Body `null` wirft:

```text
TypeError: Cannot destructure property 'formType' of 'payload' as it is null.
```

**Nächster Schritt:** Payload-Form vor Destrukturierung prüfen und `null`, Arrays, Skalare und fehlende Pflichtstrukturen mit erwarteten 400-Antworten testen. Diesen Fehler nicht durch Abschalten des Rate-Limits kaschieren.

### 4. Projects behandelt `//host/path` als lokalen Link

**Auswirkung:** Der dokumentierte Vertrag „lokaler Pfad oder HTTPS-URL“ erlaubt tatsächlich einen protokollrelativen externen Link und die Frontend-Klassifizierung behandelt ihn als lokal.

`linkUrl()` in `worker/src/projects.js` akzeptiert jedes mit `/` beginnende Ziel. Lokal bestätigt: `normalizeProjectInput(... linkUrl: "//example.org/path")` gibt denselben Wert zurück. `projectCardMarkup()` in `site/source/scripts/main.js` klassifiziert ihn ebenfalls als lokal. Das ist eine Vertragsabweichung; der Befund behauptet keine JavaScript-Ausführung.

**Nächster Schritt:** Explizit zwischen relativen Sitepfaden und externen HTTPS-Zielen unterscheiden. Protokollrelative URLs und weitere URL-Normalisierungsgrenzen in passenden Tests prüfen.

### 5. Lokalisierung ist nicht vollständig

**Auswirkung:** Zwei statisch verwendete Beschriftungen besitzen keine explizite russische Wörterbuchübersetzung; einzelne neue Player-Beschriftungen bleiben Englisch.

Die Prüfung wertete `language.js` einschließlich späterer `Object.assign`-Erweiterungen sowie das zusätzliche Statuswörterbuch aus und verglich alle statischen `data-key`-Verwendungen. Fehlend sind `formats` und `music` in `T.ru`, beide in `site/index.html` verwendet. Nicht vorhandene Werte lassen bestehendes Markup stehen; ein Sprachwechsel kann daher eine zuvor andere Beschriftung behalten.

Zusätzlich setzt `createOnlineProjectPlayer()` in `site/page/onlineProjects/online-projects.js` unter anderem Play/Pause-/Mute-Labels fest Englisch. Die zentrale Schlüsselliste allein findet solche dynamischen Strings nicht.

**Nächster Schritt:** Fehlende RU-Schlüssel und dynamische Playertexte über den bestehenden Übersetzungsweg ergänzen, danach Wechsel zwischen allen Sprachen einschließlich bereits aufgebauter Player prüfen.

## Ignorierter React-/Express-Prototyp

Die abschließende Suche unter Einbeziehung ignorierter Projektverzeichnisse
fand zehn weitere Markdown-Pläne. Sie wurden aktualisiert; ursprüngliche
Quelltexte und redaktionelle Entwürfe bleiben erhalten, ergänzt um den Stand
und die Grenzen der aktuellen Anwendung. Generierte `build/`-Kopien und
lokale `.claude`-/`.codex`-Agentkonfiguration sind keine zu überschreibenden
Projektquellen. Abhängigkeitsdokumentation unter `node_modules/` bleibt
unverändert. Damit wurden 24 bestehende Quelldokumente aktualisiert und zwei
neue Referenzdokumente ergänzt.

| Lokaler Plan | Aktualisierung |
| --- | --- |
| `claude-philosophy/patches/PHASE-0.md` | Baseline-Patch ausdrücklich historisch, keine Anwendung auf heutige Pfade |
| `changes/README_Planphase_DE.md` | Planindex vom aktuellen Routing getrennt |
| `changes/01_AboutUs_Plan_DE.md` | Heutiger Überblick-/Kontaktpfad |
| `changes/02_AboutTheProjectMiroKit_Plan_DE.md` | History-Sektion statt behaupteter Detailroute |
| `changes/03_Team_Plan_DE.md` | Team-/Ansprechpartnerseite und offene Freigaben |
| `changes/04_WhatIsMiroKit_Plan_DE.md` | Formatabschnitt; Quellduplikat nicht neu bestätigt |
| `changes/05_AgeGroups_Plan_DE.md` | Vorhandener Altersgruppenabschnitt, keine neuen Teilnahmebedingungen |
| `changes/06_GamePrinciple_Plan_DE.md` | Vorhandenes Spielprinzip, kein erfundenes Regelwerk |
| `changes/mirokit-react-node-plan.md` | Frühere Revision/Migrationsidee, kein aktueller Produktionsaudit |
| `changes/monorepo-phase-1_scaffold.md` | Tatsächlicher lokaler React-/Express-Aufbau und Befehle |

Die neun `changes/`-Pfade liegen jeweils unter
`claude-philosophy/patches/changes/`. Der lokale Workspace enthält eigene
Web-/API-/Shared-Pakete, Sprachrouten und JSON-Ausgangsdaten; er wird von
Root-CI und Wrangler nicht verwendet. Der Kontakt-Handler ist dort nur ein
validierender 202-Stub. Die Playwright-Beispieltests besuchen `playwright.dev`
und bestätigen keine MIRoKIT-Funktion.

Zusätzliche lokale Checks aus `claude-philosophy/`:

| Prüfung | Ergebnis |
| --- | --- |
| Shared-Build | `npm run build --workspace @mirokit/shared` bestanden; erzeugt nur lokale Buildausgaben |
| Typecheck | Nach Shared-Build bleiben nicht auflösbares `@mirokit/shared`, Folge-Typfehler und `test` als unbekannte Eigenschaft von `UserConfigExport` in `apps/web/vite.config.ts` |
| Lint | `npm run lint` bestanden |
| Übersetzung | `npm run check:i18n` bestanden mit Warnungen zu statisch nicht erkannten Keys; dynamische Lookup-Verwendung wird nicht vollständig bewiesen |
| Webtests | Drei Suiten scheitern bereits beim Import in `src/i18n/index.ts`, weil `localStorage` nicht verfügbar ist; keine Tests ausgeführt |

Der anfängliche `check:all`-Lauf scheiterte unter anderem an nicht
auflösbarem `@mirokit/shared`. Nach dem dokumentierten Shared-Build wurde
der Typecheck gezielt wiederholt; die Fehler blieben. Die Prüfung des
vorhandenen `node_modules/@mirokit/shared`-Symlinks zeigt auf einen alten,
heute nicht passenden Windows-/NTFS-Pfad statt auf das lokale Paket. Der
Shared-Build allein repariert diese Workspace-Verknüpfung nicht. Eine frische
Installation wurde nicht ausgeführt; der Vite-Konfigurationstypfehler ist
zusätzlich vorhanden. Der zusammengesetzte
Check stoppt vor Lint/i18n, deshalb wurden diese beiden Schritte separat
ausgeführt. Diese Prototypfehler wurden dokumentiert und nicht durch
Anwendungsänderungen behoben.

## Weitere dokumentierte Grenzen

- Die dynamische Sitemap enthält derzeit Startseite, Status, Gallery, Datenschutz und Online Projects; News, Interviews und Ansprechpartner fehlen. Routingunterstützung ist kein Sitemap-Eintrag.
- Der EU-Datenschutzartikel und Impressumsangaben sind Platzhalter. Für den russischen HTML-Text wurde kein neuer Vergleich mit der freigegebenen Original-PDF durchgeführt.
- Es gibt noch keinen zugesicherten Backup-/Restore-Ablauf, Admin-Audittrail, unabhängigen Statusdienst oder erzwungene CSP.
- Klassische Uploads und Online-Video/PDF haben unterschiedliche Signaturprüfungen. Nicht jeden Upload als vollständig inhaltsgeprüft beschreiben.
- Permanente Entwürfe und Online-Medien dürfen keiner pauschalen Pending-Lifecycle-Regel unterliegen.
- Collection-Status, Veröffentlichung, statische Fallbacks und Drittanbieter-URLs sind unterschiedliche Grenzen. Archivieren sämtlicher D1-Zeilen entfernt nicht jede statische Ausgangskarte.
- `mirokitLang` wird geschrieben, vom allgemeinen Sprachinitialisierer aber nicht gelesen. URL-Sprache wird teilweise auf Medienseiten verarbeitet.
- Die Node-/SQLite-Suite ist kein erfolgreicher Workers-Pool-, Browser-, Access- oder Zustellnachweis.

## Prüfnachweise

| Prüfung im Audit | Ergebnis |
| --- | --- |
| `npm test -- --run --reporters=dot` aus `worker/` | 578 Tests, 19 Dateien, bestanden |
| `node scripts/check-js.mjs` im Repository-Stamm | 56 JavaScript-Dateien/Inline-Skripte, bestanden |
| `git diff --check` | Bestanden |
| `npm ls --depth=0` aus `worker/` | Direkte Abhängigkeiten konsistent: Pool 0.12.21, Vitest/UI 3.2.7, Wrangler 4.143.0 |
| Wrangler `deploy --dry-run` mit temporärem XDG-Konfigurationspfad | Bundle erstellt, 383 Asset-Dateien gelesen, konfigurierte Bindings erkannt; kein Deployment |
| Lokale HTML-/CSS-/Importreferenzen | 178 auflösbare statische Referenzen, keine fehlenden Ziele |
| HTML-IDs | Keine doppelten IDs in den elf HTML-Dateien |
| Statische Übersetzungsschlüssel | Zwei fehlende RU-Schlüssel, siehe Befund 5 |
| Einzelfall-Reproduktionen | Befunde 1–4 lokal mit Worker-Aufruf beziehungsweise realer SQLite-/Normalizer-Ausführung bestätigt |
| Markdown-Links und Inventar | 26 Quelldokumente, 108 lokale Links; Pfade, Überschriften, Whitespace und Code-Fences geprüft |

Die Referenzprüfung deckt direkte HTML-/Deferred-/Object-/Icon-Referenzen, CSS-URLs und literale relative Modulimporte ab. Berechnete Pfade, fremde URLs, Rendering, Binärintegrität und Veröffentlichungseinwilligungen sind davon nicht erfasst. Die statischen HTML-Prüfungen sind kein Browserlauf.

Nicht ausgeführt: aktueller Firefox-/Safari-/Chromium-Browserlauf, vollständige Branch-/Coverage-Messung, Cloudflare-Workers-Pool, Produktionsanfragen, Dashboardprüfung, Migration, Seed-Schreiblauf, Secret-Konfiguration, Git-Commit/Push oder Deployment. Vorhandene Screenshots und `worker/html/` bleiben historische/generierte Artefakte.

## Zuordnung der geprüften Dateien

Die folgenden Gruppen bilden zusammen die eigene Anwendung. Jede Datei ist über die Verzeichnisverträge erfasst; die 19 Testdateien sind zusätzlich einzeln in [testing.md](testing.md#testdateien) aufgeführt.

| Bereich | Berücksichtigte Dateien und Zuständigkeit |
| --- | --- |
| Laufzeit | Alle 15 `worker/src/*.js` ohne Tests; Einzelzuordnung in der Architektur |
| SQL | Alle zehn Dateien in `worker/migrations/`, einschließlich Ausgangsdaten und Statusmigrationen |
| Tests | Alle `worker/src/*.test.js` und `worker/test/helpers/database.js` |
| Tools | `scripts/check-js.mjs`, `worker/scripts/seed-news.mjs`, `worker/scripts/check-online-project-media.mjs` |
| Paket | `worker/package.json`, Lockfile, `vitest.config.js`; Node-/Thread-/UI-Verträge |
| Wrangler | Produktions-, Lokal- und News-Binding-Beispielkonfiguration, `.dev.vars.example` |
| Git/CI | Root-/Worker-Ignore-Dateien, CODEOWNERS, Dependabot und CI-Workflow |
| Statische Auslieferung | `.assetsignore`, `_headers`, `_redirects`, `robots.txt`, `sitemap.xml`, `404.html`, `security.txt` und Manifest |
| Gestaltung | Alle eigenen CSS-Dateien in Source, Admin, Status und den sechs Unterseiten |
| Sprache und Skripte | Alle eigenen Browser-JS-Dateien in Source, Admin, Status und Unterseiten |
| HTML | Landingpage, Admin/Status, sechs Unterseiten, öffentliche Statusseite und 404 |
| Assets | Inventar/Referenzen der lokalen Bilder, Logos, Downloads und Favicons; keine neuen Medienrechte behauptet |
| Vendor | PDF.js-API/Worker-Version, Importpfade, CMaps/Fonts/WASM und beigefügte Lizenzdateien |
| Dokumentation | Alle 24 vorher vorhandenen Projekt-Markdown-Dateien, einschließlich Worker-Anweisungen, lokalem Ideenplan und zehn Prototypplänen |

## Ergebnisse dieser Änderung

Die Quelländerungen betreffen ausschließlich Markdown; der Prototyp-Shared-Build erzeugte zusätzlich lokale, ignorierte Buildausgaben. Anwendungscode, Tests, HTML-Rechtstext, Bilder, Konfiguration, Lockfile und Lizenzbedingungen wurden bei dieser Dokumentationsüberarbeitung nicht geändert. Vorher vorhandene Änderungen bleiben erhalten. Die Dokumentation beschreibt bestätigten lokalen Code und markiert fehlende Nachweise und offene Fehler ausdrücklich.
