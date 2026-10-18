# Datenschutzseite: Aufbau und Inhaltsgrenzen

Stand: **18. Oktober 2026**. Der Dateiname bleibt als bestehende Referenz erhalten; dieses Dokument beschreibt die aktuelle Umsetzung und verbleibende Prüfungen, keinen noch ausstehenden Seitenbau. Einstieg: [README](../../../README.md).

## Aktuelle Seite

`/page/privacyPolicy/` enthält ein Fenster mit zwei Dokument-Tabs:

| Tab / Hash | Inhalt |
| --- | --- |
| Russland / `#privacy-russia` | Russischer Richtlinientext, Ausgabe 2026, Kapitel 1–14 |
| EU / `#privacy-eu` | Englischer Platzhalter; noch keine ausgearbeitete EU-Richtlinie |

Der russische Artikel hat `lang="ru"`, der EU-Artikel `lang="en"`. Der globale Sprachumschalter übersetzt die UI, nicht die Dokumenttexte. Das EU-Panel nennt Article 6 GDPR als Platzhalterhinweis; daraus folgt keine abgeschlossene rechtliche Bewertung oder freigegebene Rechtsgrundlage.

## Dateien und Verhalten

- `index.html`: gemeinsamer Unterseiten-Header, Fenstershell, Tabs, russischer Artikel, EU-Platzhalter und Footer.
- `privacy-policy.css`: seiteneigene Fenster-/Tab-/Dokumentdarstellung.
- `privacy-policy.js`: Panelwahl, Hash-Deep-Links, Browser-Zurück/Vorwärts und Tastatursteuerung.
- `../../source/style/style.css`, `subpage.css`: gemeinsame Gestaltung.
- `../../source/scripts/language.js`, `subpage.js`: UI-Sprache und Theme ohne Landingpage-Bootstrap.

Tabs verwenden `role=tablist|tab|tabpanel`, `aria-controls`, `aria-selected`, roving `tabIndex` und `hidden`. Pfeiltasten, Home und End aktivieren Tabs und bewegen den Fokus. `pushState`, `hashchange` und `popstate` halten URL und Auswahl zusammen.

Kapitel-Links wie `#privacy-6` aktivieren den russischen Artikel, auch wenn zuvor EU offen war. Ohne passenden Hash wird das erste Panel gewählt. Es gibt normalen vertikalen Dokument-Scroll; ein langes Richtliniendokument ist keine horizontale Landingpage-Panelansicht.

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

## Noch zu prüfen

Die EU-Richtlinie muss als ausdrücklich freigegebener Text geliefert werden. Betreiberangaben, Rechtsgrundlagen und Fristen nicht aus dem Projektcode ableiten. Eine technische Dokumentation ersetzt weder die Inhaltsfreigabe noch eine rechtliche Prüfung.

Vor Veröffentlichung Wortlaut mit der Originalquelle vergleichen und regionale Tabs, Kapitel-Deep-Links, Sprache, Themes, Tastatur/Fokus, 200-Prozent-Textgröße, schmale Breiten und niedrige Viewports im Browser prüfen. Die aktuellen statischen Checks bestätigen keine Browser- oder Rechtsabnahme.
