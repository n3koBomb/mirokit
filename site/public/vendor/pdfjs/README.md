# PDF.js 5.4.624

Lokale Browser-Dateien aus dem offiziellen npm-Paket `pdfjs-dist@5.4.624`.
Quelle: https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-5.4.624.tgz
Lizenz: Apache-2.0, siehe LICENSE und die mitgelieferten Lizenzen der Schriftdateien.

Verwendet ausschließlich im Admin-Panel: Die erste PDF-Seite wird lokal im Browser
gerendert und als WebP-Vorschaubild hochgeladen. Die öffentliche Bibliothek lädt
nur dieses Bild; dort ist keine PDF.js-Abhängigkeit erforderlich.

Bei Updates `pdf.min.mjs`, `pdf.worker.min.mjs`, `cmaps/`, `standard_fonts/` und
`wasm/` immer zusammen aus derselben Version ersetzen. Kein CDN-Laufzeitimport.
