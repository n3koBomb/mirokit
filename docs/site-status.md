# Status und Besucherstatistik

Stand: **18. Oktober 2026**, lokaler Quellcode. Einstieg: [README](../README.md),
Testumgebung: [docs/testing.md](testing.md). Diese Seite ist kein unabhängiges
Produktionsmonitoring und zählt keine identifizierten Personen.

`site/status/` entspricht auf dem Worker der URL `/status/`.
`/site/status`, `/site/status/` und `/site/status/index.html` leiten dorthin weiter.
`?view=server` und `?view=visitors` wählen die Ansicht, auch beim Teilen eines Links.
Der gemeinsame Header unterstützt RU, EN, DE und Hell/Dunkel.

## Einrichtung

Migration `worker/migrations/0009_site_status.sql` ergänzt die Besuchstabellen;
`0010_request_diagnostics.sql` ergänzt die getrennten Admin-Tageszähler für Bots,
Automation und DNT/GPC-Anfragen.
Es werden keine weiteren Secrets, Dienste oder Abhängigkeiten benötigt.
Für die lokale Entwicklungsdatenbank aus `worker/`:

```text
npm run db:migrate:local
npm run dev
```

Dann `http://localhost:8787/site/status` öffnen. Für Details
`http://localhost:8787/admin/status/` öffnen und das lokale `ADMIN_DEV_TOKEN`
eingeben. Ein bereits im Content Desk verwendetes Sitzungstoken wird übernommen.
Das Token bleibt in `sessionStorage` und wird nur an lokale Admin-APIs geschickt.

Produktionsmigration und Deployment bleiben eigene, ausdrücklich freizugebende
Schritte. Nach Prüfung der Zielumgebung die vorhandene Remote-Migrationsroutine
verwenden und anschließend den Worker mitsamt Assets bereitstellen.
Cloudflare Access muss wie beim Content Desk `/admin/*` und `/api/v1/admin/*`
schützen. Die zusätzliche Worker-Prüfung validiert JWT und E-Mail-Allowlist.
Ein lokales Token gewährt auf Produktionshosts keinen Zugriff.

## Öffentliche Statistik

Der Worker zählt erfolgreiche GET-Anfragen auf öffentliche HTML-Dokumente unter
`/`, `/index.html`, `/page/*` und `/status/*`. Es gibt keinen zusätzlichen
Tracking-Request im Frontend. Worker-first-Routen sorgen auch bei statischen
Dokumenten für die serverseitige Erfassung. Weiterleitungen, Fehlerseiten, HEAD,
Admin- und API-Aufrufe, Assets, erkannte Bots, Prefetch, DNT und GPC zählen nicht
zur öffentlichen Statistik. Bots und DNT/GPC werden ausschließlich als getrennte
Tageszähler für Administratoren erfasst (siehe unten).
Auch eine Browser-Neuladung mit einer bedingten Anfrage zählt: Eine HTML-Antwort
mit `304 Not Modified` bestätigt, dass die vorhandene Seite aus dem Browsercache
verwendet werden kann, und wird ebenso wie `200 OK` erfasst. Eine reine Anzeige
aus dem Browsercache oder beim Zurücknavigieren ohne neue Serveranfrage zählt
dagegen nicht erneut.

`site_visit_totals` enthält dauerhafte Zähler pro Host, UTC-Tag, öffentlichem Pfad,
ungefährem Land und Gerätetyp. Die öffentliche API `/api/v1/status/visits` liefert
Gesamtzahlen seit Erfassungsbeginn, heute, die letzten 30 Tage, Länder, Gerätetypen
und Seiten. Länder und Seiten sind auf die 20 häufigsten Einträge begrenzt.
Jeder exakte Requesthostname hat getrennte Statistiken. Apex, Alias und `www`
werden dabei nicht über die Canonical-Zuordnung zusammengelegt. Filter und Sprachwechsel innerhalb
einer bereits geladenen Seite erzeugen keine neuen Dokumentaufrufe.

Diese Zahlen beschreiben **Aufrufe**, keine eindeutigen Besucher oder Personen.
Es werden weder IP-Adressen noch Namen, Cookies, Besucherkennungen, Suchparameter
oder vollständige User-Agents gespeichert. Land kommt aus Cloudflare-Metadaten,
Gerät und Browser werden grob aus dem User-Agent abgeleitet. Ohne Metadaten wird
„Unbekannt“ angezeigt; insbesondere gibt es lokal üblicherweise kein Land.
VPNs und unerkannte Bots können die Zahlen beeinflussen. Frühere Besuche sind
ohne vorhandene Quelldaten nicht rekonstruierbar.

## Geschützte Details

`site_visit_details` enthält Zeitpunkt, Pfad, Land, Gerätetyp und Browserfamilie
einzelner Anfragen. `/api/v1/admin/status/visits` prüft vor jeder Datenabfrage die
vorhandene Admin-Authentifizierung. Die Ansicht `/admin/status/` lädt jeweils
100 Datensätze mit Cursor-Paginierung und zeigt Zeiten in der Browserzeitzone.
Die Redaktion enthält einen Link zu dieser Ansicht.

Details sind für höchstens die letzten 90 Tage abrufbar. Beim nächsten erfassten
Aufruf werden ältere Detailzeilen gelöscht; ohne neue Aufrufe bleiben sie bis
zu diesem Zeitpunkt gespeichert, werden aber nicht mehr ausgeliefert.
Dauerhafte Summen bleiben erhalten. Es gibt keine personenübergreifende oder
wiederkehrende Besucherzuordnung.

Erfassung läuft nur mit vorhandener `SITE_DB`-Bindung und `ctx.waitUntil`.
Direkte Aufrufe des Workers ohne Ausführungskontext erfassen keine Besuche. Fehler beim Zählen, etwa eine noch nicht
angewendete Migration, verhindern keine Auslieferung der Website. Die Statistik
zeigt bei fehlenden Tabellen oder Bindungen einen Fehler statt erfundener Nullen.
API-Antworten verwenden `private, no-store`.

## Bots, Automation und DNT/GPC im Adminbereich

Der Container „Bots & DNT/GPC-Anfragen“ unter `/admin/status/` lädt ausschließlich
die geschützte API `/api/v1/admin/status/diagnostics`. Diese prüft dieselbe
Admin-Authentifizierung wie die Aufrufdetails, bevor sie Daten abfragt.
Der gemeinsame Aktualisieren-Button lädt beide Container unabhängig voneinander;
eine fehlende Migration 0010 verhindert nicht das Laden regulärer Aufrufdetails.

`site_request_diagnostics` enthält nur Tagesgruppen pro Host, UTC-Tag, öffentlichem
Pfad, fester Agentfamilie, Botstatus, Cloudflare-Verifizierung und DNT/GPC-Flags.
Weder IP, Name, Besucherkennung, Roh-User-Agent, Land, Gerät noch individuelle
Zeitpunkte werden dort gespeichert. Ein normaler Browser mit DNT/GPC erscheint
als „Browser (DNT/GPC)“, ohne als Bot behandelt zu werden.
Jede passende Anfrage erhöht genau eine Gruppe; Bot-, DNT- und GPC-Summen können
sich überschneiden. Die öffentliche Statistik und reguläre Einzelaufrufdetails
enthalten diese Anfragen weiterhin nicht.

Erfasst werden erfolgreiche öffentliche HTML-Antworten (200/304) und erfolgreiche
Aufrufe von `/robots.txt` und `/sitemap.xml`, soweit sie den Worker erreichen.
Vorladen, HEAD, Fehler, Weiterleitungen, APIs, Adminseiten und Medien-/Codeassets
bleiben ausgeschlossen. Anfragen, die Cloudflare vor dem Worker blockiert,
und bislang nicht gespeicherte historische Aufrufe sind nicht enthalten.

Bekannte Agentfamilien umfassen etwa Googlebot, bingbot, YandexBot, GPTBot,
OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot sowie Linkvorschauen und
automatisierte Werkzeuge. Die Namen sind aus dem User-Agent abgeleitet und können
vorgetäuscht werden. Als „Cloudflare bestätigt“ gilt nur ein positives
`request.cf.botManagement.verifiedBot`-Signal; ohne Signal bleibt der Botstatus
unbestätigt. Es erfolgt kein zusätzlicher Netzwerkaufruf zur Identitätsprüfung.
Das Cloudflare-Signal beschreibt den Botstatus, keine Personenidentität.
Die verfügbaren Worker-Felder sind in der
[Cloudflare-Dokumentation](https://developers.cloudflare.com/bots/reference/bot-management-variables/#workers-variables)
beschrieben.
Unbekannte erkannte Automation wird unter einer festen Sammelbezeichnung gespeichert.

Die API liefert Summen der letzten 90 UTC-Kalendertage, bis zu 50 Botgruppen und
bis zu 200 Tagesgruppen nach Seite. Die UI nennt die Begrenzungen ausdrücklich.
Ältere Tagesgruppen werden bei der nächsten erfassten Diagnoseanfrage gelöscht
und bereits zuvor nicht mehr ausgeliefert. Jede Domain bleibt getrennt.
Die Daten sind `private, no-store`; ein Fehler beim Schreiben verhindert nicht die
Auslieferung der Seite. Normale Besucher werden auch ohne Migration 0010 gezählt.

## Dienststatus

`/api/v1/status` prüft parallel die Antwortfähigkeit dieser Worker-API, die
Startseite über `ASSETS.fetch`, eine D1-Leseabfrage (`SELECT 1`) und eine
R2-Auflistung mit höchstens einem Objekt. Pro Prüfung gilt ein Zeitlimit von
vier Sekunden. Fehlende Bindungen und Fehler werden gesondert ausgewiesen;
interne Fehlermeldungen werden nicht veröffentlicht.

Die Serveransicht aktualisiert alle 60 Sekunden, solange sie im sichtbaren
Browser-Tab geöffnet ist. Das sind aktuelle Prüfungen, kein unabhängiges
Monitoring: Bei einem vollständigen Worker-Ausfall kann auch die Statusseite
nicht erreichbar sein. Es werden keine Uptime-Prozente, vergangene Vorfälle oder
E-Mail-Zustellgarantien behauptet. Der Cloudflare-Status ist separat verlinkt.

## Prüfung

Die Tests in `worker/src/status.test.js` führen die SQL-Abfragen gegen SQLite
mit beiden Statusmigrationen aus und prüfen Summen, Domaintrennung, Datenschutzfilter,
Hintergrunderfassung, Detailschutz, Paginierung, Aufbewahrung, Weiterleitungen,
fehlende Bindungen und Zeitlimits. Die Diagnoseprüfungen decken außerdem Botfamilien,
Cloudflare-Verifizierung, kombinierte DNT/GPC-Flags, private Tagesgruppen,
robots.txt/sitemap.xml und fehlende Migration 0010 ab. Die bestehenden
Repository-Checks bleiben unverändert.

## Methoden und Antwortformen

| Methode / Route | Öffentliche beziehungsweise geschützte Daten |
| --- | --- |
| `GET /api/v1/status` | `status`, `checkedAt`, `components` |
| `GET /api/v1/status/visits` | `host`, `totals`, `daily`, `countries`, `devices`, `pages` |
| `GET /api/v1/admin/status/visits?before=<id>` | `visits`, `nextCursor`, `retentionDays`; Authentifizierung erforderlich |
| `GET /api/v1/admin/status/diagnostics` | `since`, `totals`, `agents`, `groups`, `retentionDays`; Authentifizierung erforderlich |

Andere Methoden einschließlich `HEAD` liefern `405` mit `Allow: GET`. Fehlerhafte
Cursor liefern `400`; fehlende Identität `401`; fehlende Datenbank/Tabellen
`503`. Ein degradierter Dienststatus kann weiterhin eine erfolgreiche API-Antwort
mit `status=degraded` sein. Alle Antworten setzen `private, no-store` und
`noindex, nofollow`. Ein Timeout beendet das Warten auf die Probe, garantiert
aber keinen Abbruch der zugrunde liegenden Binding-Operation.

Der Dokumentationsaudit führte die lokale Suite mit 578 Tests in 19 Dateien aus,
darunter 57 Status-Tests. Er hat die Statusseite nicht erneut im Browser oder
gegen Produktionsdaten geprüft. Weitere Nachweise und Grenzen stehen im
[Repository-Audit](repository-audit.md#prüfnachweise).
