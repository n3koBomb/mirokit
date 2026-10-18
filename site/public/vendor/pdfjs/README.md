# PDF.js 5.4.624

Lokale Browser-Dateien aus `pdfjs-dist@5.4.624`. Die Versionskennung steht auch im ausgelieferten `pdf.min.mjs`. Technischer Abgleich: 18. Oktober 2026.

Quelle: [offizielles npm-Paket](https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-5.4.624.tgz). Lizenz: Apache-2.0; siehe [LICENSE](LICENSE) sowie die mitgelieferten Font-, CMap- und WASM-Lizenzdateien. Die proprietäre Projektlizenz ersetzt diese Bedingungen nicht.

## Verwendung

`site/admin/online-project-media.js` importiert `pdf.min.mjs` erst für eine PDF-Vorschau und setzt `GlobalWorkerOptions.workerSrc` auf das lokale `pdf.worker.min.mjs`. CMaps, Standardschriften und WASM werden relativ zum selben Verzeichnis aufgelöst; es gibt keinen CDN-Laufzeitimport.

Die erste Seite wird im Admin-Browser in ein Canvas gerendert und als WebP mit der PDF hochgeladen. Der Code begrenzt die Vorschau auf eine Skalierung für höchstens etwa 800 × 1600 Pixel, setzt `isEvalSupported: false` und zerstört den Ladeauftrag im `finally`-Block. Das ist keine vollständige PDF-Inhalts- oder Sicherheitsprüfung.

Die öffentliche Online-Projekte-Bibliothek lädt das gespeicherte Bild und verlinkt die PDF in einem neuen Tab. Sie importiert PDF.js nicht. Ein passwortgeschütztes oder nicht renderbares Dokument kann keine erforderliche Vorschau liefern.

## Updates

`pdf.min.mjs`, `pdf.worker.min.mjs`, `cmaps/`, `standard_fonts/` und `wasm/` gemeinsam aus derselben Paketversion ersetzen und alle zugehörigen Lizenzdateien erhalten. API und Worker dürfen nicht unbemerkt unterschiedliche Versionen verwenden.

Nach einem Update mindestens PDF-Import, erste Seite, eingebettete/Standardschriften, CMaps/WASM, Vorschau-Upload und Fehlerfälle im Browser prüfen. Die reguläre Syntaxprüfung überspringt `site/public/`; die Worker-Unit-Tests rendern keine PDF. Die Versionsangabe ist kein aktueller CVE- oder Supply-Chain-Nachweis.

Verträge und Prüfgrenzen: [Online-Medien](../../../../docs/online-project-media.md).
