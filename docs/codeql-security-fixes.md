# Korrekturen zu den sechs CodeQL-Meldungen

Stand: 13. November 2026. Ausgangspunkt ist `master` bei `71eef24`; die Änderungen liegen auf `security/codeql-alerts`. Die Subdomain-Umstellung bleibt davon getrennt. Diese Dokumentation beschreibt lokale Korrekturen, keine bereits geschlossenen GitHub-Alerts und keine produktive Veröffentlichung.

| Alert | Änderung | Nachweis |
| --- | --- | --- |
| #6 `js/polynomial-redos` | `worker/src/email.js` prüft Typ und Länge (maximal 254 Zeichen) vor einer einfachen Suche nach `@`, Punkt und Leerraum. Die bisherige mehrdeutige RegEx entfällt. | Format-/Grenzwerttests, kurze und sehr lange problematische Eingaben sowie Ablehnung vor Turnstile und Mailversand. |
| #2 `js/xss-through-dom` | Gallery-Dateinamen werden über `textContent` angezeigt. Die lokale Bildauswahl dekodiert Dateien mit `createImageBitmap()` und zeichnet ausschließlich Pixel auf eine Canvas; `URL.createObjectURL(file)` und die anschließende `image.src`-Zuweisung entfallen. Die Auswahl akzeptiert JPEG, PNG, WebP und AVIF wie die Upload-API. | Browserfälle prüfen HTML-artige Dateinamen, gezeichnete Pixel, abgewiesene SVG-/HTML-Dateien, fehlschlagende Dekodierung und Umsortieren/Entfernen bei laufender Dekodierung. |
| #1 `js/code-injection` | Der News-Seed importiert das feste News-Modul statisch. `vm.runInNewContext()` und die Konstruktion ausführbaren Quelltexts entfallen. Browser und Seed importieren dieselben unveränderten News-Daten als ES-Modul. | Seed-Dry-Run und Prüfung der Sprachdaten; Browserprüfung der News-Ausgangsinhalte bei nicht verfügbarer API. |
| #5 `js/bad-tag-filter` | Der Syntaxprüfer verwendet `parse5` statt einer RegEx zum Extrahieren von Inline-Skripten. CI installiert die Entwicklungsabhängigkeiten vor dem Syntaxcheck. | Syntaxfehler in Skripten mit ungewöhnlichen Endtags werden erkannt. Tests berücksichtigen Attribute, externe Skripte, JSON, Kommentare, Templates und `noscript`. |
| #3 `js/path-injection` | axe wird über `require.resolve("axe-core/axe.min.js")` geladen. Die freie Pfadvorgabe `MIROKIT_AXE_SCRIPT` entfällt; optional installierte Pakete können über Node-Paketauflösung bereitgestellt werden. | Browser-Harness mit dem über die Paketauflösung geladenen axe. |
| #4 `js/stack-trace-exposure` | Der lokale Testserver antwortet im Fehlerfall mit `404`, `text/plain` und dem festen Text `Not found`. Fehlerdetails gehen ausschließlich ins lokale Serverlog. | Browser-Harness fordert eine fehlende Datei an und prüft die allgemeine Antwort. |

Die E-Mail-Prüfung bleibt eine einfache Kontaktadressprüfung und ist kein vollständiger RFC-Parser. Die bisherigen Formular-Pflichtfelder, Rate-Limits, Botprüfungen und Mailbindungen bleiben erhalten. Der Seed wurde ausschließlich mit `--dry-run` geprüft; es wurden keine Datenbanken beschrieben.

`parse5` ist eine gesperrte Entwicklungsabhängigkeit und wird nicht in den produktiven Worker eingebunden. Die News-Daten selbst wurden nicht redaktionell verändert. Die bestehende Script-Adresse bleibt erhalten, wird jetzt aber über ES-Modulimporte geladen.

## Prüfumfang und Grenzen

Die lokale Suite umfasst 606 Tests in 22 Dateien. Syntaxprüfung und Wrangler-Dry-Run prüfen Quellcode und Bundle. Der optionale Browser-Harness verwendet lokale HTTP-Anfragen, einen R2-Fake und blockierte externe Browseranfragen. Er ersetzt weder Firefox-Tests noch produktive Access-, Turnstile- oder E-Mail-Prüfungen.

Am 13. November 2026 bestanden 606/606 Tests, der Syntaxcheck für 61 JavaScript-Dateien/Inline-Skripte und der Wrangler-Dry-Run. Der Edge-Harness bestand 13 funktionale Prüfgruppen ohne unbehandelte JavaScript-Fehler und fünf axe-Prüfungen ohne Befunde. Dazu gehören private Uploads, PDF-/Video-Vorschau, Veröffentlichungsentzug, Sprachwechsel, 320–1440 px Breite sowie die neuen Dateinamen-, Fehlerantwort- und News-Ausgangsinhalte-Prüfungen. Es wurden keine produktiven Daten verwendet.

Beim Browser-Regressionslauf wurde außerdem die vorhandene, vom sichtbaren Text abweichende ARIA-Beschriftung des PDF-Links entfernt. Dessen zugänglicher Name entsteht jetzt aus dem sichtbaren Linkinhalt; die RU-/EN-/DE-Texte und das Linkziel bleiben erhalten. Der veraltete Themenfilter-Selektor im Test-Harness wurde auf die vorhandenen Filterlinks angepasst.

Ein neuer CodeQL-Lauf in GitHub ist nach Veröffentlichung des Branches bzw. Erstellung eines Pull Requests erforderlich. Erst dessen Ergebnisse bestätigen, ob alle sechs Alerts geschlossen werden. Es wurde kein Alert unterdrückt oder als Fehlalarm geschlossen.

Die erste Korrektur für #2 betraf nur die Dateinamenanzeige und erfasste die weiterhin gemeldete `image.src`-Zuweisung nicht. Die nachfolgende Canvas-Änderung entfernt auch diesen Datenfluss. Dekodierungsfehler blenden die Vorschau aus; sie führen zu keinem URL-/HTML-Fallback. Abgelöste Vorschauelemente werden nach einer verzögerten Dekodierung nicht mehr beschrieben, und fertige Bitmaps werden geschlossen. Die Originaldatei bleibt für den bestehenden Upload erhalten.

Für diese Nachbesserung bestanden erneut 606/606 Tests und die Syntaxprüfung für 61 Dateien/Inline-Skripte. Der erweiterte Edge-Harness bestand 14 funktionale Prüfgruppen und fünf axe-Prüfungen ohne Befunde; er bestätigte auch den unveränderten Foto-Upload. Firefox und ein neuer GitHub-CodeQL-Lauf bleiben offen.

Bei der Paketprüfung meldet `npm audit` zusätzlich 13 Befunde (2 kritisch, 8 hoch, 2 mittel, 1 niedrig) in bereits vorhandenen Entwicklungswerkzeugen und deren Abhängigkeiten. Der Lockfile-Diff ergänzt nur `parse5` und `entities`; keine der gemeldeten Paketversionen wurde für diese Korrekturen aktualisiert. Die beiden neuen Pakete erscheinen nicht in dieser Audit-Liste. Diese Abhängigkeitsupdates benötigen eine separate Verträglichkeitsprüfung, insbesondere für Vitest und die Cloudflare-Testintegration; automatische Major-Updates wurden nicht vorgenommen.
