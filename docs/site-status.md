# Status und Besucherstatistik

`site/status/` entspricht auf dem Worker der URL `/status/`.
`/site/status`, `/site/status/` und `/site/status/index.html` leiten dorthin weiter.
`?view=server` und `?view=visitors` wählen die Ansicht, auch beim Teilen eines Links.
Der gemeinsame Header unterstützt RU, EN, DE und Hell/Dunkel.

## Einrichtung

Die neue Migration `worker/migrations/0009_site_status.sql` ergänzt zwei Tabellen.
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
Admin- und API-Aufrufe, Assets, erkannte Bots, Prefetch, DNT und GPC zählen nicht.
Ein Browser kann HTML aus seinem eigenen Cache oder beim Zurücknavigieren anzeigen,
ohne eine neue Serveranfrage auszulösen; das zählt daher nicht erneut.

`site_visit_totals` enthält dauerhafte Zähler pro Host, UTC-Tag, öffentlichem Pfad,
ungefährem Land und Gerätetyp. Die öffentliche API `/api/v1/status/visits` liefert
Gesamtzahlen seit Erfassungsbeginn, heute, die letzten 30 Tage, Länder, Gerätetypen
und Seiten. Länder und Seiten sind auf die 20 häufigsten Einträge begrenzt.
Die vier Domains haben getrennte Statistiken. Filter und Sprachwechsel innerhalb
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

Erfassung läuft über `ctx.waitUntil`. Fehler beim Zählen, etwa eine noch nicht
angewendete Migration, verhindern keine Auslieferung der Website. Die Statistik
zeigt bei fehlenden Tabellen oder Bindungen einen Fehler statt erfundener Nullen.
API-Antworten verwenden `private, no-store`.

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
mit der neuen Migration aus und prüfen Summen, Domaintrennung, Datenschutzfilter,
Hintergrunderfassung, Detailschutz, Paginierung, Aufbewahrung, Weiterleitungen,
fehlende Bindungen und Zeitlimits. Die bestehenden Repository-Checks bleiben
unverändert.
