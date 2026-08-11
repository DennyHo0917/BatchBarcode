# Vendored browser libraries

- `bwip-js-min.js`: bwip-js 4.5.1, downloaded from the pinned [jsDelivr package file](https://cdn.jsdelivr.net/npm/bwip-js@4.5.1/dist/bwip-js-min.js).
- SHA-256: `57E2F9EDF8B0800A16D74EB1B605D016D5141803A52BF8165C72CC1F6A799771`
- Used by every generator to render barcodes locally without a runtime CDN dependency.

- `xlsx.full.min.js`: SheetJS Community Edition 0.20.3, downloaded from the [official SheetJS CDN](https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js).
- SHA-256: `CC015130AA8521E7F088F88898EBA949CCDCBFB38DF0BD129B44B7273C3A6F41`
- Used only on `/barcode-generator/` to read `.xlsx` files locally in the browser.

- `jszip.min.js`: JSZip 3.10.1, downloaded from the [official GitHub release source](https://github.com/Stuk/jszip/blob/v3.10.1/dist/jszip.min.js).
- SHA-256: `ACC7E41455A80765B5FD9C7EE1B8078A6D160BBBCA455AEAE854DE65C947D59E`
- Used only on `/barcode-generator/` to package generated PNG files.

- `jspdf.umd.min.js`: jsPDF 4.2.1, downloaded from the package distribution linked by the [official jsPDF project](https://github.com/parallax/jsPDF).
- SHA-256: `E6551FCDC32F09D6853B2C5126D18D01D9447E0DA618A41A11EBEEE0F6C20D54`
- Used only on `/barcode-generator/` for direct client-side PDF download.
