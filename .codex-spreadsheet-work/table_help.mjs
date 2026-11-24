import { Workbook } from "@oai/artifact-tool";

const workbook = Workbook.create();
console.log(workbook.help("table.rows.add", { include: "index,examples,notes", maxChars: 8000 }).ndjson);
