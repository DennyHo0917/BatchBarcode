# BatchBarcode

[BatchBarcode](https://www.batchbarcode.com/) is a static, browser-only barcode workflow for turning text, CSV or Excel rows into printable labels. The main batch tool supports field mapping, validation, A4/Letter layout, PNG ZIP, direct PDF and browser printing without uploading barcode data.

Key pages: [Batch generator](https://www.batchbarcode.com/barcode-generator/) | [PDF417 generator](https://www.batchbarcode.com/) | [Privacy](https://www.batchbarcode.com/privacy/) | [Contact](https://www.batchbarcode.com/contact/) | [Sitemap](https://www.batchbarcode.com/sitemap.xml)

## Local development

Serve the repository root with any static HTTP server, then open `/barcode-generator/`. No build step is required.

```powershell
python -m http.server 10887
```

## Checks

```powershell
node assets/barcode-tools.test.js
node scripts/audit-site.js
```

See `TODO.md` for status, `docs/seo-audit-2026-08-11.md` for the Search Console baseline, and `docs/monetization-plan.md` for the first validation and pricing hypotheses.
