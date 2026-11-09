# Admin und API auf Subdomains

Stand: 9. November 2026. Die Änderungen sind für den Branch `admin-moving-11-2026` vorbereitet. Sie richten keine produktiven Domains oder Access-Anwendungen ein und veröffentlichen nichts.

## Adressen

Für jede der vier Domains `mirokit.com`, `mirokit.ru`, `ligamirokit.com` und `ligamirokit.ru` gilt dieselbe Aufteilung:

| Funktion | Beispiel |
| --- | --- |
| Öffentliche Website | `https://mirokit.com/` |
| Content Desk | `https://admin.mirokit.com/` |
| Geschützte Aufrufdetails | `https://admin.mirokit.com/status/` |
| Öffentliche Daten | `https://api.mirokit.com/v1/news`, ebenso `gallery`, `videos`, `interviews`, `projects`, `partners`, `world-points`, `online-projects/media` |
| Kontaktformular | `POST https://api.mirokit.com/v1/contact` |
| Öffentlicher Status | `https://api.mirokit.com/v1/status`, `/v1/status/visits` |
| Veröffentlichte Uploads, Videos, Untertitel und Dokumente | `https://api.mirokit.com/v1/media/<key>` |
| Geschützte Verwaltung und Uploads | `https://admin.mirokit.com/v1/admin/...` |
| Private Medienvorschau | `https://admin.mirokit.com/v1/admin/media/<key>` |

Admin-Aufrufe bleiben auf dem Host des Content Desks. So werden Access-Cookies bei Formularen, Uploads, Videos und PDF-Vorschauen als Same-Origin-Anfragen verwendet. Der öffentliche API-Host liefert für Admin-Pfade `404`; er wird nicht vollständig durch Access geschützt. Cloudflare erklärt die [Cookie-Anforderungen bei CORS](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/).

Der Umzug enthält keine Weiterleitungen für bisherige Admin-, API- oder Medienadressen. Die Hauptdomains und ihre bekannten `www`-Aliase beantworten `/admin`, `/api`, `/v1` und `/media/v1` einschließlich ihrer Unterpfade mit `404`. Auch `/admin...` ist auf dem Admin-Host kein Alias mehr. Das Frontend verwendet direkt die neuen Subdomain-Adressen. Statische Website-Assets unter `/public/` bleiben Website-Assets; redaktionelle Uploads in R2 verwenden die neue Medien-API. Die normale Seiten-URL-Normalisierung, etwa `/status` auf `/status/`, bleibt erhalten.

## Daten und Sicherheit

D1, R2, Objektschlüssel und gespeicherte `/media/v1/...`-Referenzen bleiben erhalten. Der Host-Router übersetzt neue URLs intern in die vorhandenen Handlerpfade. Öffentliche JSON-Antworten erhalten absolute Medienadressen auf dem API-Host, auch für Gallery-Cover und Untertitel. Eingefügte eigene API-Medienlinks werden bei der Validierung in das bestehende Speicherformat übersetzt. Es ist keine Datenmigration erforderlich.

Admin-HTML, CSS, JavaScript, gemeinsame Hilfsdateien und private Medien werden serverseitig authentifiziert. JWT-Signatur, Audience, Ablauf und E-Mail-Allowlist bleiben erforderlich. Lokale Tokens gelten weiterhin ausschließlich für `localhost` und `127.0.0.1`. Fremde Origins dürfen keine Admin-Anfragen ausführen. Die öffentliche API erlaubt CORS für die exakt konfigurierten Website-Origins; sie fordert keine Access-Cookies an. Veröffentlichungs-, Archivierungs-, ETag- und Range-Prüfungen laufen weiterhin im Medienhandler.

`assets.run_worker_first: true` ist absichtlich gesetzt: Die Host- und Zugriffsprüfung muss auch vor existierenden statischen Dateien erfolgen. Damit laufen jetzt alle Asset-Anfragen durch den Worker. Hintergrund: [Worker vor Static Assets ausführen](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/).

Statistikabfragen auf `api.` und `admin.` lesen die Daten der zugehörigen Website-Domain. Öffentliche Anfragen berücksichtigen den bekannten Website-Origin; für geschützte Abfragen kann `?host=www.mirokit.com` einen Website-Alias derselben Root-Domain auswählen. Subdomains werden nicht als neue Besucherbestände gezählt.

## Produktive Umstellung

1. Branch-Änderungen prüfen und CI ausführen. Externe Workers-Builds-Einstellungen separat prüfen: Ein Feature-Branch allein garantiert keine Isolation von automatischen Deployments.
2. Vor einem Deployment in Cloudflare Access für jede verwendete `admin.<domain>` den **gesamten Host ohne Pfadbeschränkung** schützen. Bestehende `/admin/*`- oder `/api/v1/admin/*`-Regeln auf der Hauptdomain reichen dafür nicht. Dieselbe Access-Anwendung kann mehrere Admin-Hosts abdecken; ihr Audience-Wert muss zur Worker-Variable `ACCESS_AUDIENCE` passen.
3. `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` und `ACCESS_ADMIN_EMAILS` in der Zielumgebung prüfen. Ohne gültige Konfiguration bleibt der Admin-Zugriff gesperrt. Alte Access-Pfadregeln auf den Hauptdomains nach erfolgreicher Umstellung entfernen; die bisherigen Service-Pfade liefern dort anschließend direkt `404`.
4. Die acht in `worker/wrangler.jsonc` vorbereiteten Custom Domains, DNS-Zonen und Zertifikate prüfen. Das spätere Deployment registriert die Custom Domains; bestehende DNS-Konflikte müssen vorher geklärt werden. Es sind weiterhin vier Website-Custom-Domains konfiguriert. `www`-Origins werden erkannt; vorhandenes `www`-Hosting muss separat eingerichtet sein.
5. `ALLOWED_ORIGINS` mit den verwendeten Website-Origins abgleichen. Turnstile läuft weiter auf der Website: seine Hostname-Liste enthält Website-Hosts, keine Admin-/API-Hosts. Bei aktivem `www` müssen auch die tatsächlichen Turnstile-Einstellungen diese Hosts zulassen.
6. Nach dem autorisierten Deployment auf jeder verwendeten Domain Anmeldung, Seitenabrufe, Kontaktformular, Upload, private Vorschau, Veröffentlichung, Medienabruf inklusive Untertiteln/PDFs, Archivierung und Statistik im Browser prüfen. Bisherige Service-Adressen auf der Hauptdomain müssen ohne Weiterleitung `404` liefern. Anonyme Admin-Anfragen sowie private/archivierte Medien müssen gesperrt bleiben. Direkte öffentliche R2-Endpunkte bleiben deaktiviert.

Ein Rollback erfolgt mit dem vorherigen Worker-/Asset-Stand und den dazu passenden Access-Regeln. D1 und R2 wurden für diese Umstellung nicht verändert. Ein erneuter Upload vorhandener Medien ist nicht erforderlich.

## Lokale Prüfung

`npm run dev` aus `worker/` behält `http://localhost:8787/admin/`, `/api/v1/...` und `/media/v1/...` bei. Es werden keine lokalen DNS- oder Zertifikatsänderungen benötigt.

```sh
# Repository-Stamm
node scripts/check-js.mjs
git diff --check

# worker/
npm test -- --run
npx --no-install wrangler deploy --dry-run
```

`worker/src/service-routing.test.js` prüft Hosts, die Abschaltung bisheriger Service-Adressen ohne Weiterleitung, CORS, Zugriffsgrenzen, JSON-Medienlinks, lokale URLs, Statistikzuordnung und Medien-Teilabrufe. Die bestehenden Kontakt-, Veröffentlichungs- und CRUD-Tests verwenden die neuen produktiven URLs bzw. den unveränderten lokalen Vertrag. Diese Tests und der Bundlecheck belegen keine produktive DNS-, TLS-, Access- oder Mailkonfiguration.

Am 9. November 2026 wurden außerdem 16 lokale Wrangler-Laufzeitprüfungen mit der echten Asset-Bindung und signierten Test-JWTs durchgeführt. Ein Headless-Edge-Smokecheck lud acht Ansichten (Content Desk, Admin-Statistik, Startseite, News, Gallery, Interviews, Online Projects, Status) ohne unbehandelte JavaScript-Fehler und bestätigte die neuen API-Ziele. Dafür wurden HTTPS-Browseranfragen in einen isolierten lokalen Worker umgeleitet; externe Netzaufrufe waren blockiert. Fehlende D1-/R2-Bindings dienten der Prüfung der Fehlerzustände. Vollständige redaktionelle Abläufe, Firefox, Mobilbedienung und die echte Cloudflare-Access-Anmeldung bleiben vor der Freigabe in der Zielumgebung zu prüfen.
