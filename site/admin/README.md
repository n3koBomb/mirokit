# MIRoKIT Content Desk

Stand: **18. Oktober 2026**. Redaktion unter `/admin/`, geschützte Aufrufdetails unter `/admin/status/`. Einstieg und lokale Einrichtung: [Haupt-README](../../README.md). API-/Speicheraufbau: [Architektur](../../ARCHITECTURE.md).

## Dateien und Zugang

| Datei | Aufgabe |
| --- | --- |
| `index.html`, `admin.css` | Formulare, Tabs, responsive Gestaltung und Themes |
| `admin.js` | `AdminConfig`, `AdminNotice`, `AdminServices`, Bereichsklassen, Löschdialog, Shell und App |
| `media-preview.js` | Geschützte Medien-URLs, lokale Token-Requests und Blob-Vorschauen |
| `online-project-media.js` | Video-/PDF-Editor und lokale PDF.js-Vorschau |
| `status/index.html`, `status/status.js` | Aufrufdetails und getrennte Diagnosegruppen |

Den lokalen Worker aus `worker/` mit `npm run dev` starten. Ein statischer Server stellt keine Admin-APIs bereit. Auf localhost/127.0.0.1 den konfigurierten `ADMIN_DEV_TOKEN` eingeben; er wird pro Browsersitzung als `mirokitAdminToken` gespeichert. Produktiv sind Access-JWT und E-Mail-Allowlist erforderlich. Access muss `/admin`, `/admin/*` und `/api/v1/admin/*` auf dem verwendeten Host schützen.

CSS/JS liegen unter `/admin/`, Favicons unter `/public/favicon/`. Gespeicherte relative Bilder beziehen sich auf die Websitewurzel, nicht auf `/admin/`. Tokens gehören weder in URLs noch an fremde Medienhosts.

## Gemeinsame Bearbeitung

Tabs verwalten News, Gallery, Online Projects, Videos, Interviews, Projects, World Points und Partners. Der Interview-Tab trennt Videos und Materialien. RU/EN/DE-Gruppen lassen sich unabhängig öffnen; fehlende Pflichttexte müssen vor dem Speichern ergänzt werden.

Die meisten Content-Bereiche unterstützen `draft`, `published`, `archived`. Speichern und Veröffentlichen sind eigene Aktionen. Eine gespeicherte Datei kann bereits außerhalb von `pending/` liegen und trotzdem privat bleiben. `DELETE` archiviert in den beschriebenen Verwaltungswegen; es ist keine automatische physische R2-Löschung. Löschdialoge verlangen `DELETE` oder `УДАЛИТЬ`.

Bei Speicherfehlern oder `409` Listen neu laden und den tatsächlich gespeicherten Zustand prüfen. R2 und D1 bilden keine gemeinsame Transaktion; Gallery-Batches können teilweise erfolgreich sein.

## News

Slug, Veröffentlichungsdatum, Kategorie, Akzent, Bild sowie drei vollständige Übersetzungen mit Titel, Alt-Text, Zusammenfassung und Absätzen pflegen. `linkUrl` ist optional; lokale Pfade und HTTPS sind unterstützt. Feature-Ränge reichen von 1 bis 10; der Hero wählt zuerst die drei neuesten verfügbaren News und sortiert diese nach Rang.

Die öffentliche API liefert nur veröffentlichte News mit erreichtem UTC-Datum. R2-Bilder werden beim Speichern promoted; ihre öffentliche Auslieferung bleibt an eine veröffentlichte Referenz gebunden. Der optionale News-Seed kann redigierte Inhalte gleicher ID überschreiben und erneut veröffentlichen.

## Normale Gallery-Ordner

1. Neuen Ordner mit Namen, optionalem Slug und Untertitel anlegen oder ausdrücklich einen vorhandenen Ordner zum Anhängen wählen.
2. Mehrere Bilder auswählen. Sie bleiben unter `gallery/pending/<folder-slug>/` privat.
3. Bild-/Ordnertexte in RU/EN/DE, Cover und Sortierung prüfen.
4. **Ordner veröffentlichen** sendet maximal 100 Schlüssel an `POST /api/v1/admin/gallery/publish` und verschiebt sie in den permanenten Gallery-Ordner.

Neue Slugs dürfen nicht kollidieren. `POST /api/v1/admin/gallery/reorder` speichert eine Liste eindeutiger Schlüssel aus genau einem normalen Gallery-Ordner, maximal 100. ETag-bedingte Writes können Konflikte melden; bereits erfolgreiche Teilschritte werden nicht zurückgerollt.

`PATCH /api/v1/admin/gallery/:encoded-key` ändert Metadaten; `DELETE` archiviert. Gallery-Zitate werden separat in D1 verwaltet und können einen Ordnerbezug haben. Öffentlich erscheinen gruppierte `folders` und `gallery`; ein Ordnerlink verwendet `?folder=<slug>`.

**Bekannter Fehler:** Die API erzeugt für Pending-Gallery-Vorschauen derzeit kodierte Slash-Pfade, die der Medienhandler mit `404` ablehnt. Lokale Dateivorschauen vor dem Upload sind davon zu unterscheiden. Details im [Audit](../../docs/repository-audit.md#konkrete-offene-befunde).

## Videos und Interview-Videos

- `youtube`: unterstützte YouTube-URL; Wiedergabe über YouTube-Embed und dessen Steuerung.
- `external`: direkte HTTPS-Medienquelle; fremde Abspiel-/CORS-/Range-Eigenschaften müssen geprüft werden.
- `r2`: eigener Upload bis 95 MiB, mit separatem Poster bis 8 MiB. Unterstützt sind MP4, WebM und OGV.
- Untertitel: WebVTT-Datei oder Text, bis zu acht Tracks. Cue-Editor kann Zeiten aus der Vorschau übernehmen; neue Inhalte erhalten neue Objektschlüssel.
- Dauer/Bildmaße können aus HTML5-Metadaten übernommen werden; keine garantierte automatische YouTube-Metadatenbeschaffung.

Normale Videos verwenden Collection `general` und `/api/v1/admin/videos`; Interview-Videos Collection `interviews` und `/api/v1/admin/interviews/videos`. Veröffentlichen/Archivieren wirkt auf den jeweiligen öffentlichen Feed. Ein normales Video wird dadurch nicht automatisch zum Interview oder Online-Projekt.

## Interview-Materialien

Materialarten sind `documents`, `brochures`, `forms`, `requests`. HTTPS-Quelle oder eigener R2-Upload bis 25 MiB: PDF, TXT, JPG/PNG/WebP, DOC/DOCX, PPT/PPTX. Titel sind in RU/EN/DE erforderlich; Alt-Text fällt auf den Titel zurück. Quelle, Dateiname, MIME-Typ, Größe und Sortierung gehören zum Datensatz.

CRUD und Upload laufen unter `/api/v1/admin/interviews/materials`; öffentlich liefert `/api/v1/interviews` die freigegebenen Materialien neben Gesprächsvideos.

**Bekannter Fehler:** Die Admin-Listenabfrage selektiert den Status nicht. Deshalb ist die Statusanzeige geladener Materialien derzeit kein verlässlicher Nachweis ihres Speicherstatus; siehe Audit. Die öffentliche Abfrage filtert dennoch auf `published`.

## Projects, World Points und Partners

Projects benötigen Slug, Startdatum, optionales Enddatum, Kategorie/Akzent und drei Sprachversionen. Bilder sind optional; Pending-Bilder werden beim Speichern promoted. Phase wird anhand des heutigen UTC-Datums berechnet: vergangenes Enddatum → `past`, zukünftiges Startdatum → `upcoming`, sonst `current`.

World Points trennen Veröffentlichungsstatus von `hq|done|planned`; Koordinaten und Orts-/Ländertexte werden validiert. Partners speichern Kategorie, Logo, optionale HTTPS-Website, Hervorhebung und Sprachversionen. Vollständig leere Partner-/Kartenfeeds entfernen die statischen Ausgangsinhalte nicht.

## Online Projects

Alle Medien verwenden die zehn Topics aus `site/source/scripts/online-project-topics.js`. Zuerst die Medienart wählen:

| Art | Speicherung und Freigabe |
| --- | --- |
| Fotos | Gallery-Collection `online-projects`; Upload veröffentlicht unmittelbar, ohne normalen Pending-Ordnerworkflow |
| Videos | MP4/WebM/OGV bis 95 MiB; optionales JPG/PNG/WebP-Poster bis 2 MiB; Upload als Entwurf |
| Dokumente | PDF bis 20 MiB; erste Seite wird mit lokalem PDF.js als WebP-Vorschau erzeugt; Upload als Entwurf |

Titel in RU/EN/DE sind bei Videos/PDFs Pflicht; Beschreibungen und Videotext sind optional. Eine Dateiauswahl allein startet keinen Upload. Für PDFs ist eine erzeugbare Vorschau erforderlich. Videos haben keinen WebVTT-Editor in diesem Bereich.

**Bearbeiten** ändert Thema und Texte. Eine andere Datei als neuen Datensatz anlegen. **Als Entwurf speichern** nimmt einen veröffentlichten Inhalt wieder aus der Öffentlichkeit; **Archivieren** behält Datei und Datensatz. Archivierte Inhalte können erneut veröffentlicht werden.

`POST /api/v1/admin/online-projects/media` erwartet FormData mit `kind=video|document`, `topic`, `file`, `translations` als JSON und optionalem `thumbnail` (bei PDF Pflicht). `PATCH /:id` erwartet JSON mit `topic`, `translations`, `status=draft|published`; `DELETE /:id` archiviert. Änderungen am Manifest verwenden ETags.

Direktlinks: `/page/onlineProjects/?topic=drawing&lang=de`, mit `media=videos` oder `media=documents` für andere Arten. Speicherung und genauer API-Vertrag: [Medien-Dokumentation](../../docs/online-project-media.md).

## Private Vorschauen und Dateigrenzen

Eigene R2-Medien werden über `/api/v1/admin/media/<key>` geladen. Lokal lädt der Helper die vollständigen Bytes mit Header-Token und erzeugt eine Blob-URL; bei großen Videos entsprechend Speicher-/Ladezeit einplanen. Produktiv wird direkt über Access gestreamt, mit Byte-Ranges. Alte Blob-URLs werden bei Ersatz verworfen.

Allgemeine Bilder und konventionelle Poster sind auf 8 MiB begrenzt; Online-Medien-Poster auf 2 MiB. MiB entspricht den im Code verwendeten Vielfachen von `1024 * 1024`; die UI bezeichnet diese Grenzen teils als MB. Nicht alle Uploadwege führen dieselbe Signaturprüfung aus.

## Prüfung und Grenzen

`npm test -- --run` aus `worker/` prüft lokale Verträge; [docs/testing.md](../../docs/testing.md) beschreibt den Umfang. Browserprüfungen benötigen echte Bedienung, Fokus, Sprachwechsel, Medienzustand und Zugriff nach Archivierung. Der optionale Online-Medien-Harness ist in der Fach-Dokumentation beschrieben. Lokale Fakes und alte Screenshots bestätigen weder aktuelle Cloudflare-Policies noch echte Mailzustellung.
