import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = "C:/Users/jerom/Downloads/IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));

const inspect = await workbook.inspect({
  kind: "table",
  include: "id,name,sheet,address,rows,cols",
  maxChars: 4000,
});
console.log(inspect.ndjson);

for (const line of inspect.ndjson.trim().split(/\n/)) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  if (record.kind === "table" && record.sheet === "Test Cases (Web)" && record.id) {
    const table = workbook.resolve(record.id);
    console.log(`resolved ${record.id}: ${Boolean(table)}`);
    console.log(`hasRows ${Boolean(table?.rows)}`);
  }
}
