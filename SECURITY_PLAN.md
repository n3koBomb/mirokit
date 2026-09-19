# MIRoKIT – Sicherheits-, Repository- und Hardening-Plan

## Aktueller lokaler Umsetzungsstand – 19. September 2026

**Keine Deployment-Freigabe:** Dieser Auftrag umfasst Prüfung und lokale Änderungen.
Es wurde nichts zu Cloudflare deployed, keine Remote-Migration ausgeführt, kein
Secret geändert und keine GitHub- oder Cloudflare-Account-Einstellung verändert.
Der vorbereitete CI-Workflow enthält ausschließlich Prüfungen und einen lokalen
Wrangler-Dry-Run. Er enthält keinen Veröffentlichungsschritt. Der Push auf
`master` und ein späteres Cloudflare-Deployment sind getrennte Freigaben; die
untenstehenden ursprünglichen Empfehlungen sind keine Erlaubnis für ein
Deployment.

Die Prüfung erfolgte gegen den lokalen Stand auf `master`, ausgehend von Commit
`66d8af2`; die aktuelle Gallery-/History-/Dokumentationsänderung war während
dieser Prüfung noch nicht committed. Ein vorheriger GitHub-Push ist kein
Cloudflare-Deployment. Der Commit- und Push-Status wird durch die Git-Historie
dieses Repositorys belegt.
Diese Bestandsaufnahme ist keine vollständige
Prüfung aller möglichen Sicherheitslücken, der Git-Historie oder der Produktion.

### Ergebnisse und Umsetzung

| Planpunkte | Aktueller Stand |
| --- | --- |
| 1, 26 | Lokal umgesetzt: `/media/v1/` sperrt Pending-Dateien und prüft bei permanenten Dateien die tatsächliche Veröffentlichung. Gallery benötigt explizite R2-Metadaten; News, Partner, Videos, Poster und Untertitel benötigen eine veröffentlichte D1-Referenz. Zukünftig datierte News bleiben gesperrt. Fehler geben keine Mediendaten frei. |
| 29 | Authentifizierte Medienvorschau über `/api/v1/admin/media/<key>` umgesetzt und in Gallery-/Video-/Untertitel-Vorschauen eingebunden. Eine zusätzliche gerenderte Vorschauseite für komplette News-Artikel bleibt eine spätere UI-Erweiterung; Entwurfstexte sind im bestehenden geschützten Editor verfügbar. |
| 2, 3, 4 | `.github/` wird nicht mehr ignoriert. CI mit `mirokit-ci`, `CODEOWNERS` für den im Plan genannten Repository-Owner und wöchentliche Dependabot-Prüfungen für npm/GitHub Actions sind lokal vorbereitet. Actions sind auf Commit-SHAs festgelegt; Token-Rechte sind lesend. Erst nach Aufnahme in GitHub und separater Ruleset-Konfiguration entsteht ein verbindliches Merge-Gate. |
| 5 | JWKS-TTL von einer Stunde, erneuter Abruf bei unbekanntem `kid`, gemeinsame laufende Abrufe, 30 Sekunden Abruf-Mindestabstand und fünf Sekunden Fetch-Timeout umgesetzt. Vorhandenes `nbf` muss numerisch und erreicht sein. Signatur-, Issuer-, Audience-, Ablaufzeit- und E-Mail-Prüfungen bleiben erhalten. |
| 6 | Report-Only-CSP in statischen Headern und Worker-Antworten vorbereitet. Berücksichtigt unter anderem Turnstile, Fonts, cdnjs, jsDelivr/Kartenmodule, YouTube und lokale Blob-Vorschauen. Inline-Styles bleiben erlaubt. Keine Erzwingung und kein zentraler Report-Sammler; Browser-Konsole auswerten, bevor weiter verschärft wird. |
| 7 | HSTS/TLS auf Account-Ebene nicht geprüft oder verändert. `includeSubDomains`/`preload` nicht blind ergänzen; zunächst alle betroffenen Hosts erfassen. |
| 8 | Exakte Host-Zuordnung für die vier Site-Domains und ihre `www`-Varianten umgesetzt. Aliase bleiben in der Adresszeile erhalten. Die zugehörigen Tests fanden zusätzlich einen falschen `/index.html`-Redirect zur Datenschutzerklärung und einen Selbst-Redirect bei `/page/onlineProjects/`; beide sind korrigiert. |
| 9, 10 | Bestehendes HTML-Escaping, Textausgabe, Enum-Validierung und SQL-Parameterbindung beibehalten. Neue Medienabfragen verwenden ebenfalls gebundene Werte. Kein pauschaler Nachweis, dass alle denkbaren XSS-/SQL-Probleme ausgeschlossen sind. |
| 11 | Bestehende Dateitypen, Größenlimits und UUID-Dateinamen beibehalten; Video-Upload-Art auf `video`/`poster` begrenzt. Magic-Byte-/Containerprüfung bleibt die im Plan als langfristig bezeichnete Erweiterung. Neue Untertitel überschreiben keine bisher veröffentlichten Pfade. |
| 12 | Zusätzliche Lücke behoben: Google-Drive-Redirects werden einzeln geprüft, einschließlich HTTPS, Host, Port und Zugangsdaten. Maximal fünf Weiterleitungen; Antwortgröße wird während des Lesens begrenzt, auch ohne `Content-Length`. |
| 13, 14 | Turnstile, Origin-Prüfung, Honeypot und Kontakt-Rate-Limit beibehalten. Zusätzliche Admin-/Upload-Limits bleiben eine bedarfsabhängige Erweiterung. |
| 15 | Root-Ignore-Regeln erweitert: `.env*`, `.dev.vars*` und `.wrangler/` werden überall ignoriert, Beispieldateien bleiben zulässig. Kein Secret-Scan der vollständigen Git-Historie und keine Secret-Rotation durchgeführt. |
| 16 | Vorhandene `security.txt` geprüft: Ablaufdatum `2027-08-29`, derzeit nicht abgelaufen. |
| 17, 18 | Asset-Optimierung, große Dateien und Git LFS bleiben spätere Arbeiten. Keine vorhandenen Medien gelöscht oder umgewandelt. |
| 19 | Lifecycle-Dokumentation um Videos, Poster und Untertitel ergänzt. Keine Bucket-Regeln aktiviert. Gespeicherte Entwürfe liegen außerhalb von `pending` und dürfen keiner pauschalen Ablaufregel unterliegen. |
| 20, 21 | Backup-/Recovery-Vorgehen unten konkretisiert. Retention, Zugriff und Wiederherstellungstest müssen vor dem Einrichten von Backups vereinbart werden. Keine Produktionsdaten exportiert und keine Lösch-/Soft-Delete-Policy verändert. |
| 22 | Audit-Log bleibt die im Plan als spätere Erweiterung bezeichnete Arbeit; keine neue Tabelle oder Remote-Migration. |
| 23, 24, 25 | Serverseitige Admin-Prüfung erhalten und auf Medienvorschauen angewandt. Admin-Routen prüfen Methoden vor einem Speicherzugriff und liefern `405` mit `Allow`. Medienfehler werden intern geloggt und nach außen generisch beantwortet. |
| 27 | Technische Vertraulichkeitsgrenze für eigene R2-Medien verbessert. Einwilligungen und redaktionelle Freigaben wurden nicht geprüft; statische und extern gehostete Bilder benötigen weiterhin einen eigenen Veröffentlichungsprozess. |
| Gallery folder workflow | Lokal umgesetzt: Mehrfachupload in `gallery/pending/<folder-slug>/`, expliziter Status, geschützte Admin-Vorschau, maximal 100 Schlüssel pro Sammelveröffentlichung und öffentliche `folders`-Gruppierung. Keine D1-Migration. Die R2-Sammelveröffentlichung ist nicht transaktional; Teilfehler müssen im Admin geprüft werden. |
| 28 | Bestehende Lösch-/Archivierungsdialoge beibehalten. Weitere Publish-/Archive-Bestätigungen bleiben eine gesonderte UI-Entscheidung. |
| 30, 31, 32 | Kein CD-Workflow und keine Deployment-Secrets eingerichtet. GitHub Environments und spätere Freigabeschritte bleiben eine separate Betriebsentscheidung. |
| 33, 34, 35, 40 | README, Architektur und Contribution-Regeln aktualisiert; `SECURITY.md` mit privatem Meldeweg ergänzt. Git-, Review- und Deployment-Schritte bleiben getrennt. Cloudflare-Deployment, Account-Änderungen und Secrets bleiben außerhalb dieses Commit-/Push-Auftrags. |

### Wichtige Korrekturen am ursprünglichen Entwurf

Das Verschieben aus `pending` geschieht bereits beim **Speichern**, nicht erst
beim Veröffentlichen. Ein reines Sperren des Pending-Pfads würde gespeicherte
Entwürfe weiterhin offenlassen. Deshalb prüft die neue Route die Referenzen in D1
beziehungsweise den expliziten Gallery-Status in R2 und benötigt dafür keine
Migration bestehender Objektschlüssel.

Ein Jahr `immutable` für öffentliche Dateien passt nicht zu einer jederzeit
widerrufbaren Veröffentlichung unter derselben URL. Die Umsetzung verwendet
deshalb `public, max-age=0, must-revalidate` und prüft den Status auch vor `304`.
Preview, Fehler und neue R2-Schreibmetadaten verwenden `private, no-store`.
Dadurch entstehen zusätzliche D1-/R2-Lesezugriffe; eine spätere Cache-Optimierung
muss die Widerrufbarkeit ausdrücklich erhalten. Bereits gespeicherte alte
Browser-/CDN-Kopien lassen sich mit dieser lokalen Änderung nicht zurückholen.

Ein Objekt mit mindestens einer weiterhin veröffentlichten D1-Referenz bleibt
öffentlich, auch wenn ein anderer Datensatz mit demselben Objekt archiviert wird.
Gallery-Dateien richten sich nach ihrem eigenen expliziten R2-Status. Bestehende
Gallery-Dateien ohne Status werden vorsichtshalber nicht öffentlich ausgeliefert.
Vor einer späteren Freigabe müssen solche Altbestände überprüft werden.

### Noch auf Account-Ebene zu prüfen – nicht ausgeführt

- GitHub: tatsächliches Ruleset und Bypasses lesen; `mirokit-ci` als Pflichtcheck
  konfigurieren; Codeowner-Rechte und einen verfügbaren unabhängigen Reviewer
  prüfen. Die ursprüngliche Aussage zu einem bestimmten `always`-Bypass wurde
  hier nicht live bestätigt.
- Cloudflare Access: auf jedem erreichbaren Admin-Host `/admin`, `/admin/*` und
  `/api/v1/admin/*` einschließlich der neuen Medienvorschau abdecken; Audience,
  Team-Domain und E-Mail-Allowlist gegen die echte Konfiguration prüfen.
- R2: direkte öffentliche Bucket-Endpunkte und alternative Auslieferungswege
  ausschließen; alte öffentliche Cache-Regeln/Kopien berücksichtigen. Lifecycle
  nur für `news/pending/`, `gallery/pending/`, `partners/pending/`,
  `videos/pending/`, `video-posters/pending/` und `subtitles/pending/` vorbereiten.
- D1/R2-Bindings, Turnstile, E-Mail-Binding, Secrets, TLS, HSTS, Domains,
  Worker-Routen und mögliche Preview-URLs im tatsächlichen Account prüfen.
- Vor einem späteren Push prüfen, ob eine bestehende Cloudflare-Build-Integration
  oder andere externe Automation einen Push automatisch veröffentlichen würde.

Diese Schritte und jedes Deployment benötigen einen gesondert autorisierten
Betriebsauftrag. Es wurde keine Freigabe vom Manager vorausgesetzt.

### Backup-/Recovery-Vorgehen zur späteren Freigabe

1. Verantwortliche Person, Wiederherstellungsziel und erlaubten Datenverlust
   festlegen. Als zu bestätigender Ausgangspunkt: tägliche D1-Sicherung, eine
   Sicherung vor Migrationen und 30 Tage Aufbewahrung in einem verschlüsselten,
   zugriffsbeschränkten Speicher außerhalb des Repositorys.
2. R2-Objekte zusammen mit HTTP-/Custom-Metadaten und einem Manifest sichern.
   Besonders Gallery-Veröffentlichungen und Übersetzungen liegen in Metadaten.
   D1 und R2 müssen zeitlich zusammenpassen; bei der Sicherung redaktionelle
   Schreibvorgänge pausieren oder den Sicherungszeitpunkt nachvollziehbar erfassen.
3. Eine Wiederherstellung zunächst in einer isolierten Datenbank und einem
   privaten Test-Bucket erproben. Referenzen, Dateiinhalte, Metadaten und die
   Zugriffstests für Draft, Published und Archived prüfen, bevor eine produktive
   Wiederherstellung freigegeben wird.
4. Aufbewahrung und endgültige Löschung sensibler Medien mit dem Projektmanager
   abstimmen. Ein pauschales `trash/` oder langes Backup-Retention-Fenster ist
   deshalb noch nicht implementiert.

### Lokale Validierung

- Ausgangsstand: 29 bestehende Tests bestanden.
- Nach Umsetzung: 146 Tests in sieben Dateien bestanden, darunter echte
  SQLite-Abfragen mit allen fünf Repository-Migrationen, signierte RSA-JWTs,
  Methoden-/Redirect-Prüfungen, authentifizierte Admin-Medienvorschauen und den
  Gallery-Ordner-Upload mit anschließender Sammelveröffentlichung.
- `node scripts/check-js.mjs`: 32 JavaScript-Dateien/Inline-Skripte geprüft.
- `git diff --check`: bestanden.
- Wrangler `deploy --dry-run`: lokales Bundle erfolgreich erstellt, 198 Assets
  gelesen, keine Veröffentlichung.
- Die responsive Firefox-Prüfung deckt die aktuellen Second-Page-Header,
  Gallery-Fallbacks und die 390 × 844-Darstellung ab; sie nutzt einen lokalen
  statischen Server und beweist daher weder Worker-API, Access, D1 noch R2 in
  Produktion.
- Keine Prüfung gegen Produktions-Access, echte Account-Regeln, bestehende
  öffentliche Caches oder eine laufende GitHub Action. Report-Only-CSP muss vor
  Erzwingung im Browser geprüft werden.

Technische Referenzen: [Access-JWT-Verifikation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[R2 Worker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/),
[statische HTTP-Header](https://developers.cloudflare.com/workers/static-assets/headers/),
[CSP Report-Only](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only),
[GitHub Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

---

## Ursprünglicher Plan zur Nachverfolgung

Die folgenden Empfehlungen bleiben als Ausgangsentwurf erhalten. Bei Aussagen
über den aktuellen Code oder den Umsetzungsstatus gilt die Bestandsaufnahme oben.

Nach der erneuten Prüfung des aktuellen MIRoKIT-Repositories lässt sich sagen, dass sich das Projekt im Vergleich zum früheren Stand deutlich weiterentwickelt hat. Aus einer überwiegend statischen Website ist inzwischen eine wesentlich umfangreichere Plattform geworden. Zum aktuellen Aufbau gehören unter anderem ein Cloudflare Worker, D1 als Datenbank, R2 als Medienspeicher, ein geschützter Content Desk beziehungsweise Admin-Bereich, dynamische News, Gallery-Inhalte, Videos, Untertitel, World Points, Partnerverwaltung, Kontaktformulare, Cloudflare Turnstile und eine Authentifizierung über Cloudflare Access.

Der aktuelle Stand ist grundsätzlich bereits relativ sauber aufgebaut. Bei der Prüfung wurden keine offensichtlichen kritischen Sicherheitsprobleme wie öffentlich eingecheckte Produktions-Passwörter, direkt ausnutzbare SQL-Injections, triviale Stored-XSS-Lücken oder eine einfache Umgehung des Admin-Logins gefunden. Viele wichtige Sicherheitsmechanismen sind bereits vorhanden.

Trotzdem gibt es einige Stellen, die vor dem weiteren Ausbau des Projekts verbessert werden sollten. Besonders wichtig sind dabei der Umgang mit noch nicht veröffentlichten R2-Medien, die tatsächliche Stärke des GitHub-Branch-Schutzes sowie automatische Prüfungen vor einem Merge.

---

# 1. Nicht veröffentlichte R2-Medien wirklich privat machen

Der wichtigste Punkt betrifft die Medien, die in Cloudflare R2 gespeichert werden.

Aktuell werden Bilder, Videos, Poster und ähnliche Dateien während des Uploads zuerst in sogenannte Pending-Verzeichnisse gespeichert, beispielsweise:

```text
news/pending/<uuid>.webp
gallery/pending/<uuid>.webp
partners/pending/<uuid>.png
videos/pending/<uuid>.mp4
video-posters/pending/<uuid>.webp
```

Das Konzept dahinter ist grundsätzlich sinnvoll. Eine Datei wird zuerst hochgeladen und erst anschließend mit einem News-Beitrag, einem Video oder einem anderen Content-Objekt verbunden.

Das Problem ist jedoch, dass diese Medien bereits über den Worker unter `/media/v1/...` erreichbar sein können. Der Worker prüft dabei den Mediaschlüssel beziehungsweise den R2-Pfad, aber nicht zwingend, ob der zugehörige Inhalt tatsächlich veröffentlicht wurde.

Dadurch entsteht folgende Situation:

```text
Admin lädt Bild hoch
        ↓
R2 speichert:
news/pending/uuid.webp
        ↓
Worker gibt URL zurück:
https://mirokit.com/media/v1/news/pending/uuid.webp
        ↓
Datei kann bereits öffentlich erreichbar sein
```

Eine UUID ist zwar sehr schwer zu erraten, aber sie ersetzt keine Authentifizierung. Sobald die URL beispielsweise über Browser-History, Logs, Screenshots, Admin-Debugging, Netzwerkdiagnose oder versehentliches Teilen bekannt wird, könnte eine andere Person die Datei aufrufen.

Besonders problematisch wäre dies bei:

* unveröffentlichten Projektbildern,
* Fotos mit Kindern oder Jugendlichen,
* internen Partnerinformationen,
* noch nicht freigegebenen Pressebildern,
* Entwurfs-Videos,
* Interviewmaterial,
* Bildern, die erst zu einem späteren Zeitpunkt veröffentlicht werden sollen.

Die empfohlene Architektur sollte deshalb klar zwischen privaten und öffentlichen Medien unterscheiden.

Eine bessere Struktur wäre beispielsweise:

```text
Upload
   ↓
private/pending/
   ↓
Entwurf
   ↓
weiterhin privat
   ↓
Veröffentlichung
   ↓
public/
   ↓
öffentliche /media/v1/-URL
```

Alternativ können die bestehenden Ordnernamen verwendet werden, solange der Worker jede URL mit `/pending/` für normale öffentliche Requests blockiert.

Beispielsweise:

```text
/media/v1/news/pending/...       → 403 oder 404
/media/v1/videos/pending/...     → 403 oder 404
/media/v1/partners/pending/...   → 403 oder 404
```

Der Admin-Bereich könnte diese Dateien weiterhin über einen authentifizierten Preview-Endpunkt anzeigen.

Noch sauberer wäre:

```text
/media/v1/public/...
/media/v1/admin-preview/...
```

Dabei wäre `/media/v1/admin-preview/...` immer über Cloudflare Access beziehungsweise die Admin-Authentifizierung geschützt.

Wichtig ist außerdem das Cache-Verhalten.

Aktuell werden einige Medien bereits beim Upload mit einem sehr langfristigen Cache versehen:

```text
Cache-Control: public, max-age=31536000, immutable
```

Das bedeutet theoretisch ein Jahr öffentliche Cachebarkeit.

Für unveröffentlichte Dateien sollte stattdessen beispielsweise gelten:

```text
Cache-Control: private, no-store
```

Erst nach der tatsächlichen Veröffentlichung sollte die Datei einen langfristigen öffentlichen Cache erhalten.

Für veröffentlichte Medien mit unveränderlichem UUID-Dateinamen ist dagegen:

```text
Cache-Control: public, max-age=31536000, immutable
```

eine gute Lösung.

Die gewünschte Logik sollte also ungefähr lauten:

```text
Pending / Draft:
private, no-store

Published:
public, max-age=31536000, immutable
```

Dieser Punkt sollte möglichst als erstes korrigiert werden.

Empfohlener Branch:

```text
mirokit/scripts
```

Beispiel-Commit:

```text
Harden unpublished media access
```

---

# 2. Automatische GitHub-CI vor jedem Merge einführen

Das Repository besitzt inzwischen bereits sinnvolle Tests.

Unter anderem werden Dinge wie folgende geprüft:

* erlaubte Formularfelder,
* unbekannte Felder,
* Mehrfachwerte,
* Origin-Prüfung,
* Rate Limiting,
* Verhalten bei fehlendem Rate-Limit-Binding,
* News-Daten,
* News-Slugs,
* D1-Datenstrukturen,
* URLs,
* Partnerdaten,
* World Points,
* YouTube-URLs,
* WebVTT-Untertitel,
* Admin-Zugriff,
* fehlgeschlagene Authentifizierung,
* Gallery-R2-Uploads,
* R2-Promotion von Pending zu Permanent,
* öffentliche versus administrative Daten.

Die Tests sind damit bereits wertvoll.

Das Problem ist, dass sie derzeit nicht automatisch jeden Pull Request blockieren, wenn etwas kaputtgeht.

Ein Entwickler könnte beispielsweise versehentlich:

```js
const something =
```

committen und mergen, ohne dass GitHub automatisch stoppt.

Deshalb sollte GitHub Actions eingeführt werden.

Eine sinnvolle Repository-Struktur wäre:

```text
.github/
├── workflows/
│   └── ci.yml
├── dependabot.yml
└── CODEOWNERS
```

Wichtig: `.github/` sollte nicht durch `.gitignore` ausgeschlossen werden.

Der CI-Workflow sollte mindestens folgende Prüfungen ausführen.

Für das Frontend:

```bash
node --check site/source/scripts/main.js
node --check site/admin/admin.js
```

Zusätzlich:

```bash
git diff --check
```

Für den Worker:

```bash
cd worker
npm ci
npm test -- --run
npx wrangler deploy --dry-run
```

Optional zusätzlich:

```bash
npm audit
```

wobei `npm audit` nicht unbedingt als hartes Merge-Gate verwendet werden sollte, weil teilweise Warnungen auftreten können, die nicht unmittelbar relevant sind.

Später können weitere Checks hinzukommen:

```text
HTML validation
CSS validation
ESLint
Prettier
Playwright
Accessibility Tests
Lighthouse
Broken Link Check
```

Nach Einführung der GitHub Action sollte das Branch Ruleset verlangen:

```text
Require status checks to pass before merging
```

Beispielsweise mit einem Check namens:

```text
mirokit-ci
```

Dann wäre der Ablauf:

```text
Änderung
   ↓
Pull Request
   ↓
GitHub Actions
   ↓
Syntaxcheck
Tests
Wrangler Dry Run
   ↓
alles erfolgreich?
   ↓
Ja → Merge möglich
Nein → Merge blockiert
```

Das ist einer der wichtigsten Schritte für langfristige Stabilität.

Empfohlener Branch:

```text
mirokit/skeleton
```

Beispiel-Commit:

```text
Add repository security checks
```

---

# 3. CODEOWNERS hinzufügen

Da bereits Code-Owner-Reviews im Branch Ruleset vorgesehen sind, sollte auch eine passende `CODEOWNERS`-Datei vorhanden sein.

Beispielsweise:

```text
.github/CODEOWNERS
```

Eine sehr einfache Version wäre:

```text
* @n3koBomb
```

Später kann dies genauer strukturiert werden:

```text
/worker/ @n3koBomb
/site/admin/ @n3koBomb
/site/source/scripts/ @n3koBomb
```

Dadurch erkennt GitHub automatisch, wer bei Änderungen bestimmter Dateien als Reviewer vorgesehen ist.

Das ist besonders sinnvoll bei sicherheitskritischen Dateien wie:

```text
worker/src/access.js
worker/src/index.js
worker/wrangler.jsonc
site/admin/
.github/workflows/
```

---

# 4. Dependabot aktivieren

Da der Worker Node.js-Abhängigkeiten verwendet, sollte Dependabot aktiviert werden.

Beispielsweise über:

```text
.github/dependabot.yml
```

Dependabot kann regelmäßig prüfen, ob verwendete npm-Pakete neue Versionen oder Sicherheitsupdates besitzen.

Die Updates erscheinen dann als Pull Requests.

Damit entsteht beispielsweise:

```text
Dependency wird unsicher
        ↓
GitHub erkennt Advisory
        ↓
Dependabot erstellt PR
        ↓
CI testet Änderung
        ↓
Review
        ↓
Merge
```

Das ist wesentlich besser, als Bibliotheken manuell und unregelmäßig zu überprüfen.

---

# 5. Cloudflare Access JWT-Verifikation verbessern

Die bestehende Admin-Authentifizierung ist bereits ordentlich aufgebaut.

Der Worker prüft bei Cloudflare-Access-Tokens unter anderem:

```text
RS256
kid
Signatur
Issuer
Audience
Expiration
E-Mail-Adresse
```

Zusätzlich gibt es eine explizite Allowlist für Administrator-E-Mail-Adressen.

Das bedeutet:

Nur weil jemand über Cloudflare Access authentifiziert wurde, bedeutet dies nicht automatisch, dass er den MIRoKIT-Admin verwenden darf.

Es gibt noch die zusätzliche Prüfung:

```text
payload.email
        ↓
ACCESS_ADMIN_EMAILS
```

Das ist sehr sinnvoll.

Auch der lokale Entwicklungsmodus ist vernünftig getrennt.

Ein lokaler Admin-Token funktioniert nur bei:

```text
localhost
127.0.0.1
```

und nicht einfach auf der Produktionsdomain.

Verbessert werden sollte jedoch der Cache der Cloudflare-JWKS beziehungsweise Signing Keys.

Aktuell existiert ungefähr:

```js
const ACCESS_JWKS_CACHE = new Map();
```

Die Keys werden geladen und anschließend gecacht.

Wenn Cloudflare später einen neuen Signing Key verwendet und dessen `kid` noch nicht im lokalen Cache vorhanden ist, wird der Token möglicherweise einfach abgelehnt.

Besser wäre:

```text
JWT kommt an
   ↓
kid im Cache?
   ↓
Ja
   ↓
Signatur prüfen
```

aber bei:

```text
kid nicht gefunden
```

sollte einmal folgendes passieren:

```text
JWKS-Cache löschen
        ↓
Cloudflare Keys neu laden
        ↓
kid erneut suchen
        ↓
Signatur prüfen
```

Erst wenn der Key danach weiterhin unbekannt ist:

```text
401 Unauthorized
```

Zusätzlich sollte der JWKS-Cache einen begrenzten TTL erhalten.

Beispielsweise:

```text
1 Stunde
```

oder eine ähnlich vernünftige Dauer.

Zusätzlich kann bei JWTs ein vorhandener `nbf`-Claim geprüft werden.

Beispielsweise:

```js
if (
   Number.isFinite(payload.nbf) &&
   payload.nbf > now
) {
   return null;
}
```

`nbf` bedeutet:

```text
Not Before
```

Der Token darf also nicht vor diesem Zeitpunkt verwendet werden.

Der Access-Validator wäre danach ungefähr:

```text
JWT vorhanden?
        ↓
3 JWT-Teile?
        ↓
alg = RS256?
        ↓
kid vorhanden?
        ↓
Signing Key finden
        ↓
falls unbekannt:
JWKS refresh
        ↓
Signatur korrekt?
        ↓
Issuer korrekt?
        ↓
Audience korrekt?
        ↓
exp gültig?
        ↓
nbf gültig?
        ↓
E-Mail in Allowlist?
        ↓
Admin erlaubt
```

---

# 6. Content Security Policy einführen

Die Website besitzt bereits mehrere sinnvolle HTTP-Sicherheitsheader.

Unter anderem:

```text
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy
X-Frame-Options: SAMEORIGIN
```

Das ist eine gute Basis.

Was derzeit noch fehlt, ist eine Content Security Policy, kurz CSP.

Eine CSP legt fest, von welchen Quellen eine Website überhaupt Inhalte laden darf.

Beispielsweise:

```text
Scripts
Styles
Fonts
Images
Frames
Connections
```

Dadurch kann ein großer Teil möglicher XSS-Angriffe deutlich eingeschränkt werden.

MIRoKIT verwendet allerdings mehrere externe Quellen:

```text
Google Fonts
Google Fonts Static
cdnjs
Font Awesome
Cloudflare Turnstile
YouTube
R2 / eigene Medien
```

Zusätzlich gibt es derzeit noch Inline-CSS.

Deshalb sollte nicht sofort eine extrem strenge CSP aktiviert werden.

Der erste Schritt sollte sein:

```text
Content-Security-Policy-Report-Only
```

Damit kann getestet werden, was eine zukünftige CSP blockieren würde, ohne die Website tatsächlich kaputtzumachen.

Beispielsweise könnte später ungefähr so etwas entstehen:

```text
default-src 'self';
img-src 'self' data: https:;
media-src 'self' https:;
font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
script-src 'self' https://challenges.cloudflare.com;
frame-src https://challenges.cloudflare.com https://www.youtube.com;
connect-src 'self' https://challenges.cloudflare.com;
object-src 'none';
base-uri 'self';
frame-ancestors 'self';
```

Die genaue CSP muss aber erst anhand aller tatsächlich verwendeten Ressourcen getestet werden.

Besonders Inline-Styles beziehungsweise Inline-Scripts erschweren eine strenge CSP.

Deshalb sollten vorhandene Inline-Styles langfristig aus `index.html` entfernt und nach:

```text
site/source/style/style.css
```

verschoben werden.

Danach kann `style-src` wesentlich strenger werden.

Später könnte zusätzlich mit Nonces oder Hashes gearbeitet werden, falls Inline-Code wirklich benötigt wird.

---

# 7. HSTS prüfen

Im Repository ist derzeit kein eindeutiger:

```text
Strict-Transport-Security
```

Header zu sehen.

Das bedeutet nicht automatisch, dass HSTS fehlt, weil Cloudflare diesen Header möglicherweise direkt auf Zone-Ebene setzt.

Das sollte im Cloudflare Dashboard geprüft werden.

Das Ziel wäre beispielsweise:

```text
Strict-Transport-Security:
max-age=31536000; includeSubDomains
```

`preload` sollte nur verwendet werden, wenn wirklich alle Subdomains dauerhaft HTTPS unterstützen.

HSTS sorgt dafür, dass Browser MIRoKIT nach dem ersten sicheren Besuch ausschließlich über HTTPS öffnen.

Damit wird beispielsweise ein späterer:

```text
http://mirokit.com
```

Aufruf automatisch auf HTTPS erzwungen.

---

# 8. Hostname-Erkennung strenger machen

Eine kleine technische Verbesserung betrifft die aktuelle Host-Erkennung.

Momentan gibt es Logik nach dem Prinzip:

```js
hostname.endsWith(".com")
hostname.endsWith(".ru")
```

Dadurch könnte theoretisch jede beliebige `.com`-Domain als MIRoKIT-COM-Domain beziehungsweise jede `.ru`-Domain als MIRoKIT-RU-Domain behandelt werden.

Beispiele:

```text
example.com
random.com
evil.com
example.ru
```

Das ist aktuell wegen der Cloudflare-Routingstruktur wahrscheinlich nicht direkt ausnutzbar, aber unnötig breit.

Besser ist eine explizite Domainliste.

Zum Beispiel:

```js
const SITE_HOSTS = new Map([
   ["mirokit.com", "mirokit.com"],
   ["www.mirokit.com", "mirokit.com"],
   ["ligamirokit.com", "mirokit.com"],
   ["www.ligamirokit.com", "mirokit.com"],

   ["mirokit.ru", "mirokit.ru"],
   ["www.mirokit.ru", "mirokit.ru"],
   ["ligamirokit.ru", "mirokit.ru"],
   ["www.ligamirokit.ru", "mirokit.ru"],
]);
```

Danach:

```js
function getCanonicalSiteHostname(hostname) {
   return SITE_HOSTS.get(
      String(hostname || "")
         .trim()
         .toLowerCase()
         .replace(/\.$/, "")
   ) || null;
}
```

Dadurch kann nur noch eine bewusst konfigurierte MIRoKIT-Domain erkannt werden.

Interessanterweise wird dieses Prinzip beim E-Mail-Absender bereits korrekt verwendet.

Dort existiert bereits eine explizite Zuordnung von Domain zu Absenderadresse.

Die gleiche Idee sollte konsequent für alle Hostname-Prüfungen verwendet werden.

---

# 9. XSS-Schutz beibehalten

Beim dynamischen Rendern von News, Gallery, Partnern und Videos wird häufig `innerHTML` verwendet.

`innerHTML` ist grundsätzlich eine gefährliche API, wenn externe oder benutzerkontrollierte Inhalte ungefiltert eingesetzt werden.

Aktuell gibt es jedoch eine zentrale Funktion nach dem Prinzip:

```js
escapeHtml(...)
```

und dynamische Texte werden vor dem Einsetzen escaped.

Dadurch werden beispielsweise:

```html
<script>alert(1)</script>
```

oder:

```html
<img src=x onerror=alert(1)>
```

nicht als HTML ausgeführt, sondern als Text dargestellt.

Dieses Prinzip muss unbedingt erhalten bleiben.

Neue dynamische Features sollten niemals so geschrieben werden:

```js
element.innerHTML = apiData.title;
```

sondern mindestens:

```js
element.innerHTML = escapeHtml(apiData.title);
```

Noch besser ist bei reinem Text:

```js
element.textContent = apiData.title;
```

`textContent` sollte bevorzugt werden, wenn kein HTML-Markup benötigt wird.

Das grundlegende Prinzip sollte lauten:

```text
Text:
textContent

HTML-Template:
escapeHtml für jeden dynamischen Wert
```

Besonders aufpassen sollte man zukünftig bei:

```text
News Content
Markdown
Partnerlinks
YouTube URLs
Gallery Captions
Video Untertitel
Admin Preview
World Map Labels
```

---

# 10. SQL-Parameterbindung niemals aufgeben

Der aktuelle Worker verwendet bei D1 überwiegend SQL mit Platzhaltern:

```sql
WHERE id = ?
```

und anschließend gebundene Parameter.

Das ist der richtige Ansatz.

Nicht verwenden:

```js
`SELECT * FROM news WHERE id = '${id}'`
```

Stattdessen:

```js
env.SITE_DB
   .prepare("SELECT * FROM news WHERE id = ?")
   .bind(id)
```

Das sollte für alle zukünftigen D1-Abfragen beibehalten werden.

Ebenso sinnvoll sind die bestehenden Allow-Lists.

Beispielsweise werden bestimmte Werte nur akzeptiert, wenn sie aus einer bekannten Menge stammen:

```text
draft
published
archived
```

oder:

```text
event
interview
photo
announce
```

Das sollte auch bei zukünftigen Feldern so gemacht werden.

Zum Beispiel:

```text
role
content type
video source
media type
project status
visibility
```

niemals einfach beliebige Strings akzeptieren, wenn nur eine begrenzte Auswahl vorgesehen ist.

---

# 11. Uploads weiterhin streng validieren

Die bestehenden Upload-Prüfungen sind bereits sinnvoll aufgebaut.

Bilder werden nur in bestimmten Formaten akzeptiert.

Beispielsweise:

```text
JPEG
PNG
WebP
AVIF
```

Videos:

```text
MP4
WebM
OGG
```

Zusätzlich existieren Größenlimits.

Dieses Prinzip sollte beibehalten werden.

Wichtig ist jedoch:

Nur der vom Browser gesendete MIME-Type ist kein vollständiger Sicherheitsbeweis.

Langfristig könnte zusätzlich der tatsächliche Dateiinhalt beziehungsweise Magic Bytes geprüft werden.

Beispielsweise:

```text
PNG:
89 50 4E 47 ...

JPEG:
FF D8 FF ...

WebP:
RIFF....WEBP
```

Für Videos entsprechend Container-Signaturen.

Das ist aktuell kein dringender Punkt, wäre aber ein weiteres Hardening.

Uploads sollten außerdem niemals unter dem ursprünglichen Dateinamen gespeichert werden.

Das derzeitige Prinzip:

```text
crypto.randomUUID()
```

ist wesentlich besser.

Beispielsweise:

```text
550e8400-e29b-41d4-a716-446655440000.webp
```

statt:

```text
mein bild<script>.webp
```

---

# 12. Remote-Medien nur über Allowlist laden

Für Gallery-Inhalte können teilweise öffentliche Google-Drive-URLs verwendet werden.

Die aktuelle Lösung prüft bereits bestimmte erlaubte Google-Hosts.

Dieses Prinzip sollte beibehalten werden.

Nicht zulassen:

```text
Admin trägt irgendeine URL ein
        ↓
Worker lädt diese URL serverseitig
```

Ohne Host-Allowlist könnte daraus eine SSRF-Lücke entstehen.

Beispielsweise könnte ein Angreifer versuchen:

```text
http://127.0.0.1
http://localhost
http://169.254.169.254
```

oder interne Services aufzurufen.

Deshalb sollten externe Fetch-Funktionen immer eine feste Allowlist besitzen.

Der aktuelle Google-Drive-Ansatz ist dafür grundsätzlich richtig.

---

# 13. Turnstile-Konzept beibehalten

Das Kontaktformular verwendet Cloudflare Turnstile.

Dabei existieren unterschiedliche Site Keys für:

```text
localhost
Produktion
```

Der öffentliche Site Key darf im HTML stehen. Das ist kein Secret.

Das eigentliche Secret:

```text
TURNSTILE_SECRET
```

muss ausschließlich als Cloudflare Worker Secret gespeichert werden.

Es darf niemals in:

```text
GitHub
JavaScript
HTML
README
wrangler.jsonc
```

eingetragen werden.

Der Worker prüft zusätzlich nicht nur, ob Cloudflare `success` zurückgibt, sondern auch Dinge wie:

```text
Hostname
Action
```

Das ist sinnvoll.

Turnstile sollte weiterhin zusammen mit Rate Limiting und Honeypot verwendet werden.

Keiner dieser Mechanismen allein sollte als vollständiger Spam-Schutz betrachtet werden.

Gemeinsam ergibt sich:

```text
Honeypot
+
Field Validation
+
Origin Check
+
Rate Limit
+
Turnstile
+
Server Validation
```

Das ist eine gute Struktur.

---

# 14. Rate Limiting erweitern, falls nötig

Aktuell gibt es bereits ein Rate Limit für das Kontaktformular.

Beispielsweise ungefähr:

```text
5 Requests
pro 60 Sekunden
```

pro Client-Adresse und Formulartyp.

Das ist sinnvoll.

Später könnten zusätzliche Rate Limits für bestimmte APIs sinnvoll sein.

Besonders:

```text
Admin Login ist bereits über Access geschützt
Admin Upload
Media Upload
Slug Check
Contact
League Application
```

Öffentliche GET-Endpunkte brauchen normalerweise kein sehr aggressives Rate Limit, weil Cloudflare Cache und Edge bereits viel Last abfangen können.

Upload- und E-Mail-Endpunkte sollten dagegen besonders geschützt bleiben.

---

# 15. Secrets konsequent außerhalb des Repositories halten

Die bestehenden `.gitignore`-Regeln schützen bereits viele lokale Konfigurationsdateien.

Insbesondere:

```text
.dev.vars
.dev.vars.local
.env
.env.local
.wrangler/
```

dürfen nicht eingecheckt werden.

Die Datei:

```text
.dev.vars.example
```

darf dagegen existieren, solange dort ausschließlich Platzhalter stehen.

Zum Beispiel:

```text
TURNSTILE_SECRET=replace-me
ADMIN_DEV_TOKEN=replace-with-a-local-token
ACCESS_AUDIENCE=replace-me
```

Das ist korrekt.

Die echte Datei darf beispielsweise enthalten:

```text
TURNSTILE_SECRET=abc123...
ADMIN_DEV_TOKEN=...
ACCESS_AUDIENCE=...
```

aber niemals in Git landen.

Besonders beachten:

Ein Secret aus einem Git-Commit zu löschen reicht nicht aus.

Wenn ein Secret einmal committed und gepusht wurde, sollte es als kompromittiert betrachtet und rotiert werden.

Also:

```text
Secret versehentlich committed
        ↓
Secret sofort rotieren
        ↓
neues Secret setzen
        ↓
Git-History optional bereinigen
```

Nicht nur:

```text
Datei löschen
```

---

# 16. security.txt regelmäßig aktualisieren

Eine:

```text
/.well-known/security.txt
```

Datei ist bereits vorhanden.

Sie nennt unter anderem:

```text
Kontaktadresse
bevorzugte Sprachen
Canonical URL
Ablaufdatum
```

Das ist sinnvoll.

Das `Expires`-Datum sollte regelmäßig aktualisiert werden.

Beispielsweise einmal jährlich.

Es kann außerdem später sinnvoll sein, Informationen wie:

```text
Policy:
Acknowledgments:
Encryption:
```

zu ergänzen, wenn das Projekt größer wird.

Für den aktuellen Projektumfang ist die bestehende Variante jedoch vollkommen ausreichend.

---

# 17. Große und doppelte Assets später aufräumen

Im Repository befinden sich relativ viele große Bilddateien.

Teilweise existieren:

```text
PNG
RGBA PNG
Archive Copies
mehrere ähnliche Versionen
```

Das ist kein Sicherheitsproblem, führt aber langfristig zu:

```text
größerem Repository
langsameren Clones
größeren Deployments
unnötigem Speicherverbrauch
schwerer wartbarer Asset-Struktur
```

Langfristig sollte geprüft werden:

```text
Welche Datei wird tatsächlich benutzt?
Welche Datei ist Archiv?
Welche Datei kann gelöscht werden?
Welche Datei kann WebP oder AVIF werden?
```

Besonders große Hintergrundbilder könnten für die Website optimiert werden.

Zum Beispiel:

```text
PNG 2,8 MB
        ↓
WebP
        ↓
400–900 KB
```

oder:

```text
AVIF
```

je nach Qualitätsanforderung.

Nicht jedes Bild sollte allerdings blind konvertiert werden. Logos mit Transparenz und bestimmte Druckmaterialien haben andere Anforderungen als Website-Hintergründe.

---

# 18. Git-LFS bei zukünftigen großen Mediendateien prüfen

Sollten künftig größere:

```text
Videos
RAW-Bilder
PSD-Dateien
große Archive
```

im Repository gespeichert werden, sollte Git LFS geprüft werden.

Noch besser wäre allerdings, große Medien überhaupt nicht direkt in Git zu speichern, wenn R2 bereits vorhanden ist.

Für MIRoKIT wäre langfristig sinnvoll:

```text
GitHub
→ Code
→ Konfiguration
→ kleine statische Assets

R2
→ veröffentlichte Medien
→ Videos
→ große Bilder
→ Uploads
```

Damit bleibt das Repository übersichtlich.

---

# 19. Cloudflare R2 Lifecycle Rules einrichten

Pending-Dateien können entstehen, wenn ein Admin etwas hochlädt und danach den Vorgang abbricht.

Beispiel:

```text
Upload
   ↓
gallery/pending/uuid.webp
   ↓
Browser geschlossen
   ↓
Datei bleibt in R2
```

Damit sammeln sich langfristig verwaiste Dateien.

Deshalb sollten Lifecycle Rules existieren.

Beispielsweise:

```text
news/pending/*
gallery/pending/*
partners/pending/*
videos/pending/*
video-posters/pending/*
subtitles/pending/*
```

automatisch nach beispielsweise:

```text
24 Stunden
48 Stunden
7 Tagen
```

löschen.

Die genaue Zeit hängt davon ab, wie lange ein Admin einen Entwurf behalten können soll.

Für reine Upload-Zwischenablage wären beispielsweise 24 oder 48 Stunden ausreichend.

Wenn Draft-Medien länger benötigt werden, sollten Drafts nicht im `pending`-Ordner liegen.

Dann könnte man unterscheiden:

```text
pending/
draft/
published/
```

Pending:

```text
automatisch löschen
```

Draft:

```text
bleibt erhalten
aber privat
```

Published:

```text
öffentlich
und langfristig gespeichert
```

Das wäre langfristig die sauberste Architektur.

---

# 20. D1 Backup-Strategie festlegen

Da inzwischen ein Content Desk existiert, befindet sich ein Teil des MIRoKIT-Inhalts nicht mehr direkt im Git-Repository, sondern in D1.

Dadurch reicht ein Git-Backup allein nicht mehr.

Es sollte regelmäßig geprüft werden, wie D1 gesichert wird.

Wichtige Daten sind beispielsweise:

```text
News
Übersetzungen
World Points
Partner
Videos
Gallery Quotes
weitere redaktionelle Daten
```

Eine mögliche Strategie wäre:

```text
regelmäßiger D1 Export
        ↓
verschlüsseltes lokales Backup
        ↓
nicht öffentliches GitHub-Repository oder Backup-Speicher
```

Backups sollten nicht in das öffentliche MIRoKIT-Repository gelangen.

---

# 21. R2 Backup- beziehungsweise Recovery-Konzept definieren

Auch für R2 sollte klar sein:

Was passiert, wenn ein Admin versehentlich:

```text
Bild löschen
Video löschen
```

ausführt?

Aktuell existieren bereits Bestätigungsdialoge, was hilfreich ist.

Langfristig könnte zusätzlich überlegt werden:

```text
Soft Delete
```

beziehungsweise:

```text
trash/
```

statt sofortiger endgültiger Löschung.

Beispielsweise:

```text
gallery/image.webp
        ↓ löschen
trash/gallery/image.webp
        ↓
nach 30 Tagen endgültig löschen
```

Für sensible Inhalte kann eine sofortige Löschung allerdings gewünscht sein.

Daher sollte bewusst entschieden werden, welche Medien Soft-Delete verwenden und welche nicht.

---

# 22. Admin-Operationen langfristig protokollieren

Aktuell ist der Admin-Zugriff authentifiziert.

Wenn zukünftig mehrere Redakteure Zugriff erhalten, wird ein Audit Log sinnvoll.

Beispielsweise:

```text
2026-09-09 18:40
admin@example.com
published news:
international-dialog-2026
```

oder:

```text
admin@example.com
deleted gallery asset
gallery/uuid.webp
```

Dies könnte in einer D1-Tabelle gespeichert werden:

```sql
admin_audit_log
```

mit beispielsweise:

```text
id
timestamp
admin_email
action
resource_type
resource_id
metadata
```

Das ist aktuell noch kein Muss, wird aber sehr wertvoll, sobald mehr als eine Person den Content Desk benutzt.

---

# 23. Admin-API weiterhin immer serverseitig schützen

Ein sehr wichtiger Grundsatz:

Ein versteckter Button im Frontend ist keine Sicherheit.

Beispiel:

```js
deleteButton.hidden = true;
```

verhindert nicht, dass jemand direkt:

```http
DELETE /api/v1/admin/news/example
```

sendet.

Deshalb muss jede Admin-Route weiterhin serverseitig:

```text
authorizeAdmin()
```

verwenden.

Das gilt insbesondere für:

```text
POST
PUT
PATCH
DELETE
Uploads
Publish
Archive
```

Frontend-Schutz ist nur Benutzeroberfläche.

Worker-Schutz ist tatsächliche Sicherheit.

---

# 24. HTTP-Methoden streng einschränken

Jede Route sollte nur die Methoden akzeptieren, die wirklich vorgesehen sind.

Beispielsweise:

```text
GET /api/v1/news
POST /api/v1/admin/news
DELETE /api/v1/admin/news/:id
```

Nicht benötigte Methoden sollten:

```text
405 Method Not Allowed
```

zurückgeben.

Optional kann zusätzlich:

```text
Allow: GET, HEAD
```

gesetzt werden.

Damit wird das API-Verhalten klarer und vorhersehbarer.

---

# 25. API-Fehler nicht zu detailliert nach außen geben

Interne Fehler sollten im Worker geloggt werden.

Nach außen sollte der Nutzer jedoch möglichst keine sensiblen internen Informationen erhalten.

Nicht:

```text
SQLITE_ERROR table news_translations at line ...
```

sondern:

```json
{
  "success": false,
  "message": "Could not save the news item."
}
```

Intern:

```js
console.error(error);
```

Besonders wichtig sind:

```text
SQL Fehler
R2 interne Keys
Stack Traces
Secrets
Cloudflare interne Informationen
```

Diese sollten nicht im Response landen.

---

# 26. Cache-Konzept klar dokumentieren

Das Projekt verwendet inzwischen unterschiedliche Cache-Arten.

Daher sollte klar dokumentiert werden:

## HTML

```text
max-age=0
must-revalidate
```

## API

```text
kurze Cache-Zeit oder no-store
```

je nach Inhalt.

## Admin

```text
no-store
```

## Veröffentlichte UUID-Medien

```text
public
max-age=31536000
immutable
```

## Draft / Pending

```text
private
no-store
```

Diese Trennung verhindert viele spätere Probleme.

Besonders wichtig:

Eine Datei mit `immutable` sollte wirklich unveränderlich sein.

Wenn derselbe Dateipfad später einen anderen Inhalt erhält, können Browser oder CDN weiterhin die alte Datei verwenden.

Deshalb ist das bestehende UUID-Prinzip gut.

---

# 27. Datenschutz bei Kindern und Jugendlichen besonders beachten

Da MIRoKIT Inhalte mit Kindern und Jugendlichen beinhalten kann, sollte bei Medien wesentlich vorsichtiger gearbeitet werden als bei einer normalen Firmenwebsite.

Vor Veröffentlichung sollte klar sein:

```text
Darf das Bild veröffentlicht werden?
Liegt eine entsprechende Einwilligung vor?
Ist die Veröffentlichung zeitlich oder räumlich eingeschränkt?
Darf das Bild auf Social Media verwendet werden?
Darf es heruntergeladen werden?
```

Technisch bedeutet dies unter anderem:

Unveröffentlichte Medien dürfen nicht allein wegen einer unbekannten URL öffentlich sein.

Deshalb ist die Verbesserung des R2-Draft-Konzepts besonders wichtig.

---

# 28. Content Desk gegen versehentliche Aktionen absichern

Der aktuelle Admin-Bereich verwendet bereits Bestätigungsdialoge für Löschaktionen.

Das ist gut.

Weitere sinnvolle Schutzmechanismen wären:

```text
Publish:
Bestätigung bei erstmaliger Veröffentlichung

Delete:
DELETE oder УДАЛИТЬ eintippen

Archive:
einfache Bestätigung

Permanent Delete:
stärkere Bestätigung
```

Damit unterscheiden sich reversible und irreversible Aktionen.

Beispielsweise:

```text
Archivieren
→ leicht rückgängig

Löschen
→ endgültig
```

Das sollte auch visuell unterschiedlich dargestellt werden.

---

# 29. Preview-Modus für Drafts einführen

Wenn Draft-Medien zukünftig privat werden, braucht der Admin weiterhin eine Möglichkeit, Inhalte vor Veröffentlichung vollständig zu sehen.

Dafür wäre ein geschützter Preview-Modus sinnvoll.

Beispielsweise:

```text
/admin/preview/news/my-news
```

oder:

```text
/api/v1/admin/preview/news/my-news
```

Dieser Bereich wird über Cloudflare Access geschützt.

Der öffentliche Benutzer sieht:

```text
404
```

Der Admin sieht:

```text
vollständige Draft-News
inklusive Draft-Bild
```

Damit muss kein unveröffentlichter Inhalt öffentlich geschaltet werden, nur um ihn zu überprüfen.

---

# 30. GitHub Secrets und Cloudflare Secrets getrennt halten

Falls später GitHub Actions für Deployment verwendet werden, sollten Cloudflare-Credentials ausschließlich als GitHub Actions Secrets beziehungsweise Environment Secrets gespeichert werden.

Nicht:

```yaml
CLOUDFLARE_API_TOKEN: abc123
```

sondern:

```yaml
CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Noch besser wäre ein eigener Cloudflare API Token mit minimalen Rechten.

Nicht den Global API Key verwenden.

Prinzip:

```text
least privilege
```

also nur die Rechte vergeben, die der Workflow tatsächlich braucht.

---

# 31. GitHub Environments für Deployment verwenden

Wenn MIRoKIT später automatisch deployed wird, sollte ein GitHub Environment verwendet werden.

Beispielsweise:

```text
production
```

Dort können:

```text
Secrets
Environment Protection Rules
Required Reviewers
Deployment History
```

hinterlegt werden.

Dann könnte der Ablauf lauten:

```text
Pull Request
        ↓
Tests
        ↓
Merge master
        ↓
Deploy Job
        ↓
Production Environment Approval
        ↓
Cloudflare Deploy
```

Damit führt ein Merge nicht zwangsläufig sofort zu einer unkontrollierten Produktionsänderung.

---

# 32. Kein automatisches Deployment einführen, bevor CI stabil ist

Zuerst:

```text
CI
```

danach:

```text
CD
```

Nicht umgekehrt.

Also erst:

```text
Tests
Linting
Wrangler Dry Run
```

stabil machen.

Danach kann über automatisches Deployment nachgedacht werden.

Sonst würde ein Fehler automatisch schneller in Produktion gebracht.

---

# 33. README und Architektur-Dokumentation aktuell halten

Das Repository besitzt inzwischen bereits relativ ausführliche Architekturinformationen.

Das sollte beibehalten werden.

Besonders dokumentiert bleiben sollten:

```text
D1 Tabellen
R2 Struktur
API Routes
Admin Auth
Turnstile
Cloudflare Access
Domains
Deploy-Befehle
Secrets
Migrations
Backup
Cache
Media Lifecycle
```

Neue Entwickler oder zukünftige Administratoren sollten verstehen können:

```text
Welche Datei macht was?
Wo liegen Daten?
Was ist öffentlich?
Was ist privat?
Wie wird deployed?
Wie wird getestet?
```

ohne den gesamten Worker lesen zu müssen.

---

# 34. SECURITY.md ergänzen

Zusätzlich zur öffentlichen `security.txt` könnte im GitHub-Repository später eine:

```text
SECURITY.md
```

existieren.

Darin könnte stehen:

```text
Supported Versions
Reporting Security Issues
Do not disclose publicly
Contact
Response Process
```

Das wäre insbesondere sinnvoll, wenn andere Personen zukünftig Beiträge zum Repository leisten oder Sicherheitsprobleme melden sollen.

---

# 35. CONTRIBUTING-Regeln weiterhin verwenden

Die vorhandenen Contribution-Regeln sollten weiterhin klar sagen:

```text
keine Secrets committen
keine sensiblen Daten committen
Änderungen über Branches
Tests vor Commit
Deploy getrennt vom Push
```

Besonders wichtig ist der Unterschied:

```text
git push
```

ist nicht dasselbe wie:

```text
Cloudflare deploy
```

Diese Trennung sollte erhalten bleiben.

---

# 40. Commit-Nachrichten klar halten

Commit-Nachrichten sollten beschreiben, was tatsächlich geändert wurde.

Gut:

```text
Harden unpublished media access
```

```text
Add GitHub CI checks
```

```text
Refresh Cloudflare Access JWKS on key rotation
```

```text
Restrict production hostname allowlist
```

Schlecht:

```text
update
```

```text
fix
```

```text
changes
```

Eine saubere Commit-History wird besonders wichtig, wenn das Projekt weiter wächst.

---

# Empfohlene Reihenfolge der nächsten Arbeiten

Die Verbesserungen sollten nicht alle gleichzeitig in einen gigantischen Commit gepackt werden.

Eine sinnvolle Reihenfolge wäre:

## Phase 1 – Kritischer Datenschutz und Zugriffsschutz

Änderungen:

```text
Pending-Medien öffentlich blockieren
Draft-Medien privat machen
Media Cache korrigieren
Preview-Zugriff für Admin vorbereiten
```

Commit:

```text
Harden unpublished media access
```

---

## Phase 2 – GitHub Branch Protection

Repository Ruleset anpassen.

Ändern:

```text
n3koBomb:
always
```

zu:

```text
pull_request
```

Unnötige Repository-Role-Bypasses entfernen.

Merge-Methoden vorzugsweise:

```text
Squash
Rebase
```

---

## Phase 3 – CI und GitHub-Sicherheit

Hinzufügen:

```text
.github/workflows/ci.yml
.github/CODEOWNERS
.github/dependabot.yml
```

Aus `.gitignore` entfernen:

```text
.github/
```

Tests:

```text
node --check
git diff --check
npm test
wrangler deploy --dry-run
```

Anschließend CI als erforderlichen Statuscheck ins Ruleset aufnehmen.

Commit:

```text
Add repository security checks
```

---

## Phase 4 – Cloudflare Access Hardening

Änderungen:

```text
JWKS Cache TTL
Refresh bei unbekanntem kid
nbf prüfen
```

Commit:

```text
Improve Cloudflare Access key rotation handling
```

---

## Phase 5 – Hostname Hardening

Änderung:

```text
endsWith(".com")
endsWith(".ru")
```

ersetzen durch explizite Domain-Allowlist.

Commit:

```text
Restrict production hostname handling
```

---

## Phase 6 – CSP

Zuerst:

```text
Content-Security-Policy-Report-Only
```

Dann externe Ressourcen und mögliche Verstöße testen.

Inline-Styles soweit möglich aus HTML entfernen.

Danach:

```text
Content-Security-Policy
```

aktivieren.

Commit beispielsweise:

```text
Introduce Content Security Policy
```

---

## Phase 7 – Cloudflare Dashboard prüfen

Nicht alles kann aus GitHub geprüft werden.

Im Cloudflare Dashboard sollten zusätzlich überprüft werden:

```text
Access Application
Access Policies
Admin E-Mail-Allowlist
R2 Lifecycle Rules
D1 Bindings
R2 Bindings
Turnstile Secret
Email Binding
HSTS
TLS Mode
Custom Domains
Worker Routes
Secrets
```

Besonders wichtig:

```text
SSL/TLS → Full (strict)
```

beziehungsweise die für Cloudflare Custom Domains passende sichere Konfiguration.

Außerdem sicherstellen, dass keine unnötige:

```text
workers.dev
```

Produktions-URL öffentlich verwendet wird.

---

# Positiv am aktuellen Stand

Trotz der genannten Verbesserungen ist bereits vieles gut umgesetzt.

Besonders positiv sind:

```text
Cloudflare Access
+
JWT Signaturprüfung
+
Audience-Prüfung
+
Issuer-Prüfung
+
Expiration-Prüfung
+
Admin-E-Mail-Allowlist
```

Zusätzlich:

```text
Turnstile
+
Rate Limit
+
Origin Check
+
Honeypot
+
Serverseitige Feldvalidierung
```

Bei D1:

```text
Prepared Statements
+
gebundene Parameter
+
Allow-Lists
+
Längenlimits
```

Im Frontend:

```text
escapeHtml
+
textContent
+
HTTPS URL Validation
```

Bei Medien:

```text
UUID-Dateinamen
+
Dateigrößenlimits
+
begrenzte Dateitypen
+
R2 Pending Workflow
```

Im Repository:

```text
Branch Ruleset
security.txt
.gitignore
Tests
Architektur-Dokumentation
Contribution-Regeln
```

Die Basis ist daher bereits solide.

Das Hauptziel sollte jetzt nicht sein, die gesamte Architektur neu zu bauen.

Das Ziel sollte sein, die bestehende Architektur an einigen gezielten Stellen zu härten.

---

# Zusammenfassung

Die wichtigsten nächsten Schritte für MIRoKIT sind:

1. Unveröffentlichte R2-Medien dürfen nicht öffentlich erreichbar sein.
2. Pending- und Draft-Medien sollten `private, no-store` verwenden.
3. Erst veröffentlichte Medien sollten langfristig öffentlich gecacht werden.
4. Der eigene GitHub-Bypass sollte nicht dauerhaft `always` sein.
5. Änderungen an `master` sollten ausschließlich über Pull Requests laufen.
6. GitHub Actions sollte Tests automatisch vor jedem Merge ausführen.
7. `.github/` muss versioniert werden.
8. CODEOWNERS sollte verwendet werden.
9. Dependabot sollte Abhängigkeiten überwachen.
10. JWKS sollten bei unbekanntem `kid` neu geladen werden.
11. JWT-`nbf` kann zusätzlich geprüft werden.
12. Produktionsdomains sollten über eine explizite Allowlist erkannt werden.
13. CSP sollte zunächst als Report-Only eingeführt werden.
14. HSTS sollte im Cloudflare Dashboard überprüft werden.
15. Secrets dürfen niemals im Repository landen.
16. Sensible Medien dürfen niemals in das öffentliche GitHub-Repository gelangen.
17. R2 Pending-Dateien sollten über Lifecycle Rules automatisch bereinigt werden.
18. D1 und R2 benötigen langfristig ein Backup- und Recovery-Konzept.
19. Große Assets sollten später optimiert beziehungsweise aus Git ausgelagert werden.
20. Die vorhandene serverseitige Validierung, SQL-Parameterbindung und HTML-Escaping müssen konsequent beibehalten werden.

Nach diesen Änderungen wäre MIRoKIT nicht nur funktional deutlich ausgereifter, sondern hätte auch eine sehr vernünftige Grundlage für Sicherheit, Wartbarkeit und zukünftiges Wachstum.
