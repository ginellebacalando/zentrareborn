import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = "C:/Users/jerom/Downloads/IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx";
const outputDir = "C:/Users/jerom/Downloads/ZenTra-Web/.codex-spreadsheet-work/verify";

await fs.mkdir(outputDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const sheet = workbook.worksheets.getItem("Test Cases (Web)");
const ids = sheet
  .getRange("A11:A66")
  .values
  .flat()
  .filter((value) => /^ID-\d{3}$/.test(String(value ?? "")));

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final saved formula error scan",
});

const preview = await workbook.render({
  sheetName: "Test Cases (Web)",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${outputDir}/Test Cases (Web) - saved original.png`, new Uint8Array(await preview.arrayBuffer()));

console.log(`OPENED ${workbookPath}`);
console.log(`WEB_TEST_CASE_COUNT ${ids.length}`);
console.log(`FIRST_ID ${ids[0]}`);
console.log(`LAST_ID ${ids[ids.length - 1]}`);
console.log(`PROJECT_NAME ${sheet.getRange("B4").values[0][0]}`);
console.log(`TOTAL ${sheet.getRange("H5").values[0][0]}`);
console.log(`PASS ${sheet.getRange("H6").values[0][0]}`);
console.log(`FAIL ${sheet.getRange("H7").values[0][0]}`);
console.log(`RATING ${sheet.getRange("I6").values[0][0]}`);
console.log("FORMULA_ERRORS");
console.log(formulaErrors.ndjson);
