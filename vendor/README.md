# Bundled server runtime dependencies (no npm registry needed to start the site).

| Package | Version | License | Upstream |
|---------|---------|---------|----------|
| adm-zip | 0.5.18 | MIT | https://github.com/cthackers/adm-zip |
| pdf-parse | 2.4.5 | Apache-2.0 | https://github.com/mehmet-kozan/pdf-parse |
| pdfjs-dist | 5.4.296 | Apache-2.0 | https://github.com/mozilla/pdf.js |

Refresh from npm (maintainers only, requires network):

```bash
npm install adm-zip@0.5.18 pdf-parse@2.4.5
npm run refresh-vendor
```
