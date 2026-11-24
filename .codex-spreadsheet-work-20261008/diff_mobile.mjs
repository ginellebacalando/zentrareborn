import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workDir = "C:/Users/jerom/Downloads/ZenTra-Web/.codex-spreadsheet-work-20261008";
const baseline = JSON.parse(await fs.readFile(`${workDir}/original/mobile-baseline.json`, "utf8"));
const staged = await SpreadsheetFile.importXlsx(await FileBlob.load(`${workDir}/IAS-Test-Cases-Progress-Tracker-ZenTra.staged.xlsx`));
const mobile = staged.worksheets.getItem("Test Cases (Mobile)");
const used = mobile.getUsedRange();
const snapshot = { used: used.address, values: used.values, formulas: used.formulas };

console.log(`baseline used=${baseline.used} staged used=${snapshot.used}`);
for (const key of ["values", "formulas"]) {
  for (let r = 0; r < Math.max(baseline[key].length, snapshot[key].length); r++) {
    const aRow = baseline[key][r] ?? [];
    const bRow = snapshot[key][r] ?? [];
    for (let c = 0; c < Math.max(aRow.length, bRow.length); c++) {
      const a = aRow[c] ?? null;
      const b = bRow[c] ?? null;
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        console.log(`${key} diff R${r + 1}C${c + 1}: baseline=${JSON.stringify(a)} staged=${JSON.stringify(b)}`);
        process.exit(0);
      }
    }
  }
}
console.log("no diff found");
