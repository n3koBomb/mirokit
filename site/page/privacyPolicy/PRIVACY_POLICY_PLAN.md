# Aufbauplan: Privacy-Policy-Seite

## 1. Verbindliche Inhaltsquelle

Die Datei `/home/nikas/Downloads/ПОЛИТИКА обработки персональных данных 2026.pdf` ist die alleinige Quelle für den Inhalt der Richtlinie.

- Umfang: 7 A4-Seiten, Edition 2026.
- Sprache des Rechtstextes: Russisch.
- Der Rechtstext wird vollständig übernommen: nichts kürzen, zusammenfassen, umformulieren, übersetzen oder inhaltlich ergänzen.
- Die originale Bedeutung, Reihenfolge, Nummerierung, URLs und E-Mail-Adresse bleiben erhalten.
- Die Dokumentausgabe muss alle Kapitel 1–14 und alle Unterpunkte 1.1–14.4 enthalten.
- Erlaubt sind nur HTML-Struktur und visuelle Formatierung, die die Lesbarkeit verbessern, ohne den Text zu verändern.
- Keine zusätzlichen rechtlichen Aussagen, keine erfundenen Fristen, Verantwortlichen, Cookie-Anbieter oder Kontaktdaten.

Originalangaben, die exakt erhalten bleiben müssen:

- Titel: `ПОЛИТИКА в отношении обработки персональных данных Международной Лиги детской дипломатии «МИРоКИТ»`
- Versionsangabe: `Редакция от 2026 года`
- Websites: `https://ligamirokit.ru` und `https://mirokit.ru`
- E-Mail: `mirokit2025@gmail.com`

## 2. Vollständige Inhaltsgliederung der PDF

Die HTML-Seite wird anhand dieser vollständigen Gliederung aufgebaut. Die Abschnittstitel und nummerierten Klauseln werden aus der PDF übernommen, nicht neu formuliert.

1. **Общие положения** — 1.1 bis 1.5
2. **Основные понятия** — Definitionen zu personenbezogenen Daten, Betreiber, Verarbeitung, automatisierter Verarbeitung, Verbreitung, Bereitstellung und Vernichtung
3. **Правовые основания обработки персональных данных** — gesetzliche Grundlagen und Einwilligung/Durchführung gesetzlicher oder vertraglicher Pflichten
4. **Цели обработки персональных данных** — sieben aufgezählte Verarbeitungszwecke
5. **Категории субъектов персональных данных, категории и состав обрабатываемых персональных данных**
   - 5.1 Kategorien der betroffenen Personen
   - 5.2 Kategorien der personenbezogenen Daten
   - 5.3 Keine besonderen Kategorien, außer gesetzlich vorgesehen
   - 5.4 Keine biometrischen Daten, außer gesetzlich oder durch separate schriftliche Einwilligung vorgesehen
6. **Порядок и условия обработки персональных данных** — 6.1 bis 6.6, einschließlich zulässiger Verarbeitungsvorgänge und Anforderungen an Umfang, Genauigkeit, Ausreichendheit und Aktualität
7. **Сроки хранения персональных данных** — 7.1 bis 7.3
8. **Обработка персональных данных несовершеннолетних** — 8.1 bis 8.4, einschließlich Zustimmung gesetzlicher Vertreter und zusätzlicher Schutzmaßnahmen
9. **Права субъекта персональных данных** — 9.1 bis 9.3, einschließlich der vollständigen Liste der Rechte und der E-Mail für Anfragen
10. **Обязанности Оператора** — 10.1 bis 10.3
11. **Меры по обеспечению безопасности персональных данных** — 11.1 bis 11.3
12. **Трансграничная передача персональных данных** — 12.1 bis 12.3
13. **Использование файлов cookie** — 13.1 bis 13.3
14. **Заключительные положения** — 14.1 bis 14.4, einschließlich Geltungsbeginn, Änderungen, Verfügbarkeit und Kontakt

Wichtig für die spätere Umsetzung: Seitenumbrüche aus der PDF werden nicht als inhaltliche Trennungen interpretiert. Ein Satz oder eine Aufzählung, die in der PDF über zwei Seiten läuft, wird im Web vollständig und zusammenhängend dargestellt.

PDF-Seitenprüfung:

- Seite 1: Dokumentkopf, Kapitel 1 vollständig, Kapitel 2 beginnt.
- Seite 2: Kapitel 2 endet, Kapitel 3 und 4 vollständig.
- Seite 3: Kapitel 5 vollständig, Kapitel 6 beginnt.
- Seite 4: Kapitel 6 endet, Kapitel 7 vollständig, Kapitel 8 beginnt.
- Seite 5: Kapitel 8 endet, Kapitel 9 und 10 vollständig, Kapitel 11 beginnt.
- Seite 6: Kapitel 11 endet, Kapitel 12 und 13 vollständig, Kapitel 14 beginnt.
- Seite 7: Kapitel 14.3 und 14.4; Dokumentende.

## 3. Ziel der Seite und Einordnung in das Projekt

Die bestehende Datei `page/privacyPolicy/index.html` ist derzeit nur ein leerer Platzhalter. Daraus wird eine eigenständige, direkt aufrufbare Richtlinienseite unter `/page/privacyPolicy/`.

Die Seite übernimmt die visuelle Sprache der Startseite aus `index.html` und `source/style/style.css`, aber nicht deren horizontales Panel-Verhalten. Ein sieben Seiten langer Rechtstext benötigt einen normalen vertikalen Dokument-Scroll auf allen Bildschirmgrößen.

Empfohlene DOM-Hierarchie:

```text
body.privacy-page
├── header.topbar
│   ├── brand → zurück zur Startseite
│   └── kompakte Seitennavigation / Zurück-Link
├── main.privacy-main
│   └── article.privacy-document
│       ├── Dokumentkopf: exakter Titel + exakte Editionsangabe
│       ├── optionales Inhaltsverzeichnis mit Sprungmarken 1–14
│       └── privacy-content
│           ├── section#privacy-1
│           ├── section#privacy-2
│           ├── ...
│           └── section#privacy-14
└── footer.fixed-footer oder normaler Dokument-Footer
```

Für die eigentlichen Richtlinienabschnitte gilt:

- Jedes Hauptkapitel erhält ein eigenes `<section>` mit stabilem `id`.
- Hauptkapitel werden mit `<h2>` und Unterkapitel mit `<h3>` ausgezeichnet, wobei die Nummer und der originale russische Titel erhalten bleiben.
- Nummerierte Klauseln bleiben als einzelne nummerierte Textblöcke lesbar.
- PDF-Aufzählungen werden als semantische `<ul>`-Listen umgesetzt; der Wortlaut der Listeneinträge bleibt unverändert.
- Definitionen in Kapitel 2 werden als einzelne Absätze oder als `<dl>` dargestellt, ohne Begriffe zusammenzulegen.
- E-Mail und Websites dürfen anklickbar sein (`mailto:` bzw. externe Links), aber der sichtbare Text bleibt exakt wie in der PDF.
- Es werden keine Zusammenfassungsboxen innerhalb des Rechtstextes eingefügt, die als neue rechtliche Aussagen missverstanden werden könnten.
- Der Rechtstext erhält keine `data-key`-Attribute aus dem Übersetzungssystem der Startseite, damit `source/scripts/main.js` ihn nicht dynamisch ersetzt oder verkürzt.
- Eine Inhaltsübersicht darf nur aus den originalen Kapitelnummern und -titeln bestehen; sie ist Navigation und kein Ersatz für den vollständigen Text.

## 4. Visuelles System aus `style.css`

Die Seite verwendet die vorhandenen Root-Variablen als Designgrundlage:

- Grundfarben: `--bld`, `--dk`, `--bl`, `--bl2`, `--bll`, `--bg`, `--paper`, `--muted`
- Akzentfarben nur sparsam für Navigation, Links und Fokuszustände: `--rd`, `--orange`, `--green`, `--violet`, `--cyan`, `--gold`
- Oberflächen: `--shadow` und `--soft-shadow`
- Shell-Höhen: `--nav-h` und `--footer-h`
- Typografie wie auf der Startseite: `Inter` für Fließtext, `Montserrat` für Titel und Navigation; russische Zeichen müssen vollständig unterstützt werden.

Geplante Gestaltung:

- Heller Seitenhintergrund mit einer zentralen weißen Dokumentfläche.
- Dokumentbreite begrenzen, damit lange russische Zeilen gut lesbar bleiben; auf Mobilgeräten volle verfügbare Breite mit ausreichendem Rand.
- Titelbereich klar vom Rechtstext trennen, aber ohne zusätzliche rechtliche Interpretation.
- Kapitelabstände, feine Trennlinien und dezente Akzentfarbe für Orientierung.
- Links deutlich erkennbar, Tastaturfokus aus dem bestehenden Fokus-System übernehmen.
- Kontrast, Textgröße, Zeilenhöhe und Touch-Flächen auf kleine Bildschirme auslegen.

Technische CSS-Regel:

- Die bestehende globale Regel für den Desktop-Panel-Modus setzt `body` ab `721px` Breite und `480px` Höhe auf `overflow: hidden`. Für die Richtlinienseite muss deshalb ein klar gescopter Override wie `body.privacy-page` den normalen vertikalen Scroll wieder aktivieren.
- Keine `.h-scroll`-Leinwand und keine `.panel`-Sections für den Rechtstext verwenden.
- Gemeinsame Klassen wie `.topbar`, `.brand`, `.fixed-footer`, Buttons und Fokuszustände können wiederverwendet werden; Privacy-spezifische Regeln werden unter `.privacy-page` bzw. `.privacy-document` gekapselt.
- Bestehende Breakpoints aus der Startseite bleiben die Orientierung: mobile Basis, 600px, 721px, 900px, 1081px, 1200px und 1440px. Sie werden für Lesbarkeit angepasst, nicht für horizontales Snapping.
- `prefers-reduced-motion` respektieren; für eine statische Richtlinienseite sind Animationen nicht erforderlich.

## 5. Navigation und Formularverknüpfung

Die Seite muss von der Website aus erreichbar sein und zurückführen können.

- Die Links `Политике конфиденциальности` in den Formularen der `index.html` werden später auf `./page/privacyPolicy/` bzw. den im Deployment gültigen Pfad gesetzt.
- Die Zustimmungstexte in den Formularen werden dabei nicht inhaltlich neu formuliert.
- Der Link aus der Privacy-Policy-Seite zurück zur Startseite zeigt auf `../../index.html` bzw. den passenden Produktionspfad.
- Ein Footer-Link zur Richtlinie kann ergänzt werden, sofern er nur Navigation ist und keinen neuen Rechtstext einführt.
- Die PDF ist russisch. Eine automatische Übersetzung über den vorhandenen Sprachumschalter darf den Rechtstext nicht ersetzen, solange keine geprüften und ausdrücklich freigegebenen Übersetzungen vorliegen.

## 6. Umsetzungs- und Prüfplan für den nächsten Schritt

1. Den exakten russischen Text aus allen 7 PDF-Seiten in die HTML-Struktur übertragen.
2. Gegen die Gliederung oben prüfen: Kapitel 1–14, Unterpunkte 1.1–14.4, Listen, URLs und E-Mail vollständig vorhanden.
3. `page/privacyPolicy/index.html` als eigenständige Seite mit korrektem `lang="ru"`, Seitentitel und verknüpftem Stylesheet aufbauen.
4. Privacy-spezifische CSS-Regeln in `source/style/style.css` ergänzen, ohne bestehende Startseiten-Regeln oder uncommittete Nutzeränderungen zu überschreiben.
5. Formular- und Footer-Links auf die neue Seite verbinden.
6. Auf Mobilgerät, Tablet, Desktop und niedriger Bildschirmhöhe testen; insbesondere sicherstellen, dass der komplette Text erreichbar ist und nicht durch Topbar/Footer verdeckt wird.
7. Textvergleich gegen die vollständige PDF durchführen. Bei Abweichungen gilt die PDF; keine redaktionelle Korrektur oder juristische Verbesserung wird eigenmächtig vorgenommen.

## 7. Abgrenzung

Dieser Plan beschreibt die technische und visuelle Umsetzung. Er stellt keine juristische Prüfung der Richtlinie dar. Inhaltliche, rechtliche oder sprachliche Änderungen am Dokument werden nur nach ausdrücklicher Freigabe vorgenommen.
