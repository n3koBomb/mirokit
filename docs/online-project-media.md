# Online-Projekte: Fotos, Videos und PDFs

Stand: **18. Oktober 2026**, aktueller lokaler Code. Dieses Dokument beschreibt den implementierten Vertrag; frühere Screenshots sind keine aktuelle Browserabnahme. Bedienung: [Content Desk](../site/admin/README.md#online-projects). Gesamtarchitektur: [ARCHITECTURE.md](../ARCHITECTURE.md).

## Drei getrennte Medienwege

Fotos verwenden die bestehende Gallery-API mit `collection=online-projects` und einem Topic. Sie werden unmittelbar veröffentlicht und bleiben von normalen Gallery-Ordnern getrennt. Titel/Alt-Texte können beim Upload ergänzt und Themen später zugeordnet werden.

Videos/PDFs verwenden `worker/src/online-project-media.js` und die bestehende `SITE_MEDIA`-Bindung. Es gibt dafür keine neue D1-Migration und keine zusätzliche Bindung. Texte stehen im JSON-Datensatz und verbrauchen kein R2-Custom-Metadata-Budget.

| Präfix | Inhalt |
| --- | --- |
| `online-projects/files/<uuid>.<ext>` | Video oder PDF |
| `online-projects/previews/<uuid>.<ext>` | Optionaler Video-Poster, verpflichtende PDF-Vorschau |
| `online-projects/records/<uuid>.json` | Topic, Übersetzungen, Status, Dateiname, Größe, Objektverweise und Änderungszeit |

Diese Objekte liegen dauerhaft außerhalb von `pending/`. Keine pauschale Pending-Lifecycle-Regel darauf anwenden. JSON-Manifeste werden nicht über `/media/v1/` ausgeliefert.

## Upload und Zustände

1. Admin wählt Medienart und eines der zehn gemeinsamen Topics.
2. Datei und RU/EN/DE-Titel werden geprüft; optionale Beschreibung und Videotext ergänzt.
3. Bei PDF rendert lokal mitgeliefertes PDF.js die erste Seite in ein Canvas; daraus entsteht ein WebP-Bild. Das Dokument wird nicht öffentlich im Browser mit PDF.js gerendert.
4. `POST` speichert Datei, Vorschau und Manifest als `draft`. Falls ein späterer Write scheitert, versucht der Handler bereits geschriebene Binärobjekte zu entfernen.
5. `PATCH` setzt `draft` oder `published`; `DELETE` setzt `archived`. Dateien bleiben erhalten. Erneute Veröffentlichung erfolgt durch `PATCH`.

Ein Upload ist keine Transaktion über drei R2-Objekte. Cleanup ist ein begrenzter Versuch; Speicherfehler können manuelle Nachprüfung erfordern. JSON-Änderungen verwenden `etagMatches`; konkurrierender Write liefert `409`, damit die Liste neu geladen werden kann.

| Datei | Typen / Grenze |
| --- | --- |
| Video | MP4, WebM, OGV; 95 MiB |
| Dokument | PDF; 20 MiB |
| Vorschau | JPG, PNG, WebP; 2 MiB |

Der Server prüft die Anfangssignatur passend zum MIME-Typ. Dies validiert nicht die gesamte Datei und ersetzt keinen Malware-Scan. Beschreibungen/Videotexte sind je Sprache auf 10.000 Zeichen, Titel auf 500 Zeichen begrenzt.

## API

| Methode / Pfad | Vertrag |
| --- | --- |
| `GET /api/v1/online-projects/media` | `{ success, media }`, ausschließlich veröffentlichte Video-/PDF-Einträge |
| `GET /api/v1/admin/online-projects/media` | Alle Zustände mit Admin-Preview-URLs |
| `POST /api/v1/admin/online-projects/media` | FormData `kind`, `topic`, `file`, `translations`, `thumbnail`; Ergebnis `201`, zunächst Entwurf |
| `PATCH /api/v1/admin/online-projects/media/:id` | JSON `topic`, `translations`, `status=draft|published` |
| `DELETE /api/v1/admin/online-projects/media/:id` | Archiviert, löscht keine Bytes |

`kind` ist `video|document`; `translations` enthält `ru`, `en`, `de`, jeweils `title`, optional `description` und `transcript`. PDF verlangt `thumbnail`, Video nicht. Einzel-IDs sind UUIDs. `HEAD` wird von dieser API nicht angeboten.

Die Admin-Router prüfen Identität, Methoden und vorhandene Schreib-Origin vor der Delegation. Antworten sind `private, no-store`. Listen lesen alle Manifestseiten in begrenzten parallelen Batches und sortieren nach Änderungszeit absteigend; sie sind nicht nach beliebiger Gesamtgröße paginiert an den Browser.

Öffentliche Dateien und Vorschauen laufen über `/media/v1/` mit Prüfung des referenzierenden veröffentlichten JSON-Datensatzes bei jeder Anfrage. Videos unterstützen Byte-Ranges. Vorschau verwendet `/api/v1/admin/media/`. Der Bucket muss selbst privat bleiben.

## Öffentliche Seite

`/page/onlineProjects/` synchronisiert `topic`, `media=photos|videos|documents` und `lang` mit der URL. Die Medien- und Themenwahl verwendet Buttons; Zustand reagiert auf Browser-Zurück/Vorwärts.

Fotos behalten natürliche Seitenverhältnisse und öffnen einen Bilddialog. PDFs zeigen das gespeicherte Bild der ersten Seite und öffnen die Datei in einem neuen Tab mit `noopener noreferrer`.

Videos verwenden einen eigenen HTML5-Player mit Play/Pause, Seek, Lautstärke, Mute und Vollbild sowie optionalem ausklappbaren Videotext. Zeit, Lautstärke und Mute werden pro URL in `localStorage` unter `mirokitOnlineProjectVideo:<url>` gespeichert und ohne Autoplay restauriert. Rerendern pausiert alte Videos und speichert ihren Zustand; `pagehide` speichert ebenfalls. Einzelne Player-Labels sind derzeit fest Englisch. Zeitbezogene Untertitel werden hier nicht verwaltet.

Fehler-/Leer-/Ladezustände bleiben je Medienart getrennt. Erfolgreiche leere Antworten erfinden keine Inhalte. Medienseiten benötigen die APIs des Workers; eine reine HTML-Vorschau kann nur statische Bestandteile darstellen.

## Dateien

`site/page/onlineProjects/` enthält HTML/CSS/Seitenlogik. `site/admin/online-project-media.js` verwaltet Upload, Bearbeitung und PDF-Vorschau. `online-project-topics.js` definiert Topics gemeinsam für Worker und Browser. Die [PDF.js-Dokumentation](../site/public/vendor/pdfjs/README.md) beschreibt Version und Begleitdateien.

`worker/src/online-project-media.test.js` prüft Upload, Privatheit, Publish/Archive, PDFs/Videos, Auth-/Origin-Grenzen, Signaturen, Größen, Konflikte, Cleanup und paginierte R2-Auflistung. Die gesamte Suite wird aus `worker/` mit `npm test -- --run` ausgeführt; siehe [Testdokumentation](testing.md).

## Optionale Browserprüfung

`worker/scripts/check-online-project-media.mjs` startet einen lokalen HTTP-Server auf `127.0.0.1:4173`, verwendet den echten Worker für die betroffenen Medienrouten und einen R2-Fake im Arbeitsspeicher. Andere API-Listen sind Testdaten. Er schreibt Screenshots nach `docs/screenshots/`.

Voraussetzungen sind separat verfügbare `playwright-core`, `axe-core` und ein Chromium-/Chrome-/Edge-Binary. Diese Pakete sind keine regulären Projektabhängigkeiten. Der Harness importiert ausdrücklich Chromium; er unterstützt Firefox derzeit nicht. Optional lassen sich `MIROKIT_PLAYWRIGHT_MODULE`, `MIROKIT_AXE_SCRIPT` und `MIROKIT_BROWSER_PATH` setzen, um vorhandene Installationen zu verwenden.

Aus `worker/`:

```bash
node scripts/check-online-project-media.mjs
```

Das ist kein Cloudflare-/Access-/D1-Nachweis und kein Ersatz für eine Firefox-Prüfung. Im Dokumentationsaudit wurde der Harness nicht erneut ausgeführt. Eine frühere lokale Browserprüfung ist in den vorhandenen Screenshots festgehalten, bestätigt aber die neuere Playerimplementierung nicht.

## Vorhandene Screenshots und offene Abnahme

- [Admin Desktop](screenshots/online-project-admin-desktop.png)
- [Dokumente Desktop](screenshots/online-project-documents-desktop.png)
- [Admin mobil/dunkel](screenshots/online-project-admin-mobile-dark.png)
- [Dokumente mobil](screenshots/online-project-documents-mobile.png)

Die Bilder enthalten lokale Testdaten. Offen bleiben aktuelle Firefox-/Safari-Prüfung, manuelle Screenreader-Abnahme, Player-Persistenz/Vollbild, redaktionelle PDF-Qualität und tatsächlicher Zugriff nach Statuswechsel in der Zielumgebung. Automatische Syntax-/Unit-/axe-Checks beweisen keine vollständige Barrierefreiheit.
