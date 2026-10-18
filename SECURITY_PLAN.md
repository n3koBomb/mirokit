# MIRoKIT: Sicherheitsstand und offene Arbeiten

Stand: **18. Oktober 2026**. Dieses Dokument ersetzt den früheren, teils bereits umgesetzten Maßnahmenentwurf durch einen Abgleich mit dem lokalen Quellcode. Es ist kein Produktionsaudit. Die [Bestandsaufnahme](docs/repository-audit.md) enthält konkrete reproduzierte Fehler; der private Meldeweg steht in [SECURITY.md](SECURITY.md).

## Umgesetzte Kontrollen

| Bereich | Implementierter Stand | Referenz |
| --- | --- | --- |
| Admin-Identität | RS256, Issuer, Audience, endliche Ablaufzeit, optionales numerisches `nbf`, E-Mail-Allowlist | `worker/src/access.js` |
| Schlüsselrotation | Eine Stunde JWKS-TTL, unbekannter `kid` löst begrenzten Refresh aus, 30 Sekunden Abstand, geteiltes Promise, fünf Sekunden Fetch-Timeout | `access.js`, `access.test.js` |
| Lokaler Zugang | Header-Token nur auf localhost/127.0.0.1; kein Produktions-Bypass | `access.js` |
| Admin-Methoden | Deklarierte Content-Routen liefern nach Authentifizierung `405/Allow` oder `404`; Schreib-Origin wird geprüft, wenn vorhanden | `admin-methods.js`, Content-Handler |
| Veröffentlichung | Pending gesperrt; Gallery nur mit explizitem Status, andere Medien mit veröffentlichter D1-/R2-Referenz | `media.js`, `online-project-media.js` |
| Widerrufbarer Mediencache | Öffentliche Bytes revalidieren; Statusprüfung vor `304`; Vorschauen/Fehler privat | `media.js` |
| Admin-Vorschau | Geschützter Endpunkt, lokaler Header-/Blob-Weg; bekannter Pending-URL-Fehler offen | `site/admin/media-preview.js` |
| Drive-Import | HTTPS-/Host-/Port-/Credentials-Prüfung pro Hop, Redirectgrenze, Timeout und begrenztes Streamlesen | `remote-media.js` |
| Validierung | Gebundene SQL-Parameter, Enums, Text-/Dateigrößen, Pflichtübersetzungen und bekannte Dateipfade | Domänenmodule und Upload-Handler |
| Online-Video/PDF | Signaturprüfung für PDF/Video/Thumbnail, JSON-Status, ETag-Konflikte, Bereinigung partieller Uploads | `online-project-media.js` |
| Kontakt | Exakte Origins, getrennte Formularfelder, Pflichtangaben, Honeypot, Turnstile und Rate-Limit | `index.js` |
| Eingangsbestätigung | Separate Mailbindung, feste lokalisierte Texte, keine eingegebenen Inhalte, Fehler vom Formularerfolg getrennt | `contact-receipt.js` |
| Statistik | Keine IPs, Querystrings, Roh-User-Agents oder Besucher-IDs gespeichert; Details/Diagnosen geschützt und zeitlich begrenzt | `status.js` |
| Hostnamen | Exakte acht Hostzuordnungen statt pauschaler Domain-Endungen für Produktionslogik | `hosts.js` |
| Header | `nosniff`, Referrer-/Permissions-Policy, Report-Only-CSP; statische Header separat | `security-headers.js`, `site/_headers` |
| Repository | CI, CODEOWNERS, Dependabot und lokale Secret-/Runtime-Ignore-Regeln vorhanden | `.github/`, `.gitignore` |

Nicht jeder Upload führt dieselbe Inhaltsprüfung aus: Die Dateisignaturprüfung der Online-Medien darf nicht als Prüfung sämtlicher klassischen News-, Gallery-, Video- oder Interview-Uploads beschrieben werden. Dateityp-/Größenprüfung ist kein Malware-Scanner.

## Offene lokale Fehler

Die fünf im [Audit](docs/repository-audit.md#konkrete-offene-befunde) dokumentierten Befunde sind nicht durch diese Dokumentationsänderung behoben:

1. Pending-Gallery-Preview-URLs kodieren Pfadtrenner und erreichen die erwartete Medienauflösung nicht.
2. Die Admin-Abfrage für Interview-Materialien selektiert den Veröffentlichungsstatus nicht.
3. JSON `null` kann den Kontakt-Handler vor der strukturierten Fehlerantwort abbrechen.
4. Projects akzeptiert protokollrelative Links als vermeintlich lokale Pfade.
5. Zwei statisch verwendete Sprachschlüssel fehlen im russischen Wörterbuch; neue Player-Labels sind außerdem nicht durchgehend lokalisiert.

Jeden Fix mit einem passenden Regressionstest prüfen; dabei vorhandene Inhalte, UI-Verträge und Zugriffsschutz erhalten. Die bestehende grüne Testsuite ersetzt diese fehlenden Fälle nicht.

## Speicher und Cache

Konventionelle Uploads werden beim Speichern teilweise bereits aus `pending/` promoted, obwohl der Datensatz Entwurf bleibt. Die öffentliche Route prüft deshalb den Status, nicht nur den Objektnamen. Eine Datei bleibt öffentlich, solange mindestens eine gültige veröffentlichte Referenz darauf zeigt.

Normale Gallery-Fotos bleiben bis zum expliziten Publish unter `gallery/pending/<slug>/`; maximal 100 Schlüssel pro Batch. R2-Batch-Publish und Reorder sind nicht transaktional. ETag-Schutz erkennt bestimmte konkurrierende Änderungen, rollt bereits erfolgreiche Writes aber nicht zurück.

Online-Dateien und Vorschauen liegen dauerhaft außerhalb von Pending; ihr JSON-Datensatz entscheidet über den Zugriff. Archivieren löscht die Bytes nicht. JSON, Datei und Vorschaubild müssen bei Backups gemeinsam berücksichtigt werden.

Öffentliche R2-Bytes setzen `public, max-age=0, must-revalidate`; Vorschau und Fehler `private, no-store`. Klassische Writes setzen private Cache-Metadaten. Online-Medien-Writes setzen derzeit nur Content-Type und verlassen sich bei der Auslieferung auf den Worker. Bereits heruntergeladene Dateien und alte Cache-Kopien können nicht zurückgerufen werden.

## Account-Prüfungen vor einer Freigabe

Diese Arbeiten wurden im Dokumentationsaudit nicht ausgeführt. Konfigurationsdateien sind keine Bestätigung des tatsächlichen Account-Zustands.

| Ziel | Prüfung |
| --- | --- |
| GitHub | Pflichtcheck `mirokit-ci`, Rulesets, Reviewpflicht, Bypasses und wirksame CODEOWNERS-Rechte |
| Build-Integration | Prüfen, ob ein Push durch externe Workers Builds oder andere Automation deployt |
| Access | `/admin`, `/admin/*`, `/api/v1/admin/*` auf jedem erreichbaren Host abdecken; Team, Audience und E-Mail-Allowlist vergleichen |
| R2 | Direkte öffentliche Bucket-URLs und alternative ungeschützte Auslieferung ausschließen |
| D1 | Ziel-ID, zehn Migrationen, Berechtigungen und Wiederherstellungsweg prüfen |
| Mail | Beide Absenderdomains, Bindungsrechte, Moderationsziel, Besucherempfänger und echte Zustellung prüfen |
| Turnstile | Sitekey, erlaubte Domains, Secret, erwartete Action und Hostname prüfen |
| Domains | Apex-/www-Erreichbarkeit, Custom Domains, Worker-first-Pfade und Preview-URLs prüfen |
| TLS/HSTS | Erst tatsächlich verwendete Hosts und Routing verstehen, danach Änderungen bewerten |
| Secrets | Zielumgebung und Zugriffsrechte prüfen; keine lokalen Werte als Produktionsnachweis behandeln |

HSTS mit Subdomains oder Preload ist keine pauschale Reparatur für Routing-/Origin-Fehler. Es wurde kein TLS- oder DNS-Zustand live verifiziert.

## Lifecycle und Recovery

Als gesondert zu prüfende Lifecycle-Kandidaten kommen ausschließlich verwaiste Pending-Präfixe infrage:

```text
news/pending/
gallery/pending/
partners/pending/
projects/pending/
videos/pending/
video-posters/pending/
subtitles/pending/
interview-materials/pending/
```

Ein möglicher Betriebsentwurf ist eine Ablaufzeit von einem Tag; das ist weder eine eingerichtete Regel noch eine bestätigte Projektvorgabe. Ablaufzeiten mit dem Redaktionsworkflow abstimmen. Keine pauschale Löschregel für permanente Entwürfe oder `online-projects/files/`, `previews/`, `records/` setzen. Unvollständige Multipart-Uploads sind ein eigener Regelfall. Siehe [R2 Object Lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

Vor Backup-Automation Verantwortliche, zulässigen Datenverlust, Wiederherstellungszeit und Retention festlegen. D1, R2-Bytes, HTTP-/Custom-Metadaten und JSON-Manifeste gemeinsam sichern; Gallery-Übersetzungen und Veröffentlichung liegen teilweise nur in Metadaten. Backups gehören verschlüsselt und zugriffsbeschränkt außerhalb des Repositorys.

Restore zuerst in isolierter D1-Datenbank und privatem Bucket testen. Referenzen, Medieninhalte, Übersetzungen, Draft-/Published-/Archived-Zugriff und Statistik prüfen. Ein vorhandenes Backup ohne erfolgreichen Wiederherstellungstest ist kein Recovery-Nachweis. Keine produktiven Exporte oder Wiederherstellungen wurden ausgeführt.

## Weitere Erweiterungen

- CSP-Verstöße in echten Browsern prüfen, bevor Erzwingung oder ein Report-Sammler eingeführt wird.
- Upload-Signatur-/Containerprüfung gezielt auf klassische Medienwege erweitern.
- Bei nachgewiesenem Bedarf zusätzliche Admin-/Upload-Rate-Limits und eine angemessene Audit-Historie entwerfen.
- Statische/private Medienrechte, Einwilligungen und rechtliche Platzhalter redaktionell klären.
- Vollständige Git-Historie und Dependency-Sicherheitslage gegebenenfalls separat prüfen; dieser Audit enthält keinen vollständigen Secret-/CVE-Scan.
- Asset-Größen, Duplikate und Hostingstrategie mit vorhandenen URLs und Rechten abstimmen; keine automatische Löschung.

## Prüfstand

Lokale Node-/SQLite-Suite: **578 Tests in 19 Dateien**. Alle 15 Worker-Laufzeitmodule besitzen eigene Testdateien. Die Tests prüfen unter anderem SQL gegen reale Migrationen, signierte JWTs, Veröffentlichungsgrenzen, Methoden, Uploads, Konflikte und Statuszählung. Sie beweisen keine vollständige Pfadabdeckung.

Aktuelle Prüfergebnisse und Einschränkungen: [Repository-Audit](docs/repository-audit.md#prüfnachweise). Ältere Browser-Screenshots bleiben historische Artefakte. Keine Account-Konfiguration, kein Deployment und keine Produktionsfreigabe wurden aus diesem Dokument abgeleitet.
