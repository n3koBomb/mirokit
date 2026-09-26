# Architektur

Dieses Dokument beschreibt den implementierten Aufbau des Repositorys. Einstieg und Betriebsbefehle stehen in der [README](README.md), Regeln für Änderungen in [CONTRIBUTING.md](CONTRIBUTING.md).

## Laufzeit und Zuständigkeiten

`site/` ist der Document Root von Cloudflare Workers Static Assets. Die öffentliche Website besteht aus statischem HTML, CSS und JavaScript; redaktionelle Daten werden im Browser über APIs ergänzt. Es gibt keinen Frontend-Build und keine serverseitige UI-Rendering-Schicht.

Der Worker in `worker/` erhält durch `run_worker_first` ausgewählte Requests vor dem Asset-Dienst. Er verarbeitet APIs, den geschützten Admin-Bereich, R2-Medien und bestimmte Dokument-/SEO-Pfade. Übrige Dateien liefert das `ASSETS`-Binding aus.

| Modul | Verantwortung |
| --- | --- |
| `site/index.html` | Seitenstruktur, Formulare, Dialoge und statische Ausgangsinhalte |
| `site/source/style/style.css` | Öffentliches Layout, Komponenten, Themes und Breakpoints |
| `site/source/style/subpage.css` | Gemeinsamer responsiver Header für Gallery, News, Online Projects und Privacy Policy |
| `site/source/scripts/language.js` | RU/EN/DE-Wörterbücher und Text-/Attributübersetzungen |
| `site/source/scripts/news-data.js` | Gebündelte News einschließlich lokalisierter Modal-Inhalte |
| `site/source/scripts/main.js` | Navigation, Theme, News-/Projects-/Galerie-/Partnerdarstellung, Dialoge und verzögertes Laden |
| `site/source/scripts/mirokit-world-map.js` | Canvas-Karte, Standortdaten und Länderübersicht |
| `site/source/scripts/contact-mail.js` | Formularzustand, Turnstile und Kontakt-API-Anfragen |
| `site/admin/index.html` | Redaktionsformulare und Bereichs-Tabs |
| `site/admin/admin.css` | Darstellung des Content Desk |
| `site/admin/admin.js` | Admin-API-Aufrufe, Uploads und Bearbeitungszustand |
| `worker/src/index.js` | Routing, API-Handler, Datenzugriff, Uploads, E-Mail und SEO |
| `worker/src/access.js` | Lokales Token sowie Access-JWT- und E-Mail-Prüfung |
| `worker/src/media.js` | Veröffentlichungsprüfung, geschützte Vorschau, Cache und Byte-Ranges |
| `worker/src/hosts.js` | Explizite MIRoKIT-Hostnamen und Canonical-Zuordnung |
| `worker/src/remote-media.js` | Begrenzte Google-Drive-Imports mit geprüften Redirects |
| `worker/src/admin-methods.js` | Erlaubte HTTP-Methoden je Admin-Route |
| `worker/src/security-headers.js` | Report-Only-CSP für Worker-Antworten |
| `site/admin/media-preview.js` | Authentifizierte Medienvorschau, lokal mit Blob-URLs |
| `site/source/scripts/subpage.js` | Theme-Synchronisierung des Privacy-Policy-Headers ohne Landingpage-Bootstrap |
| `worker/src/news.js` | News-Validierung, Abfragen und Datenabbildung |
| `worker/src/content.js` | World-/Partner-Validierung, Abfragen und Datenabbildung |
| `worker/src/*.test.js` | Datenverträge, SQLite-Abfragen, Zugriffsgrenzen, JWTs und Vorschauverhalten |

Die öffentliche Seite lädt `language.js`, `news-data.js` und `main.js` in dieser Reihenfolge, anschließend das verzögert ausgeführte Formularskript. Das Kartenmodul wird bedarfsabhängig geladen; seine Geometrie verwendet externe D3-Geo-, TopoJSON- und World-Atlas-Ressourcen.

## Inhalte und Datenfluss

Die Redaktion öffnet `/admin/`. Das Admin-Skript sendet authentifizierte Anfragen an `/api/v1/admin/...`. Der Worker validiert sie und schreibt Datensätze in D1 beziehungsweise Bilder in R2. Öffentliche Browser lesen die veröffentlichten Inhalte über die Lese-APIs und rendern sie in die vorhandene Seite.

| Route | Aufgabe |
| --- | --- |
| `GET/HEAD /api/v1/news` | Veröffentlichte und zeitlich freigegebene News |
| `GET/HEAD /api/v1/gallery` | Veröffentlichte Gallery-Bilder und Zitate |
| `GET/HEAD /api/v1/videos` | Veröffentlichte Videos mit Postern und Untertiteln |
| `GET/HEAD /api/v1/interviews` | Veröffentlichte Interview-Videos und Materialien aus getrennten Beständen |
| `GET/HEAD /api/v1/projects` | Veröffentlichte Projekte mit berechneter Current/Upcoming/Past-Phase |
| `GET/HEAD /api/v1/world-points` | Veröffentlichte Kartenpunkte |
| `GET/HEAD /api/v1/partners` | Veröffentlichte Partner |
| `/api/v1/admin/news`, `/api/v1/admin/media` | News-Verwaltung und Bild-Uploads |
| `/api/v1/admin/gallery`, `/api/v1/admin/gallery/quotes` | Gallery-Bilder und Zitate verwalten |
| `POST /api/v1/admin/gallery/publish` | Bis zu 100 Pending-Gallery-Schlüssel gesammelt in ihre Ordner verschieben und als veröffentlicht markieren |
| `PATCH /api/v1/admin/gallery/<encoded-key>` | Einem vorhandenen Online-Projekte-Bild ein Thema zuweisen |
| `/api/v1/admin/interviews/videos` | Interview-Videos unabhängig vom normalen Video-/Gallery-Bestand verwalten und veröffentlichen |
| `/api/v1/admin/interviews/materials` | Dokumente, Prospekte, Formulare und Anfragen mit R2-/HTTPS-Quelle verwalten und veröffentlichen |
| `/api/v1/admin/world-points` | Kartenpunkte verwalten |
| `/api/v1/admin/partners`, `/api/v1/admin/partners/media` | Partner und Logos verwalten |
| `GET/HEAD /media/v1/...` | Nur aktuell veröffentlichte R2-Medien ausliefern |
| `GET/HEAD /api/v1/admin/media/...` | Authentifizierte Vorschau einschließlich Pending, Draft und Archiv |
| `POST /api/v1/contact` | Kontaktformular und Liga-Antrag verarbeiten |

Die Verwaltungsrouten besitzen je nach Bereich zusätzliche ID-, Veröffentlichungs- oder Verfügbarkeitsrouten. Die implementierten Handler in `worker/src/index.js` sind die genaue Referenz für Methoden und Payloads.

### D1

- `0001_news.sql`: News und RU/EN/DE-Übersetzungen.
- `0002_gallery_quotes.sql`: Gallery-Zitate mit Übersetzungen.
- `0003_world_points_partners.sql`: World Points, Partner, Übersetzungen und Ausgangsdaten.
- `0004_videos.sql`: Videos, lokalisierte Metadaten und WebVTT-Untertitel.
- `0005_projects.sql`: Projekte, Zeiträume, lokalisierte Metadaten und optionale Bild-/Link-Verweise.
- `0006_gallery_quote_folders.sql` und `0007_news_links.sql`: spätere Gallery-/News-Erweiterungen.
- `0008_interviews.sql`: Video-Collection `interviews` sowie Materialien und RU/EN/DE-Übersetzungen für Dokumente, Prospekte, Formulare und Anfragen.

News, World Points, Partner und Projects haben den Veröffentlichungsstatus `draft`, `published` oder `archived`. Bei World Points ist `hq`, `done` oder `planned` ein davon unabhängiger Kartenstatus. News speichern zusätzlich das Veröffentlichungsdatum; die öffentliche Abfrage vergleicht es mit dem aktuellen UTC-Datum. Projects speichern `startDate` und optional `endDate`; `endDate < heute` wird in der API als `phase: "past"` ausgegeben. Die Redaktion kann ein Projekt zuerst als Entwurf anlegen und vor der Veröffentlichung alle drei Sprachversionen, Zeitraum und Bild prüfen.

Das News-Seed-Skript liest die gebündelten News, erzeugt SQL und führt Upserts aus. Ein erneuter Lauf kann bereits redigierte Daten mit denselben IDs überschreiben und erneut veröffentlichen. Es ist keine Synchronisation zwischen Backend und Frontend.

### R2 und statische Assets

`SITE_MEDIA` enthält hochgeladene News-Bilder, Gallery-Bilder, Partnerlogos, Projektbilder, Videos, Poster, WebVTT-Dateien und Interview-Materialien. Gallery-Titel, Alt-Texte, Untertitel und Hervorhebung liegen in den Custom-Metadata der Bildobjekte; Gallery-Zitate, Project-Metadaten und Interview-Metadaten liegen separat in D1. Interview-Videos nutzen die `videos`-Tabelle mit `collection = 'interviews'`; Dokumente, Prospekte, Formulare und Anfragen liegen in `interview_materials` mit eigener Übersetzungstabelle. Projektbilder werden zunächst unter `projects/pending/` gespeichert und beim Entwurf-/Veröffentlichungsspeichern nach `projects/` promoted.

Normale Gallery-Bilder verwenden optional `folder_slug`, `folder_title` und `folder_subtitle` in R2-Custom-Metadata. Mehrere Admin-Dateien bleiben zunächst unter `gallery/pending/<folder-slug>/`; die explizite Publish-Route setzt `status=published` und verschiebt sie nach `gallery/<folder-slug>/`. Die öffentliche Gallery-API liefert daraus neben `gallery` auch gruppierte `folders` mit Bildlisten. Pending-Schlüssel dürfen nur im authentifizierten Admin-Bereich als Vorschau geladen werden.

Online-Projekte verwenden weiterhin `collection=online-projects` und eines der zehn validierten `topic`-Kennzeichen in den R2-Metadaten. Startseiten-Links öffnen `/page/onlineProjects/index.html?topic=<thema>`; die Unterseite lädt die Sammlung und filtert sie im Browser. Bilder erscheinen mit ihren natürlichen Seitenverhältnissen in einem Masonry-Raster. Bilder ohne bisherige Zuordnung bleiben unter „Alle Themen“ sichtbar und können im eigenen Admin-Tab nachträglich zugeordnet werden. Die Themenkennzeichen sind in `site/source/scripts/online-project-topics.js` für Worker, Admin und Galerieseite gemeinsam definiert.

Neue Uploads durchlaufen den jeweiligen `pending/`-Bereich. Beim Speichern werden sie in den permanenten Bereich übernommen, auch bei Entwürfen. Neue WebVTT-Inhalte erhalten bei jedem Speichern einen neuen UUID-Schlüssel. Ablaufregeln dürfen nur verwaiste Pending-Objekte betreffen, nicht gespeicherte Entwürfe; siehe README.

`/media/v1/` blockiert Pending-Pfade grundsätzlich. Permanente Gallery-Objekte benötigen ausdrücklich `status=published` in den R2-Metadaten. Andere unterstützte Objekte benötigen eine aktuell veröffentlichte Referenz in D1 (News-Bild, Partnerlogo, Video, Poster, Untertitel oder Interview-Material); bei News muss außerdem das UTC-Veröffentlichungsdatum erreicht sein. Relative Medienpfade und absolute HTTPS-Pfade auf den acht bekannten Site-Hostnamen werden berücksichtigt. Solange ein Objekt von einem anderen veröffentlichten Datensatz verwendet wird, bleibt es öffentlich. Unbekannter Status und Speicherfehler geben keine Datei frei.

Vorschauen laufen separat über `/api/v1/admin/media/<key>` mit derselben JWT-/E-Mail-Prüfung wie die übrigen Admin-APIs. Lokal fordert das Admin-Skript die Bytes mit dem lokalen Token an und erzeugt Blob-URLs für Bilder und Videos; das Token steht nie in der URL. Produktiv laden Medienelemente direkt vom Access-geschützten Preview-Endpunkt und behalten die Range-Unterstützung. Externe HTTPS-Medien und statische Assets werden dadurch nicht privat.

R2-Schreibvorgänge verwenden `private, no-store`. Der öffentliche Worker-Endpunkt setzt nach erfolgreicher Statusprüfung `public, max-age=0, must-revalidate`; Preview und Fehler bleiben `private, no-store`. Auch vor einer `304`-Antwort wird die Veröffentlichung geprüft. So kann eine Archivierung weitere Abrufe sperren. Bereits heruntergeladene oder nach der früheren Jahres-Cache-Policy gespeicherte Kopien lassen sich damit nicht zurückholen. Direkte öffentliche R2-Bucket-URLs würden diese Kontrollen umgehen und müssen separat ausgeschlossen werden.

Dateien in `site/public/assets/` sind dagegen Bestandteil des statischen Deployments. Marke, Hintergründe, Illustrationen, Fotos, Dokumente und Downloads sind nach Zweck geordnet. Favicons und Manifest liegen außerhalb von `assets/` unter `site/public/`. Siehe [Asset-Struktur](site/public/assets/README.md).

### Statische Ausgangsinhalte und leere Antworten

Die öffentliche Seite kann sofort mit gebündelten Inhalten starten. API-Fehler lassen diese bestehen. Erfolgreiche Antworten werden je Bereich unterschiedlich behandelt:

- News: Eine gültige Liste ersetzt die gebündelten News auch dann, wenn sie leer ist.
- Gallery: `/page/gallery/` lädt Ordner und Fotos über `/api/v1/gallery?collection=gallery` und Videos bei Bedarf über `/api/v1/videos`. Die Startseite enthält nur verlinkte Vorschaukarten. Vier gebündelte Archivbilder bleiben bei leerer Fotoliste oder API-Fehler verfügbar und werden als Archiv gekennzeichnet; Fehler zeigen zusätzlich eine Wiederholen-Aktion. Leere Videolisten zeigen einen Leerzustand. Die Ordneransicht unterstützt URL-Status über `folder=<slug>`, Zurück zur Ordnerübersicht, Suche, Sortierung und weiterhin den nativen Medien-Dialog.
- Partners: Eine leere Partnerliste ersetzt die statischen Partnergruppen nicht.
- World Points: Eine leere Liste lässt die eingebauten Kartenpunkte bestehen.

Damit ist das Archivieren sämtlicher Backend-Einträge nicht in jedem Bereich gleichbedeutend mit einer leeren öffentlichen Sektion. Änderungen an diesem Verhalten gehören gemeinsam in Backend- und Frontend-Review.

## Sprache, Darstellung und Laden

Die eigenständige Galerie liegt in `site/page/gallery/` (`index.html`, `gallery.css`, `gallery.js`). `view=photos|video`, `folder`, `q`, `sort=featured|newest|title` und `lang=ru|en|de` bilden den teilbaren Ansichtsstatus. Filter und Sortierung arbeiten mit den lokalisierten Metadaten; jeweils 24 Karten werden angezeigt. Der native Dialog unterstützt Fokus-Rückgabe, Escape, Foto-Pfeiltasten und Wischgesten. Videos verwenden native HTML5-Steuerung mit WebVTT oder einen beim Öffnen geladenen YouTube-No-Cookie-Embed. Schließen und Medienwechsel beenden die Wiedergabe. Die öffentlichen Video-Antworten enthalten `createdAt`/`updatedAt` für die Sortierung. D1-/R2-Bindings, Admin-Endpunkte und der Veröffentlichungsschutz bleiben bestehen; Gallery-Ordner benötigen keine D1-Migration.

Die eigenständige Interview-Seite liegt in `site/page/interviews/` (`index.html`, `interviews.css`, `interviews.js`). Gespräche verwenden bewusst einen getrennten Endpunkt `/api/v1/interviews` und greifen nicht auf den normalen Video-Bestand `/api/v1/videos` zu. Der Materialbereich hat eigene Tabs für Dokumente, Prospekte, Formulare und Anfragen und ersetzt die statischen Platzhalter, sobald veröffentlichte Admin-Materialien vorhanden sind. Der Content Desk hat dafür den Interview-Tab mit getrennten Untertabs für Videos und Materialien; noch nicht veröffentlichte Dateien werden nicht als öffentliche Inhalte vorgetäuscht.

`language.js` übersetzt sichtbare Inhalte über `data-key` und Attribute über `data-i18n-attrs`. Der Sprachwechsel löst `mirokit:languagechange` aus, auf das dynamische Ansichten reagieren.

Die initiale Sprache folgt dem geöffneten Host: lokal Deutsch, auf `.ru` Russisch, auf `.com` je nach Gerätesprache Deutsch oder Englisch, sonst Englisch. Der derzeitige Initialisierungsweg liest die gespeicherte Sprachwahl nicht zur Wiederherstellung ein.

Der Hero zeigt eine News-Meldung auf einmal. Die drei neuesten verfügbaren Meldungen bilden die Auswahl; Feature-Ränge bestimmen ihre Reihenfolge. Die Hauptseite bleibt vertikal und responsiv. Themes, Navigation, Fokusführung und verzögertes Laden werden in den bestehenden Frontend-Modulen koordiniert.

`data-src`, `data-svg-src` und `data-deferred-background` ermöglichen bedarfsabhängiges Laden. Hintergrund-URLs werden vor der CSS-Zuweisung gegen `document.baseURI` aufgelöst. Sichtbare Inhalte sollen durch Viewport-Erkennung laden, ohne einen ersten Scrollschritt vorauszusetzen.

## Authentifizierung und Formulare

Produktive Admin-Seiten und Admin-APIs prüfen das von Cloudflare Access gelieferte JWT. Die Prüfung umfasst Signatur, Ablaufzeit, einen vorhandenen `nbf`-Claim, Issuer, Audience und die konfigurierte E-Mail-Allowlist. JWKS werden höchstens eine Stunde gecacht; bei unbekanntem `kid` wird erneut geladen, mit 30 Sekunden Mindestabstand zwischen Abrufen zum Schutz vor wiederholten unbekannten Schlüsseln. Gleichzeitige Abrufe teilen ein Promise; fehlgeschlagene Abrufe werden nicht dauerhaft gecacht. Die Access-Anwendung muss die UI und die Admin-API-Pfade abdecken.

Auf `localhost` beziehungsweise `127.0.0.1` sind Admin-API-Anfragen mit `X-MiroKIT-Admin-Token` und dem passenden `ADMIN_DEV_TOKEN` möglich. Die lokale Admin-Seite selbst kann ohne Access geladen werden. Das Token wird vom Admin-Skript pro Browser-Sitzung gespeichert.

Beide öffentlichen Formulare verwenden `/api/v1/contact`. Der Worker prüft Origin, Formularfelder, Pflichtangaben, Honeypot, Rate-Limit und Turnstile und erzeugt Text-/HTML-E-Mails. Der Versand nutzt `CONTACT_EMAIL`, der Absender wird dem Website-Host zugeordnet und Antworten gehen über `Reply-To` an die angegebene Kontaktadresse. Lokal verwendet die Turnstile-Prüfung Test-Zugangsdaten; tatsächlicher E-Mail-Versand ist in `wrangler.local.jsonc` nicht gebunden.

## Routing, SEO und Cache

Die Produktionskonfiguration benennt vier MIRoKIT-Domains. Dokumentpfade werden innerhalb des geöffneten Hostnamens normalisiert. Canonical-, Sprachalternativen- und Social-Metadaten werden für unterstützte Dokumente angepasst; die Produktion routet auch `robots.txt` und `sitemap.xml` durch den Worker.

`site/_redirects` enthält zusätzlich statische Dokument- und Asset-Weiterleitungen. `site/_headers` definiert Header für statische Antworten. Admin- und sensible API-Antworten erhalten `no-store`; öffentliche Content-Antworten haben kurze Cache-Zeiten. R2-Medien verlangen eine erneute Veröffentlichungsprüfung vor Wiederverwendung. Die Report-Only-CSP wird sowohl in `_headers` als auch im Worker gesetzt. Sie protokolliert Verstöße in der Browser-Konsole und blockiert noch nichts; ein zentraler Report-Endpunkt ist nicht eingerichtet. Inline-Styles bleiben vorerst erlaubt, Inline-JavaScript muss vor einer späteren Erzwingung geprüft werden.

`site/.assetsignore` schließt Archiv, Upload-Zwischenablage, Interviewtranskripte und Pressematerial aus dem Asset-Bundle aus. Die Produktionskonfiguration führt diese Pfade zusätzlich durch eine 403-Antwort im Worker. Öffentlich benötigte CSS-, JavaScript- und Bilddateien bleiben erreichbar.

Lokale und produktive Wrangler-Konfiguration unterscheiden sich bei Domains, E-Mail-Bindung und `run_worker_first`. Lokale Tests ersetzen deshalb keine Prüfung von Access, Versand und Routing in der Zielumgebung.
