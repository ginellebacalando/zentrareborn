import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const targetPath = "C:/Users/jerom/Downloads/Mobile Devices/IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx";
const workDir = "C:/Users/jerom/Downloads/ZenTra-Web/.codex-spreadsheet-work-20261008";
const transferScriptPath = `${workDir}/update_tracker_staged.ps1`;
const authoredPath = `${workDir}/IAS-Test-Cases-Progress-Tracker-ZenTra.artifact-authored.xlsx`;
const authoredValuesPath = `${workDir}/authored-values.json`;
const verifyDir = `${workDir}/verify`;

const scriptText = await fs.readFile(transferScriptPath, "utf8");
const match = scriptText.match(/\$recordsJson\s*=\s*@'\r?\n([\s\S]*?)\r?\n'@/);
if (!match) {
  throw new Error("Could not find records JSON in transfer script.");
}
const records = JSON.parse(match[1]);
if (records.length !== 55) {
  throw new Error(`Expected 55 records, found ${records.length}`);
}

function rowForId(id) {
  const n = Number(id.slice(3));
  return n <= 2 ? 10 + n : 11 + n;
}

function recordToRow(record) {
  return [
    record.id,
    record.module,
    record.scenario,
    record.action,
    record.input,
    record.pass,
    record.fail,
    record.component,
    record.comment,
  ];
}

function cellAddress(colIndex, row) {
  let n = colIndex + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return `${letters}${row}`;
}

await fs.mkdir(verifyDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(targetPath));
const sheet = workbook.worksheets.getItem("Test Cases (Web)");

sheet.getRange("A11:I12").values = records.slice(0, 2).map(recordToRow);
sheet.getRange("A14:I66").values = records.slice(2).map(recordToRow);

const passCount = records.filter((record) => record.pass === "PASSED").length;
const failCount = records.filter((record) => record.fail === "FAILED").length;
const pendingCount = records.length - passCount - failCount;
sheet.getRange("H5").values = [[55]];
sheet.getRange("H6").values = [[passCount]];
sheet.getRange("H7").values = [[failCount]];
sheet.getRange("I6").values = [[passCount / 55]];

workbook.recalculate();

const ids = [
  ...sheet.getRange("A11:A12").values.flat(),
  ...sheet.getRange("A14:A66").values.flat(),
].filter((value) => /^ID-\d{3}$/.test(String(value ?? "")));
if (ids.length !== 55 || ids[0] !== "ID-001" || ids[54] !== "ID-055" || new Set(ids).size !== 55) {
  throw new Error(`Unexpected ID sequence after artifact authoring: ${ids.join(", ")}`);
}

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "artifact-authored formula error scan",
});
console.log("ARTIFACT_FORMULA_ERRORS");
console.log(formulaErrors.ndjson);

const authoredInspect = await workbook.inspect({
  kind: "region,formula",
  sheetId: "Test Cases (Web)",
  range: "A1:I66",
  maxChars: 24000,
  tableMaxRows: 70,
  tableMaxCols: 9,
  tableMaxCellChars: 140,
  options: { maxResults: 100 },
});
console.log("ARTIFACT_AUTHORED_INSPECT");
console.log(authoredInspect.ndjson);

const preview = await workbook.render({
  sheetName: "Test Cases (Web)",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${verifyDir}/artifact-authored-web.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(authoredPath);

const cells = [];
for (const record of records) {
  const row = rowForId(record.id);
  const values = recordToRow(record);
  for (let col = 0; col < values.length; col++) {
    cells.push({
      address: cellAddress(col, row),
      type: values[col] == null ? "blank" : "string",
      value: values[col] ?? null,
    });
  }
}
cells.push({ address: "H5", type: "number", value: 55 });
cells.push({ address: "H6", type: "number", value: passCount });
cells.push({ address: "H7", type: "number", value: failCount });
cells.push({ address: "I6", type: "number", value: passCount / 55 });

await fs.writeFile(
  authoredValuesPath,
  JSON.stringify(
    {
      authoredPath,
      cells,
      passCount,
      failCount,
      pendingCount,
      rating: passCount / 55,
    },
    null,
    2,
  ),
);

console.log(`ARTIFACT_AUTHORED_PATH ${authoredPath}`);
console.log(`AUTHORED_VALUES_PATH ${authoredValuesPath}`);
console.log(`STATUS_COUNTS pass=${passCount} fail=${failCount} pending=${pendingCount}`);
