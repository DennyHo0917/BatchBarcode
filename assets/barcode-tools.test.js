const assert = require('node:assert/strict');
const XLSX = require('./vendor/xlsx.full.min.js');
const {
  parseBatchValues,
  parseCsv,
  looksLikeHeader,
  mapCsvRows,
  hasValidCheckDigit,
  validateValue,
  pageCountFor,
  countBucket,
  normalizeLayoutPreferences,
} = require('./barcode-tools.js');

assert.deepEqual(
  parseBatchValues('A,B\n"C,D",extra\n"Q""R",extra', 'csv').values,
  ['A', 'C,D', 'Q"R'],
);
assert.deepEqual(
  parseBatchValues('A,B\n"C,D"', 'lines').values,
  ['A,B', '"C,D"'],
);
assert.deepEqual(parseBatchValues('  ONE  \n\n中文-!@#', 'lines').values, ['ONE', '中文-!@#']);
assert.equal(parseBatchValues('', 'lines').total, 0);

const csvRows = parseCsv('\uFEFFsku,label,note\r\nA-1,"Shelf, A","Line 1\nLine 2"\r\nA-1,"Label ""two""",x\r\n,,empty');
assert.deepEqual(csvRows, [
  ['sku', 'label', 'note'],
  ['A-1', 'Shelf, A', 'Line 1\nLine 2'],
  ['A-1', 'Label "two"', 'x'],
  ['', '', 'empty'],
]);
assert.equal(looksLikeHeader(csvRows), true);
assert.equal(looksLikeHeader([['ABC', 'One'], ['DEF', 'Two']]), false);
assert.deepEqual(mapCsvRows(csvRows, true, 0, 1, 2), {
  records: [
    { value: 'A-1', label: 'Shelf, A', extra: 'Line 1\nLine 2', sourceRow: 2 },
    { value: 'A-1', label: 'Label "two"', extra: 'x', sourceRow: 3 },
  ],
  total: 2,
  empty: 1,
  duplicates: 1,
  truncated: false,
});
const mappedLimit = mapCsvRows(
  [['id'], ...Array.from({ length: 101 }, (_, index) => [`ID-${index}`])],
  true,
  0,
);
assert.equal(mappedLimit.total, 101);
assert.equal(mappedLimit.records.length, 100);
assert.equal(mappedLimit.truncated, true);

const tooMany = parseBatchValues(Array.from({ length: 101 }, (_, i) => `ITEM-${i}`).join('\n'));
assert.equal(tooMany.total, 101);
assert.equal(tooMany.values.length, 100);
assert.equal(tooMany.truncated, true);
assert.equal(parseBatchValues(Array.from({ length: 100 }, (_, i) => `ITEM-${i}`).join('\n')).truncated, false);

assert.equal(hasValidCheckDigit('5901234123457'), true);
assert.equal(hasValidCheckDigit('012345678905'), true);
assert.equal(validateValue('upca', '012345678906'), 'The UPC-A check digit is not valid.');
assert.equal(validateValue('ean13', 'ABC'), 'EAN-13 needs 12 or 13 digits.');
assert.equal(validateValue('pdf417', 'X'.repeat(901)), 'Keep PDF417 data under 900 characters for this online tool.');
assert.equal(validateValue('code128', 'ORDER-001'), '');
assert.equal(validateValue('code128', ''), 'Add data to encode.');
assert.equal(validateValue('qrcode', 'https://batchbarcode.com'), '');
assert.equal(validateValue('qrcode', ''), 'Add data to encode.');
assert.equal(validateValue('pdf417', 'DOC-001'), '');
assert.equal(validateValue('pdf417', ''), 'Add data to encode.');
assert.equal(pageCountFor(10, 3, 3), 2);
assert.equal(pageCountFor(8, 2, 4), 1);
assert.equal(pageCountFor(0, 2, 4), 0);
assert.deepEqual([0, 1, 2, 10, 11, 50, 51, 100, 101].map(countBucket), [
  '0', '1', '2_10', '2_10', '11_50', '11_50', '51_100', '51_100', '101_plus',
]);
assert.deepEqual(normalizeLayoutPreferences({
  preset: 'custom', pageSize: 'letter', margin: 12, columns: 3, rows: 6, gap: 5, scale: 4, showText: false, textPosition: 'top',
}), {
  preset: 'custom', pageSize: 'letter', margin: 12, columns: 3, rows: 6, gap: 5, scale: 4, showText: false, textPosition: 'top',
});
assert.deepEqual(normalizeLayoutPreferences({ margin: -1, columns: 9, rows: 'bad', gap: 21, scale: 0 }), {
  preset: 'a4-2x4', pageSize: 'a4', margin: 10, columns: 2, rows: 4, gap: 4, scale: 3, showText: true, textPosition: 'bottom',
});
assert.deepEqual(normalizeLayoutPreferences({ preset: 'letter-3x3' }), {
  preset: 'letter-3x3', pageSize: 'letter', margin: 12, columns: 3, rows: 3, gap: 5, scale: 3, showText: true, textPosition: 'top',
});

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
  ['sku', 'label', 'location'],
  [1001, 'Blue widget', 'A-01'],
  [1002, 'Red widget', 'B-02'],
]), 'Labels');
const workbookCopy = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
const worksheetRows = XLSX.utils.sheet_to_json(workbookCopy.Sheets.Labels, {
  header: 1, raw: false, defval: '', blankrows: false,
});
assert.deepEqual(worksheetRows, [
  ['sku', 'label', 'location'],
  ['1001', 'Blue widget', 'A-01'],
  ['1002', 'Red widget', 'B-02'],
]);
assert.equal(looksLikeHeader(worksheetRows), true);

console.log('barcode-tools tests passed');
