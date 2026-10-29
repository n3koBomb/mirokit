# Datenschutzseite: Aufbau und Inhaltsgrenzen

Stand: **29. Oktober 2026**. Der Dateiname bleibt als bestehende Referenz erhalten; dieses Dokument beschreibt die aktuelle Umsetzung und verbleibende Prüfungen, keinen noch ausstehenden Seitenbau. Einstieg: [README](../../../README.md).

## Aktuelle Seite

`/page/privacyPolicy/` enthält ein Fenster mit zwei Dokument-Tabs:

| Tab / Hash | Inhalt |
| --- | --- |
| Russland / `#privacy-russia` | Russischer Richtlinientext, Ausgabe 2026, Kapitel 1–14 |
| EU / `#privacy-eu` | Englischer Originaltext der gelieferten Global Privacy Policy, Kapitel 1–21 und Final Statement |

Der russische Artikel hat `lang="ru"`, der EU-Artikel `lang="en"`. Der globale Sprachumschalter übersetzt die UI, nicht die Dokumenttexte. Der EU-Artikel enthält den gelieferten englischen Richtlinientext und die auf Nutzerwunsch übersetzte Erläuterung zur Besucherstatistik aus dem russischen Abschnitt 13.

## Dateien und Verhalten

- `index.html`: gemeinsamer Unterseiten-Header, Fenstershell, Tabs, russischer Artikel, englische Global Privacy Policy im EU-Tab und Footer.
- `privacy-policy.css`: seiteneigene Fenster-/Tab-/Dokumentdarstellung.
- `privacy-policy.js`: Panelwahl, Hash-Deep-Links, Browser-Zurück/Vorwärts und Tastatursteuerung.
- `../../source/style/style.css`, `subpage.css`: gemeinsame Gestaltung.
- `../../source/scripts/language.js`, `subpage.js`: UI-Sprache und Theme ohne Landingpage-Bootstrap.

Tabs verwenden `role=tablist|tab|tabpanel`, `aria-controls`, `aria-selected`, roving `tabIndex` und `hidden`. Pfeiltasten, Home und End aktivieren Tabs und bewegen den Fokus. `pushState`, `hashchange` und `popstate` halten URL und Auswahl zusammen.

Kapitel-Links wie `#privacy-6` aktivieren den russischen Artikel, auch wenn zuvor EU offen war. `#privacy-eu-1` bis `#privacy-eu-21` und `#privacy-eu-final-statement` aktivieren den EU-Artikel. Ohne passenden Hash wird das erste Panel gewählt. Es gibt normalen vertikalen Dokument-Scroll; ein langes Richtliniendokument ist keine horizontale Landingpage-Panelansicht.

## Russische Inhaltsquelle

Die ursprüngliche Vorgabe benennt die sieben Seiten umfassende Datei `ПОЛИТИКА обработки персональных данных 2026.pdf` als freigegebene Quelle. Der dabei früher genannte persönliche Downloadpfad ist kein portabler Repository-Pfad. Der Dokumentationsaudit hat die Original-PDF nicht erneut gegen den HTML-Wortlaut abgeglichen; die Textidentität ist damit nicht neu bestätigt.

Bei einem erneuten Abgleich gelten die ursprünglichen Inhaltsgrenzen:

- Wortlaut, Reihenfolge, Nummerierung, vollständige Aufzählungen, Links und E-Mail erhalten.
- Keine Kürzung, Umformulierung, automatische Übersetzung oder zusätzliche rechtliche Aussage.
- Seitenumbrüche aus der PDF sind keine inhaltlichen Abschnittsgrenzen.
- Nur semantische HTML-Struktur und lesbare Formatierung ändern.
- Keine `data-key`-Ersetzung des eigentlichen freigegebenen Richtlinientextes.

Erhaltene Originalangaben:

- `ПОЛИТИКА в отношении обработки персональных данных Международной Лиги детской дипломатии «МИРоКИТ»`
- `Редакция от 2026 года`
- `https://ligamirokit.ru`, `https://mirokit.ru`
- `mirokit2025@gmail.com`

## Kapitelstruktur

| Nr. | Abschnitt |
| --- | --- |
| 1 | Общие положения |
| 2 | Основные понятия |
| 3 | Правовые основания обработки персональных данных |
| 4 | Цели обработки персональных данных |
| 5 | Категории субъектов персональных данных, категории и состав обрабатываемых персональных данных |
| 6 | Порядок и условия обработки персональных данных |
| 7 | Сроки хранения персональных данных |
| 8 | Обработка персональных данных несовершеннолетних |
| 9 | Права субъекта персональных данных |
| 10 | Обязанности Оператора |
| 11 | Меры по обеспечению безопасности персональных данных |
| 12 | Трансграничная передача персональных данных |
| 13 | Использование файлов cookie |
| 14 | Заключительные положения |

Stabile Sprungmarken sind `privacy-1` bis `privacy-14`; Kapitel 14 endet mit Klausel 14.4. Die Inhaltsübersicht ist Navigation und kein Ersatz für den Text.

## Englische Inhaltsquelle

Quelle ist die vom Nutzer gelieferte, 13-seitige Datei `GLOBAL PRIVACY POLICY International Children2026.pdf`. Ihr vollständiger Text steht im EU-Tab: Originaltitel, Website-Angaben, `Effective Date: 01.01.2026`, `Last Updated: 01.01.2026`, Kapitel 1–21, neun Datenschutzprinzipien als Tabelle, 238 Aufzählungspunkte und Final Statement.

Wortlaut, Reihenfolge, Schreibweisen, Links und Kontaktdaten des PDF-Textes bleiben erhalten. PDF-Seitennummern und druckbedingte Zeilen-/Seitenumbrüche werden nicht als Inhalt übernommen. Der PDF-Text wird weder übersetzt noch um zusätzliche rechtliche Aussagen ergänzt. Die PDF selbst ist nicht im Repository enthalten.

Auf ausdrücklichen Nutzerwunsch wurde am 29. Oktober 2026 der Statistikabsatz aus dem russischen Abschnitt `#privacy-13` ins Englische übertragen und am Anfang von Kapitel 16 als `#privacy-eu-visitor-statistics` ergänzt. Er beschreibt die Statistik ohne Cookies oder Besucherkennungen, die gespeicherten Felder, den öffentlichen Status-Link, den Administratorzugriff, beide 90-Tage-Fristen, die Löschung beim nächsten erfassten Zugriff sowie die gesonderten Bot-/DNT-/GPC-Zähler. Dieser Absatz stammt aus der russischen Webseite, nicht aus der englischen PDF.

## Technischer Abgleich vom 29. Oktober 2026

Der vollständige aus der PDF extrahierte Text stimmt nach Normalisierung von Leerraum und Listenmarkierungen mit dem EU-Artikel ohne den zusätzlich übersetzten Statistikabsatz überein. Alle 238 Listenpunkte sind enthalten; der russische Artikel ist unverändert. `git diff --check` und die Syntaxprüfung aller 56 JavaScript-Dateien/Inline-Skripte bestanden.

Eine lokale Edge-Prüfung bestätigte die EU-Direktverlinkung, Tabwechsel per Klick und Tastatur, russische und englische Kapitel-Links, Browser-Zurück/Vorwärts, dunkles Theme und überlauffreie Darstellung bei 1440, 375 und 320 Pixel Breite. Es traten keine unbehandelten JavaScript-Fehler auf.

## Noch zu prüfen

Betreiberangaben, Rechtsgrundlagen und Fristen nicht aus dem Projektcode ableiten. Eine technische Dokumentation ersetzt keine rechtliche Prüfung.

Vor Veröffentlichung verbleiben insbesondere die Prüfung in Firefox und bei 200-Prozent-Textgröße. Der technische Text- und Browserabgleich bestätigt keine rechtliche Abnahme.
