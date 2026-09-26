# MIRoKIT

MIRoKIT ist die Website und Redaktionsplattform eines internationalen, kulturell-spielerischen Projekts für Kinder und Jugendliche. Spiel, Kreativität, Dialog und Teamarbeit verbinden Menschen über Sprach- und Ländergrenzen hinweg.

Die Website, ihre Projektidentität und die projektspezifischen Inhalte sind **initiative-erLeben** zugeordnet. Die technische Konzeption, Gestaltung und Weiterentwicklung erfolgen in einem eigenständigen Produktionsprozess. Maßgeblich für Nutzungsrechte ist die proprietäre [LICENSE.md](LICENSE.md).

## Projektidee

Der kulturell-spielerische Triathlon verbindet kreative Formate wie Theater, Musik, Tanz und Kunst mit Quiz, Essays, Schach, Dame und gemeinschaftlichen Aufgaben. Im Mittelpunkt stehen kulturelles Lernen, Kommunikation, Selbstvertrauen, Respekt und Freundschaft. Die bisherige Zielgruppe umfasst insbesondere Kinder und Jugendliche von etwa **8 bis 18 Jahren**.

Vorgesehene Einsatzorte sind Schulen, Kulturzentren, Ferienlager, Festivals und internationale Partnernetzwerke. Die Website stellt durchgeführte und geplante Aktivitäten sowie Partnerregionen dar; diese Inhalte entwickeln sich mit dem Projekt weiter.

## Aktueller Funktionsumfang

Das Repository enthält eine responsive, vertikal aufgebaute Website und einen geschützten Content Desk. HTML, CSS und JavaScript liegen in getrennten Dateien; für das Frontend ist kein Framework oder Build-Schritt erforderlich.

- Landing-Hero mit einer rotierenden News-Meldung und drei Auswahlpunkten.
- Projektbeschreibung, Team, Spielprinzip, Altersgruppen, Programme sowie aktuelle, vergangene und Online-Projekte.
- Aktivierte History-Seite mit lokalisierten Entstehungs-, Autoren- und internationalen Spielstationen.
- Projektansicht mit dem visualisierten Projektpfad von Idee über Team und Spiel bis zum Finale.
- Interaktive Weltkarte mit Länderübersicht und Standortstatus.
- News-Karten mit Detaildialogen, eine ordnerbasierte Foto-/Videogalerie, Zitate und Partnergruppen.
- Kontaktformular und Liga-Antrag mit gemeinsamer Worker-API.
- Russisch, Englisch und Deutsch, Theme-Umschaltung, responsive Navigation und Lesefortschritt.
- Content Desk unter `/admin/` mit Tabs für News, Gallery, Online Projects, Videos, Interviews, Projects, World Points und Partners. Im Interview-Tab werden Gespräche und Materialien getrennt verwaltet.
- Gallery-Uploads können als mehrere Bilder in einem benannten Ordner als Pending-Gruppe vorbereitet und anschließend gesammelt veröffentlicht werden; Online Projects bleiben ein getrenntes Topic-System.
- Gallery, News, Online Projects und Privacy Policy verwenden einen gemeinsamen responsiven Second-Page-Header.
- Dynamische Veröffentlichung über Cloudflare D1 und R2 mit statischen Ausgangsinhalten im Frontend.

Temporär deaktivierte Bereiche und redaktionelle Platzhalter sind Teil des Entwicklungsstands. Eine Funktion im Code oder eine konfigurierte Domain ist kein Nachweis ihres aktuellen Produktionsbetriebs.

## Technik und Struktur

Die Website verwendet HTML5, CSS Grid/Flexbox, CSS Custom Properties und Vanilla JavaScript. Der Cloudflare Worker übernimmt APIs, Authentifizierung, Medienauslieferung, Formularversand und ausgewählte Routing-/SEO-Aufgaben. Wrangler und Vitest liegen ausschließlich im Paket `worker/`.

```text
.
├── site/                         # Document Root der Website
│   ├── index.html
│   ├── admin/
│   │   ├── index.html
│   │   ├── admin.css
│   │   └── admin.js
│   ├── source/
│   │   ├── scripts/               # Sprache, News, Interaktionen, Karte, Formulare
│   │   ├── style/style.css
│   │   └── style/subpage.css       # gemeinsamer Header für Second Pages
│   ├── public/
│   │   ├── assets/                # Marke, Hintergründe, Illustrationen, Medien
│   │   ├── favicon/
│   │   └── site.webmanifest
│   ├── page/gallery/             # Ordnerbasierte Foto-/Videogalerie
│   ├── page/interviews/          # Interview-Archiv, Videoplayer und Materialien
│   ├── page/news/                # Eigenständige Neuigkeitenseite
│   ├── page/onlineProjects/      # Online-Projekt-Bibliothek
│   ├── page/privacyPolicy/
│   ├── .assetsignore
│   ├── _headers
│   ├── _redirects
│   ├── 404.html
│   ├── robots.txt
│   └── sitemap.xml
├── worker/
│   ├── src/                      # index.js, access.js, news.js, content.js, Tests
│   ├── migrations/               # D1-Schema und Ausgangsdaten
│   ├── scripts/seed-news.mjs
│   ├── .dev.vars.example
│   ├── wrangler.jsonc             # Produktion
│   ├── wrangler.local.jsonc       # Lokale Entwicklung
│   └── package.json
├── ARCHITECTURE.md
├── CONTRIBUTING.md
├── LICENSE.md
└── README.md
```

Im Browser entspricht `site/index.html` der URL `/`. Asset-URLs beginnen mit `/public/`, nicht mit `/site/public/`. Admin-CSS und -JavaScript liegen unter `/admin/admin.css` beziehungsweise `/admin/admin.js`; Favicons werden gemeinsam aus `/public/favicon/` geladen.

## Lokal starten

Voraussetzungen sind Git, Node.js **24 oder neuer** (CI verwendet Version 24) und npm. Für die vollständige Website mit APIs und Content Desk den Worker verwenden:

```bash
cd worker
npm ci
```

Beim ersten Einrichten die Beispieldatei kopieren; eine bestehende `.dev.vars` nicht überschreiben:

```bash
cp .dev.vars.example .dev.vars
```

In `.dev.vars` einen eigenen Wert für `ADMIN_DEV_TOKEN` setzen. Danach die lokale Datenbank vorbereiten und starten:

```bash
npm run db:migrate:local
npm run dev
```

- Website: `http://localhost:8787/`
- Content Desk: `http://localhost:8787/admin/`
- Im lokalen Admin-Dialog den Wert von `ADMIN_DEV_TOKEN` eingeben. Er wird für die Browser-Sitzung gespeichert.

Optional lassen sich die gebündelten News in die lokale Datenbank übernehmen:

```bash
npm run seed:news -- mirokit-database-local --local --dry-run
npm run seed:news -- mirokit-database-local --local
```

**Der Seed aktualisiert vorhandene News mit denselben IDs und setzt ihren Status auf veröffentlicht.** Er ist eine gezielte Erstbefüllung und kein notwendiger Schritt bei jedem Start.

D1, R2 und Rate-Limiting werden lokal simuliert. Externe Fonts, Kartendaten und Turnstile benötigen weiterhin Netzwerkzugriff. Die lokale Konfiguration enthält keine `CONTACT_EMAIL`-Bindung; ein erfolgreicher echter E-Mail-Versand ist damit nicht eingerichtet. Grundlage ist die [Cloudflare-Dokumentation zur lokalen Entwicklung](https://developers.cloudflare.com/workers/local-development/).

Für eine reine Frontend-Vorschau reicht vom Repository-Stamm aus:

```bash
python3 -m http.server 8080 --directory site
```

Dieser Server stellt keine Content-APIs bereit. Die statischen Inhalte bleiben als Vorschau nutzbar; den Content Desk über Port `8787` öffnen. `file://` eignet sich wegen Modul- und Fetch-Anfragen nicht als Entwicklungsumgebung.

## Inhalte verwalten

| Bereich | Redaktionelle Speicherung | Öffentliche API | Statischer Ausgangsstand |
| --- | --- | --- | --- |
| News | D1, Bilder in R2 oder öffentliche Bild-URL | `/api/v1/news` | `site/source/scripts/news-data.js` |
| Gallery | R2-Bilder mit lokalisierten Metadaten und Ordner-Metadaten; Zitate in D1 | `/api/v1/gallery?collection=gallery` | `site/page/gallery/`; Ordnerkarten öffnen die Bildsammlung, `view=video` öffnet die Videos |
| Videos | D1-Metadaten, Videos/Poster/WEBVTT in R2 oder externe Quelle | `/api/v1/videos` | `site/page/gallery/?view=video` |
| Interviews | Eigener D1-Bestand: Videos in der Collection `interviews`, Materialien mit RU/EN/DE-Metadaten; Dateien in R2 | `/api/v1/interviews` | `site/page/interviews/` |
| World Points | D1 mit Koordinaten, Status und Übersetzungen | `/api/v1/world-points` | `site/source/scripts/mirokit-world-map.js` |
| Partners | D1 mit Kategorie, Website, Sortierung und Übersetzungen; Logos in R2 oder öffentliche Bild-URL | `/api/v1/partners` | Partner-Markup in `site/index.html` |
| Projects | D1 mit Entwurf/Veröffentlichung, RU/EN/DE-Metadaten, Zeitraum und optionalem R2-Bild | `/api/v1/projects` | Current/Past-Ansicht in `site/index.html` |

News, Gallery, Videos, Interviews, World Points, Partners und Projects unterstützen je nach Bereich Entwurf, Veröffentlichung und Archivierung. Interview-Videos laufen über eigene Admin-Routen (`/api/v1/admin/interviews/videos`), Materialien über `/api/v1/admin/interviews/materials`; beide Bestände bleiben von den normalen Gallery-Videos getrennt. Die News-API berücksichtigt außerdem das Veröffentlichungsdatum. Projects werden anhand von `endDate` automatisch als `past` berechnet, sobald das Datum vor dem heutigen UTC-Datum liegt; die D1-Zeile bleibt dabei unverändert und muss nicht durch einen Cronjob verschoben werden. `featured: 1`, `2` und `3` ordnen die drei neuesten verfügbaren News im Hero; es bleibt jeweils eine Meldung sichtbar.

Gallery-Bilder werden mit RU/EN/DE-Titeln, Alt-Texten, optionalen Untertiteln und Hervorhebung verwaltet. Die Zitatverwaltung ist separat; die öffentliche Galerie wählt pro Seitenaufruf ein Zitat und behält diese Auswahl beim Sprachwechsel bei. Löschaktionen im Content Desk verlangen eine ausdrückliche Bestätigung mit `DELETE` oder `УДАЛИТЬ`.

Normale Gallery-Uploads können mehrere Dateien mit `folder_name` und optionalem `folder_subtitle` als Pending-Gruppe speichern. Der Worker erzeugt einen validierten ASCII-Slug, legt die Dateien unter `gallery/pending/<folder-slug>/` ab und veröffentlicht sie erst über `POST /api/v1/admin/gallery/publish` mit einer begrenzten Schlüsselliste. Die öffentliche Antwort liefert zusätzlich `folders`; Online Projects verwenden weiterhin `collection=online-projects` und ihre validierten Topics.

Die gebündelten Inhalte ermöglichen einen sofortigen Seitenaufbau und Rückfall bei API-Fehlern. Die genaue Behandlung erfolgreicher leerer Antworten unterscheidet sich je Bereich; siehe [ARCHITECTURE.md](ARCHITECTURE.md).

Statische Dateien werden nach Verwendungszweck unter `site/public/assets/` eingeordnet. Einzelheiten stehen in der [Asset-Dokumentation](site/public/assets/README.md). Nach Verschiebungen müssen HTML, JavaScript und verzögerte Medienverweise zusammen aktualisiert werden; Weiterleitungen in `site/_redirects` erhalten bereits veröffentlichte Bild-URLs.

## Cloudflare einrichten und veröffentlichen

Die Produktionskonfiguration in [worker/wrangler.jsonc](worker/wrangler.jsonc) enthält die Domains `mirokit.com`, `mirokit.ru`, `ligamirokit.com` und `ligamirokit.ru`, die Datenbank `mirokit-database` und den Bucket `mirokit-media`. Vor Änderungen prüfen, welche Ressourcen im verwendeten Account bereits existieren.

Nur für eine neue Umgebung ohne diese Ressourcen, aus `worker/`:

```bash
npx wrangler d1 create mirokit-database --location weur
npx wrangler r2 bucket create mirokit-media
```

Die tatsächlich erhaltene Datenbank-ID und Bucket-Zuordnung in die passende Konfiguration übernehmen. [wrangler.news.bindings.example.jsonc](worker/wrangler.news.bindings.example.jsonc) zeigt die Bindungen. R2 muss im Account aktiviert sein.

| Konfiguration | Zweck |
| --- | --- |
| `ASSETS` | Statische Dateien aus `../site` |
| `SITE_DB` | D1-Datenbank für redaktionelle Datensätze |
| `SITE_MEDIA` | R2-Bucket für Bilder, Videos, Poster und WebVTT |
| `CONTACT_FORM_RATE_LIMITER` | Begrenzung der Formularanfragen |
| `CONTACT_EMAIL`, `MAIL_TO` | E-Mail-Versand und Empfänger |
| `TURNSTILE_SECRET`, `TURNSTILE_HOSTNAMES` | Serverseitige Bot-Prüfung |
| `ALLOWED_ORIGINS` | Erlaubte Origins |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE`, `ACCESS_ADMIN_EMAILS` | Produktionszugang zum Content Desk und zu Admin-APIs |
| `ADMIN_DEV_TOKEN` | Lokale Admin-API-Authentifizierung |

Produktionswerte für Access separat konfigurieren; `.dev.vars` richtet keine Produktions-Secrets ein. Beispielsweise können die Access-Werte interaktiv mit `npx wrangler secret put ACCESS_TEAM_DOMAIN`, `npx wrangler secret put ACCESS_AUDIENCE` und `npx wrangler secret put ACCESS_ADMIN_EMAILS` hinterlegt werden. `TURNSTILE_SECRET` wird mit `npx wrangler secret put TURNSTILE_SECRET` gesetzt. Turnstile-Sitekey, erlaubte Domains sowie E-Mail-Absender und -Empfänger müssen zum Account passen.

Cloudflare Access muss auf dem verwendeten Admin-Host sowohl `/admin` und `/admin/*` als auch `/api/v1/admin/*` abdecken. Die Audience muss zur Access-Anwendung passen. Der Worker validiert zusätzlich das Access-JWT und die E-Mail-Allowlist; öffentliche Lese-APIs bleiben öffentlich. Die [Access-Pfadregeln](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/) erläutern die Zuordnung.

Die Migrationen legen News, Gallery-Zitate, World Points, Partners, Videos/Untertitel, Projects und ab `0008_interviews.sql` die Interview-Collection sowie Interview-Materialien an. Migration `0003` enthält außerdem Ausgangsdaten für Karte und Partner. Nach Prüfung der Zielumgebung:

```bash
npm run db:migrate:remote
```

Eine optionale Erstbefüllung der Produktions-News erfolgt mit `npm run seed:news -- mirokit-database`; zuvor mit `--dry-run` prüfen und den oben beschriebenen überschreibenden Effekt berücksichtigen.

Für verwaiste Uploads im R2-Bucket Ablaufregeln nach einem Tag auf **`news/pending/`**, **`gallery/pending/`**, **`partners/pending/`**, **`videos/pending/`**, **`video-posters/pending/`**, **`subtitles/pending/`** und **`interview-materials/pending/`** vorbereiten. Die tatsächliche Einrichtung erfordert eine Freigabe für Änderungen am Bucket. Keine solche Ablaufregel auf permanente Bereiche setzen: Dort liegen auch gespeicherte, weiterhin private Entwürfe. Die Regel zum Abbrechen unvollständiger Multipart-Uploads ist davon getrennt. Details: [R2 Object Lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).

**Für diesen Hardening-Auftrag besteht keine Deployment-Freigabe.** Alle nachfolgenden Veröffentlichungsbefehle sind ausschließlich Betriebsreferenz und werden nicht automatisch ausgeführt. Den lokalen Umsetzungsstand und offene Account-Prüfungen dokumentiert [SECURITY_PLAN.md](SECURITY_PLAN.md).

Vor einer ausdrücklich freigegebenen Veröffentlichung die Prüfungen aus [CONTRIBUTING.md](CONTRIBUTING.md) durchführen. Aus `worker/`:

```bash
npx wrangler deploy --dry-run
npm run deploy
```

Der erste Befehl prüft die Zusammenstellung ohne Veröffentlichung; der zweite veröffentlicht. Migrationen, Secrets, Access-Policies und R2-Lifecycle-Regeln werden dadurch nicht automatisch eingerichtet.

Der lokale Release-Check umfasst außerdem `node scripts/check-js.mjs`, `git diff --check` und `npm test -- --run` im Verzeichnis `worker/`. Ein Firefox-Check bei 390×844 deckt die vier Second Pages ab; API- und Produktionsnachweise bleiben davon getrennt. Ein Commit beziehungsweise Push nach GitHub ist kein Cloudflare-Deployment.

## Gestaltung und Barrierefreiheit

Die Oberfläche verwendet Blau/Navy als Grundfarben, farbige Akzente, abgerundete Panels, weiche Schatten, CSS-Variablen und responsive Typografie. Die öffentliche Seite bindet Montserrat, Rubik und Inter ein; der Content Desk nutzt Montserrat und Nunito. Font Awesome liefert Icons; die Weltkarte lädt D3 Geo, TopoJSON Client und World Atlas nach.

Semantische Elemente, ARIA-Beschriftungen, Tastaturbedienung, sichtbarer Fokus, alternative Bildtexte und reduzierte Animationen sind Bestandteil der Umsetzung. Eine vollständige Konformitätsprüfung wird damit nicht behauptet. Änderungen an der Oberfläche benötigen auch manuelle Prüfungen von Navigation, Dialogen, Kontrast, Zoom und mehreren Viewports.

Temporär deaktivierbare Elemente verwenden diesen bestehenden Mechanismus:

```html
<a href="#projects" data-temporarily-disabled>Projekt öffnen</a>
<section class="panel" data-temporarily-disabled data-disabled-label="Bald verfügbar">
  ...
</section>
```

Alternativ ist `is-temporarily-disabled` möglich. Der Mechanismus kennzeichnet den Bereich visuell, sperrt Interaktionen und nimmt enthaltene Bedienelemente aus der Tab-Reihenfolge. Zum Reaktivieren den jeweiligen Marker entfernen.

## Sicherheit, Datenschutz und Rechte

Zugangsdaten gehören in lokale Variablendateien oder die Cloudflare-Konfiguration, niemals in den Commit. Personenbezogene Daten und nicht freigegebene Kinder-/Jugendmedien gehören nicht ins öffentliche Repository. Formulare verwenden serverseitige Validierung, Origin-Prüfung, Turnstile und Rate-Limiting. Die technischen Grenzen der Medienauslieferung beschreibt [ARCHITECTURE.md](ARCHITECTURE.md).

Drittanbieter-Bibliotheken, Fonts, Kartendaten, Logos und Medien behalten ihre eigenen Rechte. Die proprietäre Projektlizenz ersetzt deren Lizenzbedingungen nicht.

## Weitere Dokumentation

- [ARCHITECTURE.md](ARCHITECTURE.md): Module, Datenflüsse, Routing und Speichergrenzen.
- [CONTRIBUTING.md](CONTRIBUTING.md): autorisierte Mitarbeit, Konventionen, Tests und Review.
- [Content Desk](site/admin/README.md): Dateiaufteilung und lokaler Einstieg.
- [Assets](site/public/assets/README.md): Ablage und URL-Regeln.
- [LICENSE.md](LICENSE.md): Rechte, erlaubte Nutzung und Beiträge.

Copyright © 2026 initiative-erLeben & MIRoKIT. Alle Rechte vorbehalten.

## Medienzugriff und Sicherheitsprüfungen

Pending-Medien sind unter `/media/v1/` gesperrt. Permanente Dateien werden nur bei
aktueller Veröffentlichung ausgeliefert; News berücksichtigen zusätzlich das
Datum. Entwürfe und archivierte Dateien sind über den geschützten Endpunkt
`/api/v1/admin/media/<key>` im Content Desk erreichbar. Access muss auch diesen
Pfad abdecken; die bestehende Regel `/api/v1/admin/*` schließt ihn ein.

Öffentliche R2-Antworten verlangen Revalidierung; Preview und R2-Schreibmetadaten
verwenden `private, no-store`. Die Gründe und Grenzen stehen unter
[R2 und statische Assets](ARCHITECTURE.md#r2-und-statische-assets). Alte öffentliche
Cache-Kopien sowie externe und statische Medien werden durch diese lokale
Änderung nicht nachträglich privat.

[CONTRIBUTING.md](CONTRIBUTING.md) beschreibt die lokalen Checks und den vorbereiteten
GitHub-Check `mirokit-ci`. Der Workflow prüft Syntax, Whitespace, Tests und den
lokalen Worker-Build ohne Veröffentlichung. Hinweise zum privaten Melden von
Sicherheitsproblemen stehen in [SECURITY.md](SECURITY.md).
