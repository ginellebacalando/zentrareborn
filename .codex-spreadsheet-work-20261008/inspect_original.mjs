import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const targetPath = "C:/Users/jerom/Downloads/Mobile Devices/IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx";
const outDir = "C:/Users/jerom/Downloads/ZenTra-Web/.codex-spreadsheet-work-20261008/original";

await fs.mkdir(outDir, { recursive: true });

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(targetPath));

const overview = await workbook.inspect({
  kind: "workbook,sheet,table,definedName,drawing,formula",
  maxChars: 24000,
  tableMaxRows: 80,
  tableMaxCols: 12,
  tableMaxCellChars: 160,
  options: { maxResults: 200 },
});
console.log("OVERVIEW");
console.log(overview.ndjson);

for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  const region = await workbook.inspect({
    kind: "region,formula,computedStyle",
    sheetId: sheet.name,
    range: used.address,
    maxChars: 50000,
    tableMaxRows: 90,
    tableMaxCols: 20,
    tableMaxCellChars: 160,
    options: { maxResults: 300 },
  });
  console.log(`SHEET ${sheet.name} USED ${used.address}`);
  console.log(region.ndjson);

  const preview = await workbook.render({
    sheetName: sheet.name,
    autoCrop: "all",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    `${outDir}/${sheet.name.replace(/[\\/:*?"<>|]/g, "_")}.png`,
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const mobile = workbook.worksheets.getItem("Test Cases (Mobile)");
const mobileUsed = mobile.getUsedRange();
const mobileSnapshot = {
  used: mobileUsed.address,
  values: mobileUsed.values,
  formulas: mobileUsed.formulas,
};
await fs.writeFile(`${outDir}/mobile-baseline.json`, JSON.stringify(mobileSnapshot, null, 2));
