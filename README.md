# MiroKit

MiroKit ist die digitale Website- und Präsentationsplattform eines internationalen, kulturell-spielerischen Projekts für Kinder und Jugendliche. Das Projekt verbindet Spiel, Kreativität, Dialog, Kommunikation, Teamarbeit und kulturelles Lernen.

> **Projektstatus:** aktive Entwicklungs- und Prototyping-Phase. Das Repository wird schrittweise zur zentralen, nachvollziehbaren Quelle für Quellcode, Medien, Dokumentation und Veröffentlichungen ausgebaut.

## Trägerschaft und Produktion

Die Website, ihre Projektidentität und die projektspezifischen Inhalte gehören zu **initiative-erLeben**.

Die technische Konzeption und Produktion der Website verfolgt einen eigenständigen Entwicklungsweg. Dazu gehören die Architektur, das responsive Verhalten, die Benutzeroberfläche, Interaktionen, Prototypen und die schrittweise Überführung in eine wartbare Produktionsstruktur. Dieser eigenständige Produktionsweg ändert nichts an der Rechtezuordnung an initiative-erLeben und begründet keine Open-Source-Freigabe.

## Projektidee

MiroKit ist als kulturell-spielerischer Triathlon und internationaler Begegnungsraum konzipiert. Kinder und Jugendliche sollen durch spielerische Aktivitäten, kreative Formate und gemeinschaftliche Aufgaben miteinander in Kontakt kommen, andere Kulturen kennenlernen und gegenseitigen Respekt entwickeln.

Zentrale Themen sind:

- internationaler Dialog und Verständigung,
- Kreativität, Theater, Musik, Tanz und Kunst,
- Quiz, Essays und Wissensformate,
- Schach, Dame und weitere Logikspiele,
- Teamaufgaben und gemeinschaftliches Problemlösen,
- Kultur, Geschichte, Sprachen, Bräuche und Küche,
- Kommunikation, Selbstvertrauen und Freundschaft.

Die bisherige Zielgruppe umfasst insbesondere Kinder und Jugendliche im Alter von etwa **8 bis 18 Jahren**.

## Geplante Einsatzorte

MiroKit ist für lokale und internationale Formate vorgesehen, unter anderem in:

- Schulen,
- Kulturzentren,
- Sommer- und Winterlagern,
- Festivals und Veranstaltungen,
- internationalen Partnernetzwerken.

In bisherigen Website-Entwürfen werden Deutschland, Russland und Tunesien als beispielhafte Länder beziehungsweise Partnerregionen dargestellt. Diese Darstellung ist ein aktueller Design- und Inhaltsstand und keine abschließende Liste.

## Bekannte Website-Bereiche

Für MiroKit bestehen mehrere konzeptionelle HTML-Prototypen: eine klassische Landingpage, eine kompakte Home-Landingpage sowie eine horizontale, panelbasierte Präsentationsversion.

Bekannte oder geplante Bereiche und Funktionen:

- Start- und Hero-Bereich mit Projektbotschaft und Call-to-Action,
- Projektbeschreibung und Werte,
- Programme und Aktivitäten,
- Vorteile für teilnehmende Kinder und Jugendliche,
- Standorte und internationale Präsenz,
- News- und Veranstaltungskarten,
- Weltkarte und Länderübersicht,
- Galerie und Medienbereiche,
- Partner- und Kontaktbereiche,
- Community- und Social-Media-Verweise,
- mehrsprachige Inhalte auf Russisch, Englisch und Deutsch,
- Desktop-Navigation, Seitenleiste und mobiles Burger-Menü,
- horizontales Scrollen und Scroll-Snap auf großen Bildschirmen,
- vertikales Layout auf kleineren Geräten,
- Fortschrittsanzeige und Tastatursteuerung,
- Formulare, Dialogfenster und visuelle Statusmeldungen.

Nicht alle genannten Funktionen sind bereits produktiv implementiert. Einige Bereiche sind noch Designprototypen oder Platzhalter.

## Designsystem

Das visuelle Konzept verwendet derzeit vor allem:

- kräftige Blau- und Navy-Töne als Primärfarben,
- ergänzende Rot-, Orange-, Grün-, Violett-, Gelb- und Cyan-Akzente,
- große, abgerundete Karten und Panels,
- weiche Schatten, transparente Flächen und Blur-Effekte,
- responsiv skalierende Typografie mit `clamp()`,
- CSS Custom Properties für Farben, Abstände, Radien und Layoutgrößen,
- Montserrat für markante Überschriften,
- Nunito beziehungsweise Rubik und Inter für Fließtext,
- Caveat für handschriftliche Akzente.

Die Oberfläche verbindet eine jugendliche, spielerische Gestaltung mit einer klaren Informationshierarchie.

## Technische Grundlage

Die bisherigen Prototypen basieren überwiegend auf:

- HTML5,
- CSS3,
- Vanilla JavaScript,
- CSS Grid und Flexbox,
- CSS Custom Properties,
- responsiven Media Queries,
- lokaler Asset-Struktur unter `public/`,
- Google Fonts,
- Font Awesome,
- Tabler Icons,
- Phosphor Icons.

Der aktuelle Prototyping-Ansatz verwendet teilweise umfangreiche HTML-Dateien mit eingebettetem CSS und JavaScript. Für die produktive Weiterentwicklung ist eine Trennung in eigenständige HTML-, CSS- und JavaScript-Module vorgesehen.

Ein Framework wie React oder Ant Design ist derzeit keine technische Voraussetzung. Der aktuelle Ansatz bleibt bewusst mit standardnahen Webtechnologien umsetzbar.

## Responsive Strategie

Die Desktop-Version kann als horizontale Präsentation mit bildschirmbreiten Panels aufgebaut werden. Auf Tablets und Smartphones wird das Layout auf vertikales Scrollen umgestellt.

Wichtige Anforderungen:

- stabile Darstellung auf unterschiedlichen Laptop-Auflösungen,
- Anpassung an Smartphone- und Tablet-Viewports,
- Unterstützung von Maus, Touchpad, Touch und Tastatur,
- kein erzwungenes horizontales Layout auf kleinen Geräten,
- flexible Seitenleisten- und Panelbreiten,
- skalierende Innenabstände und Border-Radii,
- Tests mit verschiedenen Device-Pixel-Ratios,
- Vermeidung von ungewolltem horizontalem Overflow.

## Barrierefreiheit

Bereits berücksichtigt oder für die Produktion vorgesehen sind:

- semantische HTML-Strukturen,
- verständliche Überschriftenhierarchien,
- ARIA-Beschriftungen für Navigation und interaktive Bereiche,
- sichtbare `:focus-visible`-Zustände,
- Tastaturbedienung,
- alternative Bildtexte,
- ausreichend große Touch-Ziele,
- responsives Zoomen ohne Layoutverlust,
- reduzierte Animationen über `prefers-reduced-motion`,
- ausreichende Farbkontraste,
- Dialoge mit kontrollierter Fokusführung.

Vor einer Veröffentlichung sind automatisierte und manuelle Prüfungen gegen **WCAG 2.2** erforderlich. Dazu gehören insbesondere Tastaturtests, Screenreader-Tests, Kontrastmessungen und Tests bei 200 bis 400 Prozent Zoom.

### Temporär deaktivierte Elemente

Für Bereiche, die vorübergehend nicht verfügbar sein sollen, kann der Marker an jedes Element angehängt werden:

```html
<a class="module-link" href="#projects" data-temporarily-disabled>
  Projekt öffnen
</a>

<section class="panel" data-temporarily-disabled data-disabled-label="Bald verfügbar">
  ...
</section>
```

Alternativ funktioniert die Klasse `is-temporarily-disabled`. Der Marker dimmt und verwischt den Inhalt weich, zeigt das optionale Label zentriert, verhindert Klicks und nimmt enthaltene Links oder Buttons aus der Tastatur-Reihenfolge. Zum Reaktivieren einfach `data-temporarily-disabled` beziehungsweise die Klasse entfernen.

### Zentrale News-Daten

Alle News-Inhalte liegen in [`site/source/scripts/news-data.js`](site/source/scripts/news-data.js). Jeder Eintrag enthält lokalisierte Werte für `ru`, `en` und `de`, das Veröffentlichungsdatum `publishedAt`, das Bild, den vollständigen Modal-Inhalt sowie `featured`. Die Werte `featured: 1`, `2` und `3` ordnen die drei aktuellsten veröffentlichten Meldungen im Hero manuell; `featured: false` lässt die Datumsreihenfolge entscheiden. Zukünftige Meldungen werden automatisch bis zum Veröffentlichungsdatum ausgeblendet.

### News-Admin und dynamische Veröffentlichung

Der geschützte Editor liegt unter `/news-admin/`. Er schreibt Meldungen in D1
und Bilder in den privaten R2-Bucket; die öffentliche Seite liest nur
veröffentlichte Meldungen über `/api/news`. Die bestehende statische
`news-data.js` bleibt als sofortiger Fallback erhalten, damit die Seite bei
einem noch nicht eingerichteten Speicher nicht leer startet.

Einmalige Cloudflare-Einrichtung:

```bash
cd worker
npx wrangler d1 create mirokit-news --location weur
npx wrangler r2 bucket create mirokit-news-media
npm run db:migrate:remote
npm run seed:news -- mirokit-news
```

Falls Wrangler meldet, dass R2 erst im Cloudflare-Dashboard aktiviert werden
muss, R2 dort einmal freischalten und den Bucket-Befehl wiederholen. Der
News-Editor bleibt bis zur R2-Bindung sicher erreichbar, kann aber erst dann
neue Bilder hochladen.

Für unvollständige News-Bearbeitungen im R2-Dashboard zusätzlich eine
Lifecycle-Regel anlegen: Prefix `news/pending/`, Aktion „Expire objects“ nach
1 Tag. Neue Uploads landen zunächst dort und werden beim Speichern in
`news/` verschoben. Die vorhandene Regel zum Abbrechen unvollständiger
Multipart-Uploads nach 7 Tagen bleibt aktiviert. Keine Ablaufregel auf dem
gesamten Prefix `news/` anlegen, sonst könnten veröffentlichte Bilder gelöscht
werden.

Die von `wrangler d1 create` gelieferte `database_id` sowie die R2-Bindung
werden nach [`worker/wrangler.news.bindings.example.jsonc`](worker/wrangler.news.bindings.example.jsonc)
in `worker/wrangler.jsonc` übernommen. Für die lokale Verwaltung stehen
`NEWS_ADMIN_DEV_TOKEN`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUDIENCE` und
`ACCESS_ADMIN_EMAILS` in `worker/.dev.vars` bereit. In Produktion wird
Cloudflare Access auf `mirokit.com/news-admin/*` beziehungsweise dem
verwendeten Admin-Host eingerichtet; Access-Anwendungstoken werden zusätzlich
im Worker validiert.

## SEO und Metadaten

Die Prototypen enthalten beziehungsweise planen:

- Seitentitel und Meta-Description,
- Open-Graph-Metadaten,
- Twitter/X-Card-Metadaten,
- Favicons und Web-App-Manifest,
- strukturierte Daten nach Schema.org,
- Sprach- und Locale-Angaben,
- beschreibende Bildtexte.

Platzhalter-URLs wie `example.com` dürfen nicht in die produktive Veröffentlichung übernommen werden.

## Sicherheit und Datenschutz

Die Website ist aktuell überwiegend als statische Frontend-Anwendung konzipiert. Trotzdem gelten folgende Regeln:

- Keine Passwörter, Tokens, API-Schlüssel oder privaten Schlüssel committen.
- Keine personenbezogenen Daten von Kindern oder Jugendlichen im Repository speichern.
- Formulare erst mit serverseitiger Validierung, Rate-Limiting und sicherem Datenschutzkonzept produktiv schalten.
- Externe CDN-Abhängigkeiten regelmäßig prüfen oder lokal ausliefern.
- Drittanbieter-Skripte minimieren und über eine restriktive Content Security Policy absichern.
- Abhängigkeiten und Assets nur mit geklärten Nutzungsrechten verwenden.
- Sicherheitsrelevante Änderungen über Pull Requests prüfen.
- Den Default-Branch gegen direkte Pushes, Force-Pushes und Löschung schützen.

## Aktueller Repository-Stand

Zum Zeitpunkt dieser Dokumentation enthält das GitHub-Repository zunächst nur seine Grundstruktur. Die vorhandenen Website-Prototypen und Assets müssen kontrolliert, bereinigt und anschließend schrittweise übernommen werden.

Dadurch kann jede Übernahme einzeln auf folgende Punkte geprüft werden:

- Funktionalität,
- responsive Darstellung,
- Barrierefreiheit,
- Sicherheit,
- Datenschutz,
- Lizenzlage,
- Codequalität,
- Dateigröße und Ladeleistung.

## Vorgesehene Repository-Struktur

```text
mirokit/
├── public/
│   ├── assets/
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   └── favicon/
├── src/
│   ├── css/
│   ├── js/
│   └── pages/
├── .github/
│   └── rulesets/
├── README.md
└── LICENSE.md
```

Die tatsächliche Struktur kann sich mit der technischen Architektur ändern. Große Inline-Blöcke sollen langfristig in klar benannte Module zerlegt werden.

## Lokale Entwicklung

Solange kein Build-System verwendet wird, kann die Website über einen lokalen Webserver gestartet werden:

```bash
python -m http.server 8080
```

Danach ist sie üblicherweise unter folgender Adresse erreichbar:

```text
http://localhost:8080
```

Für lokale Formular-POSTs muss zusätzlich der Worker laufen. Die erlaubten
Entwicklungs-Origin stehen in `worker/.dev.vars.example`; einmalig kopieren:

```bash
cp worker/.dev.vars.example worker/.dev.vars
cd worker
npm run dev
```

Der lokale Worker startet mit `wrangler.local.jsonc` und simuliert D1, R2 und
das Rate-Limit. Die lokale News-Datenbank wird so vorbereitet:

```bash
npm run db:migrate:local
npm run seed:news -- mirokit-news-local --local
```

Damit sind die üblichen lokalen Ports `8080` und `8787` für die Formular-API
freigegeben. `worker/.dev.vars` bleibt lokal und wird nicht versioniert.

Das direkte Öffnen einer HTML-Datei über `file://` sollte vermieden werden, weil Browser dabei Module, Fetch-Aufrufe und bestimmte Sicherheitsmechanismen anders behandeln.

## Branch- und Pull-Request-Workflow

Der Default-Branch wird über ein GitHub-Ruleset geschützt.

Empfohlener Ablauf:

1. Einen Arbeitsbranch erstellen, zum Beispiel `feature/home-layout` oder `fix/mobile-navigation`.
2. Änderungen lokal prüfen.
3. Verständliche Commits erstellen.
4. Einen Pull Request gegen den Default-Branch öffnen.
5. Offene Review-Kommentare lösen.
6. Den Pull Request per Squash oder Rebase zusammenführen.
7. Den Arbeitsbranch nach dem Merge löschen.

Das mitgelieferte Ruleset ist bewusst für ein Repository mit zunächst nur einer aktiv arbeitenden Person ausgelegt. Es verlangt Pull Requests, aber noch keine fremde Freigabe. Sobald mindestens zwei Maintainer zuverlässig verfügbar sind, sollte die Zahl erforderlicher Reviews von `0` auf `1` erhöht und optional Code-Owner-Review aktiviert werden.

## Commit-Konvention

Empfohlene Präfixe:

```text
feat: neue Funktion
fix: Fehlerbehebung
docs: Dokumentation
style: rein visuelle Änderung
refactor: interne Umstrukturierung
chore: Repository- oder Werkzeugpflege
```

Beispiele:

```text
feat: add responsive home panel
fix: prevent horizontal scroll lock
docs: describe repository structure
```

## Eigentum und Lizenz

Dieses Repository ist **source-available, aber nicht Open Source**. Der öffentlich sichtbare Quellcode darf nicht automatisch kopiert, verändert, weiterveröffentlicht oder kommerziell verwendet werden.

Maßgeblich ist die Datei [`LICENSE.md`](./LICENSE.md).

## Hinweis

Diese Dokumentation beschreibt den derzeit bekannten Projekt- und Entwicklungsstand. Inhalte, Architektur, Partnerangaben und Funktionsumfang können sich während der Produktion ändern.

---

Copyright © 2026 initiative-erLeben. Alle Rechte vorbehalten.
