import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = "C:/Users/jerom/Downloads/IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx";
const outputDir = "C:/Users/jerom/Downloads/ZenTra-Web/.codex-spreadsheet-work/inspect";

await fs.mkdir(outputDir, { recursive: true });

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table,definedName,drawing",
  maxChars: 12000,
  tableMaxRows: 8,
  tableMaxCols: 12,
  tableMaxCellChars: 120,
});
console.log("OVERVIEW");
console.log(overview.ndjson);

const sheets = workbook.worksheets.items;
for (const sheet of sheets) {
  const used = sheet.getUsedRange();
  console.log(`SHEET ${sheet.name} USED ${used.address}`);
  const region = await workbook.inspect({
    kind: "region",
    sheetId: sheet.name,
    range: used.address,
    maxChars: 20000,
    tableMaxRows: 80,
    tableMaxCols: 20,
    tableMaxCellChars: 180,
  });
  console.log(region.ndjson);

  const preview = await workbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    `${outputDir}/${sheet.name.replace(/[\\/:*?"<>|]/g, "_")}.png`,
    new Uint8Array(await preview.arrayBuffer()),
  );
}
