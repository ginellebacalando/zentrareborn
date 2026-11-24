import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

// Read-only review: never exports or modifies the user's workbook.
const input = process.argv[2] ?? 'C:/Users/jerom/Downloads/Mobile Devices/IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx';
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
const sheet = workbook.worksheets.getItem('Test Cases (Web)');
const rows = sheet.getRange('A11:I66').values.filter(row => /^ID-\d{3}$/.test(String(row[0] ?? '')));
const passed = rows.filter(row => row[5] === 'PASSED').length;
const failed = rows.filter(row => row[6] === 'FAILED').length;
const pending = rows.filter(row => !row[5] && !row[6]).length;
const ids = rows.map(row => row[0]);
const sequential = ids.every((id, i) => id === `ID-${String(i + 1).padStart(3, '0')}`);
const summary = { total: sheet.getRange('H5').values[0][0], passed: sheet.getRange('H6').values[0][0], failed: sheet.getRange('H7').values[0][0], rating: sheet.getRange('I6').values[0][0] };
console.log(JSON.stringify({ count: rows.length, sequential, unique: new Set(ids).size, passed, failed, pending, summary, cases: rows.map(row => ({ id: row[0], module: row[1], pass: row[5], fail: row[6], comment: row[8] })) }, null, 2));
console.log((await workbook.inspect({ kind: 'match', searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!', options: { useRegex: true, maxResults: 100 }, maxChars: 2000 })).ndjson);
const output = 'C:/Users/jerom/Downloads/ZenTra-Web/.codex-spreadsheet-work/mothership-review';
await fs.mkdir(output, { recursive: true });
for (const [name, range] of [['summary', 'A1:I17'], ['admin', 'A32:I48'], ['integration', 'A54:I66']]) {
  const preview = await workbook.render({ sheetName: 'Test Cases (Web)', range, scale: 1.3, format: 'png' });
  await fs.writeFile(`${output}/${name}.png`, new Uint8Array(await preview.arrayBuffer()));
}
console.log(`PREVIEWS ${output}`);
