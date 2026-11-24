import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workDir = "C:/Users/jerom/Downloads/ZenTra-Web/.codex-spreadsheet-work-20261008";
const verifyDir = `${workDir}/verify`;
const baselinePath = `${workDir}/original/mobile-baseline.json`;
const pathToVerify = process.argv[2] ?? `${workDir}/IAS-Test-Cases-Progress-Tracker-ZenTra.staged.xlsx`;
const label = process.argv[3] ?? "staged";

await fs.mkdir(verifyDir, { recursive: true });

const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"));
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(pathToVerify));

const sheetNames = workbook.worksheets.items.map((sheet) => sheet.name);
if (sheetNames.join("|") !== "Test Cases (Web)|Test Cases (Mobile)") {
  throw new Error(`Unexpected sheet names/order: ${sheetNames.join("|")}`);
}

const web = workbook.worksheets.getItem("Test Cases (Web)");
const mobile = workbook.worksheets.getItem("Test Cases (Mobile)");

const ids = [
  ...web.getRange("A11:A12").values.flat(),
  ...web.getRange("A14:A66").values.flat(),
].filter((value) => /^ID-\d{3}$/.test(String(value ?? "")));
if (ids.length !== 55 || ids[0] !== "ID-001" || ids[54] !== "ID-055" || new Set(ids).size !== 55) {
  throw new Error(`Unexpected web ID sequence in ${label}: ${ids.join(", ")}`);
}

const passValues = [
  ...web.getRange("F11:F12").values.flat(),
  ...web.getRange("F14:F66").values.flat(),
];
const failValues = [
  ...web.getRange("G11:G12").values.flat(),
  ...web.getRange("G14:G66").values.flat(),
];
const passCount = passValues.filter((value) => value === "PASSED").length;
const failCount = failValues.filter((value) => value === "FAILED").length;
const pendingCount = 55 - passCount - failCount;

const summary = {
  total: web.getRange("H5").values[0][0],
  pass: web.getRange("H6").values[0][0],
  fail: web.getRange("H7").values[0][0],
  rating: web.getRange("I6").values[0][0],
};
if (summary.total !== 55 || summary.pass !== passCount || summary.fail !== failCount) {
  throw new Error(`Summary mismatch in ${label}: ${JSON.stringify(summary)} counts pass=${passCount} fail=${failCount}`);
}

const mobileUsed = mobile.getUsedRange();
const mobileSnapshot = {
  used: mobileUsed.address,
  values: mobileUsed.values,
  formulas: mobileUsed.formulas,
};
if (mobileSnapshot.used !== baseline.used || JSON.stringify(mobileSnapshot.formulas) !== JSON.stringify(baseline.formulas)) {
  throw new Error(`Mobile sheet used range/formulas changed in ${label}`);
}

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: `${label} formula error scan`,
});

const webRender = await workbook.render({
  sheetName: "Test Cases (Web)",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${verifyDir}/${label}-web.png`, new Uint8Array(await webRender.arrayBuffer()));

console.log(`VERIFY_FILE ${pathToVerify}`);
console.log(`SHEETS ${sheetNames.join("|")}`);
console.log(`IDS ${ids[0]}..${ids[ids.length - 1]} count=${ids.length}`);
console.log(`COUNTS pass=${passCount} fail=${failCount} pending=${pendingCount}`);
console.log(`SUMMARY total=${summary.total} pass=${summary.pass} fail=${summary.fail} rating=${summary.rating}`);
console.log(`MOBILE_FORMULAS_MATCH true used=${mobileSnapshot.used}`);
console.log("FORMULA_ERRORS");
console.log(formulaErrors.ndjson);
