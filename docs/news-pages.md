# Nachrichtenübersicht und Artikel

Die Übersicht wird unter `/news/` aus `site/page/news/index.html` ausgeliefert. Alte Adressen `/page/news/`, `/page/news/index.html` und `/site/page/news/` leitet der Worker dauerhaft auf `/news/` um; vorhandene Query-Parameter bleiben erhalten. Die beiden Wrangler-Konfigurationen führen diese Routen vor den statischen Assets aus.

Ein Artikel liegt unter `/news/<id>/`. Die bestehende, im Admin festgeschriebene Nachrichten-ID ist sein Slug. Links verwenden zusätzlich `?lang=de`, `?lang=en` oder `?lang=ru`. Diese Auswahl übersteht direkte Aufrufe, neue Tabs und Reloads. Ohne Parameter gelten die bisherigen Host-/Sprachvorgaben. Es werden keine sprachabhängigen Kopien der Artikel gepflegt.

`worker/src/news-pages.js` rendert Artikel, Metadaten für Suchmaschinen und geteilte Links sowie die initialen Inhalte direkt im Worker. `site/source/scripts/news-presentation.js` enthält die gemeinsame Darstellung für Server und Browser. Die bestehende D1-Abfrage liefert ausschließlich veröffentlichte Nachrichten ab ihrem Veröffentlichungsdatum (UTC). Ein leeres Ergebnis wird nicht durch den gebündelten Bestand ersetzt. Unbekannte, geplante oder archivierte Artikel antworten mit HTTP 404; Datenbankfehler mit HTTP 503 und einer verständlichen Meldung. Ohne D1-Bindung steht für lokale Entwicklung derselbe gebündelte Bestand wie auf der Startseite zur Verfügung.

Die Übersicht lädt `/api/v1/news`. Währenddessen zeigt sie einen Ladezustand. Bei einem Fehler zeigt sie den vorhandenen gebündelten Stand mit einem Hinweis und einer Wiederholen-Schaltfläche. Kategorien entstehen aus den tatsächlich verfügbaren, veröffentlichten Nachrichten. Suche, Kategorie und Sortierung stehen in der URL; Scrollpositionen werden pro Ansicht in `history.state` und, soweit verfügbar, `sessionStorage` gespeichert.

## Redaktion und Inhalte

Es ist keine Datenbankmigration erforderlich. `summary` bleibt der Teaser, `content` das Array vollständiger Textabsätze und `linkUrl` der optionale weiterführende Link oder Download. Vorhandene Inhalte benötigen keine Anpassung.

Der bestehende Inhaltseditor unterstützt zusätzlich diese optionalen Schreibweisen, jeweils als eigene Zeile:

```text
## Eine Zwischenüberschrift
### Eine untergeordnete Zwischenüberschrift
Ein Absatz mit **Fettung**, _Hervorhebung_ und einem [Link](https://example.org/).
- Ein Listenpunkt
- Ein weiterer Listenpunkt
1. Ein erster Schritt
2. Ein zweiter Schritt
![Beschreibung des Bildes](/public/assets/images/beispiel.png)
![Beschreibung](/public/assets/images/beispiel.png "Bildunterschrift / Bildnachweis")
```

Fettungen verwenden ausschließlich `**Text**`, kursive Hervorhebungen ausschließlich `_Text_`. Einzelne Sternchen und doppelte Unterstriche bleiben normaler Text.

Nur lokale öffentliche Medienpfade und HTTPS-Adressen werden als Bilder eingebunden. Links erlauben lokale Pfade oder HTTPS. HTML wird als Text dargestellt, nicht ausgeführt.

Für alle Nachrichtenkategorien gelten dieselben Schreibweisen. Zwei optionale Angaben, jeweils als eigene Zeile im Inhalt, erscheinen unter „Auf einen Blick“:

```text
Veranstaltungsdatum: 20. Dezember 2026, 14 Uhr
Ort: Straße, Hausnummer, PLZ, Stadt, Land
```

Die englischen Bezeichnungen sind `Event date:` / `Location:`, die russischen `Дата мероприятия:` / `Место:`. Das Veranstaltungsdatum ist vom Veröffentlichungsdatum getrennt. Vorhandene freie Texte mit `Termin:`, `Teilnahme:` oder `Anmeldung:` werden nicht besonders ausgewertet. Ein Anmeldelink wird wie jeder andere Link ausdrücklich als `[Zur Anmeldung](https://example.org/anmeldung)` geschrieben.

Bei einer Ortsangabe kann der Besucher „Karte anzeigen“ wählen. Erst dieser Klick startet die Adresssuche über den öffentlichen [Photon-Dienst](https://github.com/komoot/photon) und lädt eine eingebettete [OpenStreetMap-Karte](https://wiki.openstreetmap.org/wiki/Export#Embeddable_HTML). Die konkrete Adresse sollte Stadt und Land enthalten, um Verwechslungen zu vermeiden. Es ist kein API-Schlüssel erforderlich. Erfolgreiche Ortssuchen werden im Arbeitsspeicher der Seite wiederverwendet; es gibt keine automatische Suche beim Laden oder Tippen. Ein Kartenlink bleibt auch ohne JavaScript und bei einem Fehler verfügbar. Bei `Ort: Online` wird keine Karte angeboten. Die öffentlichen Dienste garantieren keine Verfügbarkeit; für hohen Traffic sollte der Geocoder durch einen eigenen Dienst ersetzt werden. Die Content-Security-Policy erlaubt ausschließlich die konkret verwendeten zusätzlichen Hosts.

Freie Zusatzinformationen in `{…}` am Ende des Teasers verwenden auf Startseite und Artikelseite denselben Parser und dasselbe sichere Inhaltsrendering für Text, Listen, Überschriften, Bilder und Links. Im Hero erscheint bei vorhandenem Zusatztext oben rechts am Bild ein Ausrufezeichen im Kreis. Sein Panel liegt in einer eigenen, durchgehenden Grid-Zeile unter Bild und Vorschau. Auch im gestapelten Mobilformat verschiebt das Aufklappen weder Metadaten noch Vorschau oder Aktionen. Die kurze Ringanimation endet nach 4,8 Sekunden und entfällt bei reduzierter Bewegung. Während die Informationen im Hero geöffnet sind, pausiert dessen Newsrotation. Auf Artikelseiten erscheint unter dem Titelbild eine beschriftete Aufklappfläche „Zusätzliche Informationen“. Es werden daraus keine Felder oder Themen abgeleitet. Enter/Leertaste öffnet und schließt die Fläche; Escape schließt sie. Hinweis und Inhalt sind bereits im serverseitigen Artikel-HTML enthalten. Ohne Zusatztext entsteht kein leerer Bereich. Die Kategorie im Hero steht direkt neben dem Veröffentlichungsdatum.

## Gemeinsames Artikeldesign

`site/page/news/article.css` wird ausschließlich vom Artikeltemplate geladen. Breadcrumb, Kopf und Text teilen weiter eine 760 px breite Lesespalte. Plakate sind auf 820 px und 560 px beziehungsweise 64 vh Höhe begrenzt; fotografische Titelbilder dürfen bis 1040 px und 640 px beziehungsweise 68 vh einnehmen. Die Darstellungsklassen `nw-image--poster`, `nw-image--photo` und `nw-image--graphic` entstehen aus vorhandener Kategorie und Bildbeschreibung: etwa „Plakat“/„Poster“/„Афиша“ oder „Logo“/„Логотип“. Logos/Grafiken bleiben bis 300 px breit, weitere Fotos nutzen die Lesespalte. Kleine Bilder werden nicht hochskaliert. Es gibt keine Regeln für einzelne Bilddateien und keine neuen gespeicherten Bildfelder.

`article-images.js` prüft geladene Artikelbilder in einer höchstens 256 px großen Arbeitsfläche auf größere transparente Außenränder. Nur die Darstellung wird dann auf die sichtbaren Grenzen mit Sicherheitspolster begrenzt und als kompakte Grafik angeordnet. Die Originaldatei und der Link zur Vergrößerung bleiben unverändert. Bei nicht lesbaren Bildpixeln, etwa fremden Servern ohne passende Cross-Origin-Freigabe, greift unverändert die normale vollständige Darstellung. Opaque Bildränder werden nicht entfernt. Bildunterschriften stehen mit 6 px Abstand unter dem sichtbaren Bild. Bildlinks öffnen mit JavaScript einen zentrierten Dialog mit Schließen-Button/Escape und Fokus-Rückkehr, ohne JavaScript das Original in einem neuen Tab.

`newsCategoryMarkup` und `news-shared.css` verwenden die vorhandene Admin-Akzentfarbe in allen Ansichten mit identischer Farbpalette und Typografie; fehlende Akzente erhalten die bisherigen Standardfarben der Kategorie. Es gibt keine zweite redaktionell gepflegte Farbquelle. Verwandte Nachrichten teilen pro Rasterzeile Bildflächen und Kartenhöhe, ihre Leselinks schließen unten bündig ab. Fehlende Bilder erhalten eine farblich passende MIRoKIT-Ersatzfläche. Ortsangaben behalten ihre Daten und Funktionen; Kartenbutton und kleiner externer Link stehen in einer gemeinsamen Aktionsgruppe unmittelbar unter der Adresse.

Absatzlinks bieten bei Hover und Tastaturfokus eine schließbare Vorschau. Für bereits mitgelieferte Artikel werden Titel, Teaser und Bild aus den vorhandenen Daten verwendet; sonst zeigt die Karte Linktext, Domain und Zielpfad. Es gibt keinen Proxy und keine externen Seitenabrufe für Vorschaumetadaten. Tab führt in die Vorschau, Escape schließt sie; die ursprünglichen Links und Modifier-Klicks bleiben erhalten. Der Ortslink öffnet die bestehende Kartenvorschau; ein sichtbarer Schließen-Button entfernt den eingebetteten Frame und gibt den Fokus zurück.

## Prüfung

Die Routing- und Veröffentlichungstests stehen in `worker/src/news-pages.test.js`. Sie prüfen echte SQLite-Abfragen mit den vorhandenen Migrationen sowie lokalisierte serverseitige Inhalte, Metadaten, stabile Slugs, HTTP-Status, Weiterleitungen und sicheres Rendering.

Der optionale Browsercheck `node worker/scripts/check-news-pages.mjs` nutzt den echten Worker mit In-Memory-News und statischen Assets. Voraussetzung sind separat verfügbares `playwright-core` und Edge; `MIROKIT_PLAYWRIGHT_MODULE` und `MIROKIT_BROWSER_PATH` können vorhandene Installationen auswählen. Screenshots landen im ignorierten Verzeichnis `worker/.wrangler/news-browser-check/`. Der Check prüft direkte Aufrufe/Reloads, neue Tabs, Zurück-Navigation, Filter/Suche/Scrollposition, RU/EN/DE, Themes, Bilder, Downloads, Fehlerfälle und lange Texte. Er ersetzt keine Firefox- oder Produktionsprüfung. Der vorhandene Landing-Check prüft weiterhin die automatische Rotation mit echten Artikellinks.
