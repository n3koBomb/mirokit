# Architektur

Dieses Dokument beschreibt den implementierten Aufbau des Repositorys. Einstieg und Betriebsbefehle stehen in der [README](README.md), Regeln für Änderungen in [CONTRIBUTING.md](CONTRIBUTING.md).

## Laufzeit und Zuständigkeiten

`site/` ist der Document Root von Cloudflare Workers Static Assets. Die öffentliche Website besteht aus statischem HTML, CSS und JavaScript; redaktionelle Daten werden im Browser über APIs ergänzt. Es gibt keinen Frontend-Build und keine serverseitige UI-Rendering-Schicht.

Der Worker in `worker/` erhält durch `run_worker_first` ausgewählte Requests vor dem Asset-Dienst. Er verarbeitet APIs, den geschützten Admin-Bereich, R2-Medien und bestimmte Dokument-/SEO-Pfade. Übrige Dateien liefert das `ASSETS`-Binding aus.

| Modul | Verantwortung |
| --- | --- |
| `site/index.html` | Seitenstruktur, Formulare, Dialoge und statische Ausgangsinhalte |
| `site/source/style/style.css` | Öffentliches Layout, Komponenten, Themes und Breakpoints |
| `site/source/scripts/language.js` | RU/EN/DE-Wörterbücher und Text-/Attributübersetzungen |
| `site/source/scripts/news-data.js` | Gebündelte News einschließlich lokalisierter Modal-Inhalte |
| `site/source/scripts/main.js` | Navigation, Theme, News-/Galerie-/Partnerdarstellung, Dialoge und verzögertes Laden |
| `site/source/scripts/mirokit-world-map.js` | Canvas-Karte, Standortdaten und Länderübersicht |
| `site/source/scripts/contact-mail.js` | Formularzustand, Turnstile und Kontakt-API-Anfragen |
| `site/admin/index.html` | Redaktionsformulare und Bereichs-Tabs |
| `site/admin/admin.css` | Darstellung des Content Desk |
| `site/admin/admin.js` | Admin-API-Aufrufe, Uploads und Bearbeitungszustand |
| `worker/src/index.js` | Routing, API-Handler, Datenzugriff, Uploads, E-Mail und SEO |
| `worker/src/access.js` | Lokales Token sowie Access-JWT- und E-Mail-Prüfung |
| `worker/src/news.js` | News-Validierung, Abfragen und Datenabbildung |
| `worker/src/content.js` | World-/Partner-Validierung, Abfragen und Datenabbildung |
| `worker/src/index.test.js` | Worker-Verhalten und Datenverträge mit Test-Doubles |

Die öffentliche Seite lädt `language.js`, `news-data.js` und `main.js` in dieser Reihenfolge, anschließend das verzögert ausgeführte Formularskript. Das Kartenmodul wird bedarfsabhängig geladen; seine Geometrie verwendet externe D3-Geo-, TopoJSON- und World-Atlas-Ressourcen.

## Inhalte und Datenfluss

Die Redaktion öffnet `/admin/`. Das Admin-Skript sendet authentifizierte Anfragen an `/api/v1/admin/...`. Der Worker validiert sie und schreibt Datensätze in D1 beziehungsweise Bilder in R2. Öffentliche Browser lesen die veröffentlichten Inhalte über die Lese-APIs und rendern sie in die vorhandene Seite.

| Route | Aufgabe |
| --- | --- |
| `GET/HEAD /api/v1/news` | Veröffentlichte und zeitlich freigegebene News |
| `GET/HEAD /api/v1/gallery` | Veröffentlichte Gallery-Bilder und Zitate |
| `GET/HEAD /api/v1/videos` | Veröffentlichte Videos mit Postern und Untertiteln |
| `GET/HEAD /api/v1/world-points` | Veröffentlichte Kartenpunkte |
| `GET/HEAD /api/v1/partners` | Veröffentlichte Partner |
| `/api/v1/admin/news`, `/api/v1/admin/media` | News-Verwaltung und Bild-Uploads |
| `/api/v1/admin/gallery`, `/api/v1/admin/gallery/quotes` | Gallery-Bilder und Zitate verwalten |
| `/api/v1/admin/world-points` | Kartenpunkte verwalten |
| `/api/v1/admin/partners`, `/api/v1/admin/partners/media` | Partner und Logos verwalten |
| `GET/HEAD /media/v1/...` | R2-Medien wie Bilder, Videos und WebVTT ausliefern |
| `POST /api/v1/contact` | Kontaktformular und Liga-Antrag verarbeiten |

Die Verwaltungsrouten besitzen je nach Bereich zusätzliche ID-, Veröffentlichungs- oder Verfügbarkeitsrouten. Die implementierten Handler in `worker/src/index.js` sind die genaue Referenz für Methoden und Payloads.

### D1

- `0001_news.sql`: News und RU/EN/DE-Übersetzungen.
- `0002_gallery_quotes.sql`: Gallery-Zitate mit Übersetzungen.
- `0003_world_points_partners.sql`: World Points, Partner, Übersetzungen und Ausgangsdaten.
- `0004_videos.sql`: Videos, lokalisierte Metadaten und WebVTT-Untertitel.

News, World Points und Partner haben den Veröffentlichungsstatus `draft`, `published` oder `archived`. Bei World Points ist `hq`, `done` oder `planned` ein davon unabhängiger Kartenstatus. News speichern zusätzlich das Veröffentlichungsdatum; die öffentliche Abfrage vergleicht es mit dem aktuellen UTC-Datum.

Das News-Seed-Skript liest die gebündelten News, erzeugt SQL und führt Upserts aus. Ein erneuter Lauf kann bereits redigierte Daten mit denselben IDs überschreiben und erneut veröffentlichen. Es ist keine Synchronisation zwischen Backend und Frontend.

### R2 und statische Assets

`SITE_MEDIA` enthält hochgeladene News-Bilder, Gallery-Bilder und Partnerlogos. Gallery-Titel, Alt-Texte, Untertitel und Hervorhebung liegen in den Custom-Metadata der Bildobjekte; Gallery-Zitate liegen separat in D1.

Neue Uploads durchlaufen `news/pending/`, `gallery/pending/` oder `partners/pending/`. Beim erfolgreichen Speichern werden sie in den permanenten Bereich übernommen. Ablaufregeln für verwaiste Pending-Objekte werden separat am Bucket eingerichtet, siehe README.

Der Bucket hat keine hier konfigurierte direkte öffentliche Bucket-URL. Der Worker stellt jedoch passende Objektpfade über `/media/v1/` öffentlich bereit. **Diese Route prüft den Objektschlüssel, aber nicht den Veröffentlichungsstatus des zugehörigen Datensatzes; sie akzeptiert auch unterstützte Pending-Pfade.** Ein Entwurf oder ein privater Bucket ist daher keine Vertraulichkeitsgarantie für ein Bild mit bekannter URL. Die Auslieferung setzt zudem einen langen öffentlichen Cache. Vertrauliche Medien benötigen einen eigenen Zugriffsschutz und ein passendes Cache-Konzept.

Dateien in `site/public/assets/` sind dagegen Bestandteil des statischen Deployments. Marke, Hintergründe, Illustrationen, Fotos, Dokumente und Downloads sind nach Zweck geordnet. Favicons und Manifest liegen außerhalb von `assets/` unter `site/public/`. Siehe [Asset-Struktur](site/public/assets/README.md).

### Statische Ausgangsinhalte und leere Antworten

Die öffentliche Seite kann sofort mit gebündelten Inhalten starten. API-Fehler lassen diese bestehen. Erfolgreiche Antworten werden je Bereich unterschiedlich behandelt:

- News: Eine gültige Liste ersetzt die gebündelten News auch dann, wenn sie leer ist.
- Gallery: Das bestehende Raster wird abhängig von vorhandenen Bild-/Zitatdaten ergänzt beziehungsweise ersetzt.
- Partners: Eine leere Partnerliste ersetzt die statischen Partnergruppen nicht.
- World Points: Eine leere Liste lässt die eingebauten Kartenpunkte bestehen.

Damit ist das Archivieren sämtlicher Backend-Einträge nicht in jedem Bereich gleichbedeutend mit einer leeren öffentlichen Sektion. Änderungen an diesem Verhalten gehören gemeinsam in Backend- und Frontend-Review.

## Sprache, Darstellung und Laden

`language.js` übersetzt sichtbare Inhalte über `data-key` und Attribute über `data-i18n-attrs`. Der Sprachwechsel löst `mirokit:languagechange` aus, auf das dynamische Ansichten reagieren.

Die initiale Sprache folgt dem geöffneten Host: lokal Deutsch, auf `.ru` Russisch, auf `.com` je nach Gerätesprache Deutsch oder Englisch, sonst Englisch. Der derzeitige Initialisierungsweg liest die gespeicherte Sprachwahl nicht zur Wiederherstellung ein.

Der Hero zeigt eine News-Meldung auf einmal. Die drei neuesten verfügbaren Meldungen bilden die Auswahl; Feature-Ränge bestimmen ihre Reihenfolge. Die Hauptseite bleibt vertikal und responsiv. Themes, Navigation, Fokusführung und verzögertes Laden werden in den bestehenden Frontend-Modulen koordiniert.

`data-src`, `data-svg-src` und `data-deferred-background` ermöglichen bedarfsabhängiges Laden. Hintergrund-URLs werden vor der CSS-Zuweisung gegen `document.baseURI` aufgelöst. Sichtbare Inhalte sollen durch Viewport-Erkennung laden, ohne einen ersten Scrollschritt vorauszusetzen.

## Authentifizierung und Formulare

Produktive Admin-Seiten und Admin-APIs prüfen das von Cloudflare Access gelieferte JWT. Die Prüfung umfasst Signatur, Gültigkeit, Issuer, Audience und die konfigurierte E-Mail-Allowlist. Die Access-Anwendung muss die UI und die Admin-API-Pfade abdecken.

Auf `localhost` beziehungsweise `127.0.0.1` sind Admin-API-Anfragen mit `X-MiroKIT-Admin-Token` und dem passenden `ADMIN_DEV_TOKEN` möglich. Die lokale Admin-Seite selbst kann ohne Access geladen werden. Das Token wird vom Admin-Skript pro Browser-Sitzung gespeichert.

Beide öffentlichen Formulare verwenden `/api/v1/contact`. Der Worker prüft Origin, Formularfelder, Pflichtangaben, Honeypot, Rate-Limit und Turnstile und erzeugt Text-/HTML-E-Mails. Der Versand nutzt `CONTACT_EMAIL`, der Absender wird dem Website-Host zugeordnet und Antworten gehen über `Reply-To` an die angegebene Kontaktadresse. Lokal verwendet die Turnstile-Prüfung Test-Zugangsdaten; tatsächlicher E-Mail-Versand ist in `wrangler.local.jsonc` nicht gebunden.

## Routing, SEO und Cache

Die Produktionskonfiguration benennt vier MIRoKIT-Domains. Dokumentpfade werden innerhalb des geöffneten Hostnamens normalisiert. Canonical-, Sprachalternativen- und Social-Metadaten werden für unterstützte Dokumente angepasst; die Produktion routet auch `robots.txt` und `sitemap.xml` durch den Worker.

`site/_redirects` enthält zusätzlich statische Dokument- und Asset-Weiterleitungen. `site/_headers` definiert Header für statische Antworten. Admin- und sensible API-Antworten erhalten `no-store`; öffentliche Content-Antworten haben kurze Cache-Zeiten, R2-Bilder lange Cache-Zeiten.

`site/.assetsignore` schließt Archiv, Upload-Zwischenablage, Interviewtranskripte und Pressematerial aus dem Asset-Bundle aus. Die Produktionskonfiguration führt diese Pfade zusätzlich durch eine 403-Antwort im Worker. Öffentlich benötigte CSS-, JavaScript- und Bilddateien bleiben erreichbar.

Lokale und produktive Wrangler-Konfiguration unterscheiden sich bei Domains, E-Mail-Bindung und `run_worker_first`. Lokale Tests ersetzen deshalb keine Prüfung von Access, Versand und Routing in der Zielumgebung.
