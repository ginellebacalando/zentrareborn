import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbookPath = "C:/Users/jerom/Downloads/IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx";
const verifyDir = "C:/Users/jerom/Downloads/ZenTra-Web/.codex-spreadsheet-work/verify";
const tempOutputPath = "C:/Users/jerom/Downloads/ZenTra-Web/.codex-spreadsheet-work/IAS-Test-Cases-Progress-Tracker-ZenTra.updated.xlsx";

const headers = [
  "Test Case Scenario ID ",
  "Name of the Module Function ",
  "Test Case Scenario",
  "Action",
  "Actual Input",
  "Pass",
  "Fail",
  "Product Quality Component",
  "Comments/Suggestion",
];

const rows = [
  {
    id: "ID-001",
    module: "Home Page",
    scenario: "User opens the Zion Events Place landing page and confirms the main public content loads.",
    action: "1. Open http://localhost:3000/.\n2. Wait for the landing page to load.\n3. Review the hero, featured content, event highlights, testimonies, and footer sections.",
    input: "Home route /",
    component: "Functional Suitability",
    comments: "Landing page returns successfully and uses Zion Events Place branding.",
  },
  {
    id: "ID-002",
    module: "Navigation Menu",
    scenario: "User opens the public navigation menu and sees available public links.",
    action: "1. Open the home page.\n2. Open the main navigation.\n3. Confirm Home, Packages, Gallery, About Us, Contact Us, FAQ, Rules, Facilities, Policies, Privacy, Terms, and Testimonies are reachable where shown.",
    input: "Menu links",
    component: "Usability",
    comments: "Navigation supports the current public web routes and removes obsolete booking/admin entry points.",
  },
  {
    id: "ID-003",
    module: "Package Dropdown",
    scenario: "User expands the Packages menu and sees each event package option.",
    action: "1. Open the menu.\n2. Hover over or tap Packages.\n3. Confirm Weddings, Debuts, Christening, Birthdays, Gender Reveal, and Christmas Party are listed.",
    input: "Packages menu",
    component: "Usability",
    comments: "All current event package links are present in the navigation.",
  },
  {
    id: "ID-004",
    module: "About Page",
    scenario: "User navigates to the About Us page.",
    action: "1. Open /about.\n2. Confirm the page title and venue story content display.",
    input: "/about",
    component: "Functional Suitability",
    comments: "Route displays current Zion Events Place content.",
  },
  {
    id: "ID-005",
    module: "Contact Page",
    scenario: "User views contact details and social/contact links.",
    action: "1. Open /contact.\n2. Confirm email, phone, social links, and map/location entries are shown.",
    input: "/contact",
    component: "Functional Suitability",
    comments: "Contact UI displays usable email, phone, social, and map actions.",
  },
  {
    id: "ID-006",
    module: "FAQ Page",
    scenario: "User opens the FAQ/help page.",
    action: "1. Open /faq.\n2. Confirm FAQ categories and answers display.\n3. Expand and collapse a question.",
    input: "/faq",
    component: "Functional Suitability",
    comments: "FAQ content is visible and interactive.",
  },
  {
    id: "ID-007",
    module: "Rules Page",
    scenario: "User views venue rules and regulations.",
    action: "1. Open /rules.\n2. Confirm rules and regulation content is displayed.",
    input: "/rules",
    component: "Functional Suitability",
    comments: "Rules content supports the current venue information flow.",
  },
  {
    id: "ID-008",
    module: "Privacy Page",
    scenario: "User opens the Privacy Policy page.",
    action: "1. Open /privacy.\n2. Confirm privacy policy content is displayed.",
    input: "/privacy",
    component: "Compliance",
    comments: "Privacy content is reachable from the public site.",
  },
  {
    id: "ID-009",
    module: "Terms Page",
    scenario: "User opens the Terms of Service page.",
    action: "1. Open /terms.\n2. Confirm terms content is displayed.",
    input: "/terms",
    component: "Compliance",
    comments: "Terms content is reachable from the public site.",
  },
  {
    id: "ID-010",
    module: "Wedding Package Page",
    scenario: "User opens the Weddings package page and reviews package content.",
    action: "1. Open /events/weddings.\n2. Confirm hero, content blocks, package details, flipbook cover, and gallery render.",
    input: "/events/weddings",
    component: "Functional Suitability",
    comments: "Wedding package route displays current public package content.",
  },
  {
    id: "ID-011",
    module: "Debut Package Page",
    scenario: "User opens the Debuts package page.",
    action: "1. Open /events/debuts.\n2. Confirm package content, flipbook cover, and gallery render.",
    input: "/events/debuts",
    component: "Functional Suitability",
    comments: "Debut package route displays current public package content.",
  },
  {
    id: "ID-012",
    module: "Christening Package Page",
    scenario: "User opens the Christening package page.",
    action: "1. Open /events/christening.\n2. Confirm package content, flipbook cover, and gallery render.",
    input: "/events/christening",
    component: "Functional Suitability",
    comments: "Christening package route displays current public package content.",
  },
  {
    id: "ID-013",
    module: "Birthday Package Page",
    scenario: "User opens the Birthdays package page.",
    action: "1. Open /events/birthdays.\n2. Confirm package content, flipbook cover, and gallery render.",
    input: "/events/birthdays",
    component: "Functional Suitability",
    comments: "Birthday package route displays current public package content.",
  },
  {
    id: "ID-014",
    module: "Gender Reveal Package Page",
    scenario: "User opens the Gender Reveal package page.",
    action: "1. Open /events/gender-reveal.\n2. Confirm package content, flipbook cover, and gallery render.",
    input: "/events/gender-reveal",
    component: "Functional Suitability",
    comments: "Gender Reveal package route displays current public package content.",
  },
  {
    id: "ID-015",
    module: "Christmas Party Package Page",
    scenario: "User opens the Christmas Party package page.",
    action: "1. Open /events/christmas-party.\n2. Confirm package content, flipbook cover, and gallery render.",
    input: "/events/christmas-party",
    component: "Functional Suitability",
    comments: "Christmas Party package route displays current public package content.",
  },
  {
    id: "ID-016",
    module: "Facilities Page",
    scenario: "User opens the Facilities page and reviews venue spaces.",
    action: "1. Open /facilities.\n2. Confirm facility sections, images, and venue details display.\n3. Check that media loads without broken placeholders.",
    input: "/facilities",
    component: "Functional Suitability",
    comments: "Facilities route replaces the obsolete booking page scenario.",
  },
  {
    id: "ID-017",
    module: "Gallery Page",
    scenario: "User opens the Gallery page and browses event media.",
    action: "1. Open /gallery.\n2. Review image and video gallery items.\n3. Confirm media cards load and remain usable across categories or sections.",
    input: "/gallery",
    component: "Usability",
    comments: "Gallery validates public images and videos after duplicate media cleanup.",
  },
  {
    id: "ID-018",
    module: "Testimonies Page",
    scenario: "User opens the Testimonies page and reviews client feedback.",
    action: "1. Open /testimonies.\n2. Confirm testimony cards display.\n3. Confirm featured feedback appears without missing names or content.",
    input: "/testimonies",
    component: "Functional Suitability",
    comments: "Testimony content replaces obsolete calendar availability checks.",
  },
  {
    id: "ID-019",
    module: "Policies Page",
    scenario: "User opens the Policies page and reviews venue policy content.",
    action: "1. Open /policies.\n2. Confirm public policy content loads.\n3. Confirm page links and section labels are readable.",
    input: "/policies",
    component: "Compliance",
    comments: "Policies route is part of the current public information set.",
  },
  {
    id: "ID-020",
    module: "Theme Toggle",
    scenario: "User changes the site theme and sees the public layout update.",
    action: "1. Open any public page.\n2. Toggle between light and dark theme.\n3. Confirm text, buttons, cards, and page background remain readable.",
    input: "Theme control",
    component: "Usability",
    comments: "Theme behavior remains usable across the client-facing layout.",
  },
  {
    id: "ID-021",
    module: "Responsive Header",
    scenario: "User views the public navigation on mobile width.",
    action: "1. Resize the browser to a mobile viewport.\n2. Open the navigation menu.\n3. Confirm menu links are readable and do not overlap.",
    input: "Mobile viewport",
    component: "Portability",
    comments: "Responsive navigation replaces obsolete booking wizard step coverage.",
  },
  {
    id: "ID-022",
    module: "Responsive Package Cards",
    scenario: "User views package content on tablet and mobile widths.",
    action: "1. Open any event package page.\n2. Resize to tablet and mobile widths.\n3. Confirm package cards, gallery media, and flipbook cover remain aligned.",
    input: "Package page viewport",
    component: "Portability",
    comments: "Package browsing remains readable across common screen sizes.",
  },
  {
    id: "ID-023",
    module: "Inquiry Form Validation",
    scenario: "User submits the contact inquiry form with missing required values.",
    action: "1. Open /contact.\n2. Submit the inquiry form with required fields blank.\n3. Confirm validation prevents submission and highlights required fields.",
    input: "Blank inquiry form",
    component: "Reliability",
    comments: "Validation checks replace obsolete booking add-on flow coverage.",
  },
  {
    id: "ID-024",
    module: "Inquiry Form Submission",
    scenario: "User submits a complete public inquiry.",
    action: "1. Open /contact.\n2. Enter a valid name, email, phone, event interest, and message.\n3. Submit the form and confirm the success or received state displays.",
    input: "Valid inquiry details",
    component: "Functional Suitability",
    comments: "Inquiry submission aligns with the current public inquiry API.",
  },
  {
    id: "ID-025",
    module: "Contact Actions",
    scenario: "User starts contact actions from the public contact page.",
    action: "1. Open /contact.\n2. Click the email, phone, and map/location actions.\n3. Confirm each action opens the expected external handler or link.",
    input: "Email, phone, map links",
    component: "Usability",
    comments: "Contact actions replace obsolete booking review coverage.",
  },
  {
    id: "ID-026",
    module: "Footer Copyright",
    scenario: "User reviews the footer on public pages.",
    action: "1. Open the home page.\n2. Scroll to the footer.\n3. Confirm the footer displays (c) 2026 Zion Events Place. All rights reserved.",
    input: "Footer area",
    component: "Compliance",
    comments: "Footer branding and year match the current product requirement.",
  },
  {
    id: "ID-027",
    module: "SEO Metadata",
    scenario: "Search engines and shared links receive current Zion page metadata.",
    action: "1. Open the home page source or browser dev tools.\n2. Inspect title and meta description.\n3. Confirm metadata uses Zion Events Place and page-relevant copy.",
    input: "Page metadata",
    component: "Maintainability",
    comments: "Metadata no longer uses old ZenTra branding.",
  },
  {
    id: "ID-028",
    module: "Accessibility Navigation",
    scenario: "Keyboard user navigates through public site controls.",
    action: "1. Open the home page.\n2. Use Tab and Shift+Tab across navigation, links, toggles, and buttons.\n3. Confirm focus order is visible and logical.",
    input: "Keyboard navigation",
    component: "Accessibility",
    comments: "Accessibility coverage replaces obsolete admin login coverage.",
  },
  {
    id: "ID-029",
    module: "Accessible Labels",
    scenario: "Screen reader users receive meaningful labels for interactive controls.",
    action: "1. Inspect navigation, theme, menu, gallery, and form controls.\n2. Confirm icon-only controls include accessible names.\n3. Confirm form inputs have associated labels.",
    input: "Interactive controls",
    component: "Accessibility",
    comments: "Accessible labels replace obsolete admin dashboard coverage.",
  },
  {
    id: "ID-030",
    module: "Feature Unavailable State",
    scenario: "User sees a graceful message when a feature is unavailable.",
    action: "1. Trigger or visit a route/state for an unavailable public feature.\n2. Confirm the page explains the unavailable state.\n3. Confirm the user can navigate back to public content.",
    input: "Unavailable feature state",
    component: "Reliability",
    comments: "Graceful unavailable handling replaces obsolete admin module coverage.",
  },
  {
    id: "ID-031",
    module: "Public Content API",
    scenario: "Client retrieves managed public content for public pages.",
    action: "1. Request the public content API.\n2. Confirm the response returns active content records.\n3. Confirm the UI renders fallback content if the response is empty.",
    input: "/api/public-content",
    component: "Functional Suitability",
    comments: "Covers managed public content used by the client-facing site.",
  },
  {
    id: "ID-032",
    module: "Event Categories API",
    scenario: "Client retrieves event categories for package browsing.",
    action: "1. Request the event categories API.\n2. Confirm active categories include current public event types.\n3. Confirm the package navigation remains stable if no categories are returned.",
    input: "/api/event-categories",
    component: "Functional Suitability",
    comments: "Category data supports current package browsing.",
  },
  {
    id: "ID-033",
    module: "Event Packages API",
    scenario: "Client retrieves public event package data.",
    action: "1. Request the event packages API.\n2. Confirm package records include names, descriptions, media, and category references.\n3. Confirm the UI ignores inactive or malformed entries.",
    input: "/api/event-packages",
    component: "Reliability",
    comments: "Package API supports public package pages without booking/payment flows.",
  },
  {
    id: "ID-034",
    module: "FAQ Categories API",
    scenario: "Client retrieves FAQ category data.",
    action: "1. Request the FAQ categories API.\n2. Confirm categories return with display order.\n3. Confirm the FAQ page groups questions by category when data exists.",
    input: "/api/faq-categories",
    component: "Functional Suitability",
    comments: "FAQ categories drive public help content.",
  },
  {
    id: "ID-035",
    module: "FAQs API",
    scenario: "Client retrieves public FAQ records.",
    action: "1. Request the FAQs API.\n2. Confirm questions and answers return.\n3. Confirm inactive or empty answers do not break the FAQ page.",
    input: "/api/faqs",
    component: "Reliability",
    comments: "FAQ data is handled safely by the public client.",
  },
  {
    id: "ID-036",
    module: "Popular FAQs API",
    scenario: "Client retrieves popular FAQ records for highlighted help content.",
    action: "1. Request the popular FAQs API.\n2. Confirm highlighted FAQ records display.\n3. Confirm the page remains usable if no popular FAQs exist.",
    input: "/api/faqs/popular",
    component: "Functional Suitability",
    comments: "Popular FAQ coverage matches the current client API surface.",
  },
  {
    id: "ID-037",
    module: "Inquiries API Validation",
    scenario: "API rejects an invalid public inquiry payload.",
    action: "1. Send an inquiry payload with missing name, invalid email, or empty message.\n2. Confirm the API returns a validation error.\n3. Confirm the client shows the error without losing entered values.",
    input: "/api/inquiries invalid payload",
    component: "Reliability",
    comments: "Validation protects public inquiry submission quality.",
  },
  {
    id: "ID-038",
    module: "Inquiries API Success",
    scenario: "API accepts a valid public inquiry payload.",
    action: "1. Send a valid inquiry payload.\n2. Confirm the API returns a success response.\n3. Confirm the client displays confirmation to the user.",
    input: "/api/inquiries valid payload",
    component: "Functional Suitability",
    comments: "Inquiry handling supports the current contact workflow.",
  },
  {
    id: "ID-039",
    module: "Settings API",
    scenario: "Client retrieves public settings used across the site.",
    action: "1. Request the settings API.\n2. Confirm contact, social, branding, and display settings return where configured.\n3. Confirm default values render when settings are missing.",
    input: "/api/settings",
    component: "Reliability",
    comments: "Settings fallback prevents broken public pages.",
  },
  {
    id: "ID-040",
    module: "Testimonies API",
    scenario: "Client retrieves public testimony records.",
    action: "1. Request the testimonies API.\n2. Confirm public testimony records return.\n3. Confirm the Testimonies page handles empty results gracefully.",
    input: "/api/testimonies",
    component: "Functional Suitability",
    comments: "Testimony API supports public social proof content.",
  },
  {
    id: "ID-041",
    module: "Featured Testimonies API",
    scenario: "Client retrieves featured testimonies for highlighted display.",
    action: "1. Request the featured testimonies API.\n2. Confirm featured records return.\n3. Confirm home or testimony sections fall back when no featured records exist.",
    input: "/api/testimonies/featured",
    component: "Reliability",
    comments: "Featured testimonies remain optional and non-blocking.",
  },
  {
    id: "ID-042",
    module: "Health API",
    scenario: "System health endpoint reports service availability.",
    action: "1. Request the health endpoint.\n2. Confirm the response indicates the service is available.\n3. Confirm the endpoint does not expose sensitive internal data.",
    input: "/api/health",
    component: "Security",
    comments: "Health endpoint is useful for uptime checks without exposing private details.",
  },
  {
    id: "ID-043",
    module: "Public Content Fallback",
    scenario: "User still sees useful page content when managed content is unavailable.",
    action: "1. Simulate an empty or failed public content response.\n2. Open the affected public page.\n3. Confirm fallback copy or safe empty states display without runtime errors.",
    input: "Empty public content response",
    component: "Reliability",
    comments: "Fallback behavior keeps public pages usable during content issues.",
  },
  {
    id: "ID-044",
    module: "Event Package Fallback",
    scenario: "User sees a graceful state when package data is unavailable.",
    action: "1. Simulate failed event package data.\n2. Open a package page.\n3. Confirm the page shows a helpful unavailable or fallback state.",
    input: "Failed package response",
    component: "Reliability",
    comments: "Package pages avoid blank or broken views when data fails.",
  },
  {
    id: "ID-045",
    module: "Gallery Media Display",
    scenario: "User opens public gallery media without broken assets.",
    action: "1. Open /gallery.\n2. Scroll through image and video entries.\n3. Confirm media files load from public/images and public/videos.",
    input: "Gallery media assets",
    component: "Reliability",
    comments: "Public media paths remain valid after duplicate image cleanup.",
  },
  {
    id: "ID-046",
    module: "Package Flipbook Cover",
    scenario: "User sees a flipbook cover for package browsing.",
    action: "1. Open an event package page.\n2. Locate the flipbook or package cover area.\n3. Confirm cover media loads and matches the selected package.",
    input: "Package flipbook cover",
    component: "Usability",
    comments: "Flipbook cover improves current package browsing without booking steps.",
  },
  {
    id: "ID-047",
    module: "Static Asset Integrity",
    scenario: "User does not encounter missing static images or videos on public pages.",
    action: "1. Open Home, Gallery, Facilities, and one package page.\n2. Inspect page media requests.\n3. Confirm there are no 404 responses for referenced public assets.",
    input: "Public images and videos",
    component: "Reliability",
    comments: "Static assets remain intact across the client-facing site.",
  },
  {
    id: "ID-048",
    module: "Route Not Found",
    scenario: "User visits an unknown route and receives a graceful not-found experience.",
    action: "1. Open an invalid route such as /missing-page.\n2. Confirm a not-found page or graceful error state appears.\n3. Use navigation to return to the public site.",
    input: "/missing-page",
    component: "Reliability",
    comments: "Unknown routes do not trap the user or expose errors.",
  },
  {
    id: "ID-049",
    module: "Page Error Handling",
    scenario: "Public page fetch errors do not crash the application shell.",
    action: "1. Simulate an API error for a public content request.\n2. Reload the affected page.\n3. Confirm the layout remains visible with fallback or retry messaging.",
    input: "Public API error",
    component: "Reliability",
    comments: "Client-side error handling keeps the site usable.",
  },
  {
    id: "ID-050",
    module: "Open Graph Metadata",
    scenario: "Shared public links show current Zion page preview details.",
    action: "1. Inspect Open Graph metadata for Home and one package page.\n2. Confirm title, description, and image values exist.\n3. Confirm metadata uses Zion Events Place branding.",
    input: "Open Graph tags",
    component: "Maintainability",
    comments: "Social sharing metadata supports the current brand.",
  },
  {
    id: "ID-051",
    module: "Package Internal Links",
    scenario: "User moves between package pages through public links.",
    action: "1. Open a package page.\n2. Use related package or navigation links to switch packages.\n3. Confirm route changes and content updates correctly.",
    input: "Package navigation links",
    component: "Usability",
    comments: "Internal links support package discovery without stale routes.",
  },
  {
    id: "ID-052",
    module: "FAQ Search or Filter",
    scenario: "User narrows FAQ content when search or category controls are available.",
    action: "1. Open /faq.\n2. Use available category or search controls.\n3. Confirm displayed questions update and empty matches show a clear state.",
    input: "FAQ filter controls",
    component: "Usability",
    comments: "FAQ controls keep help content scannable.",
  },
  {
    id: "ID-053",
    module: "Inquiry Spam Guard",
    scenario: "Public inquiry form resists repeated invalid submissions.",
    action: "1. Submit invalid inquiry data more than once.\n2. Confirm validation remains clear and stable.\n3. Confirm no duplicate success messages appear for rejected submissions.",
    input: "Repeated invalid inquiry",
    component: "Security",
    comments: "Inquiry form avoids misleading success states for bad input.",
  },
  {
    id: "ID-054",
    module: "Public API Response Shape",
    scenario: "Client receives predictable response shapes from public APIs.",
    action: "1. Request public content, settings, packages, FAQ, and testimonies APIs.\n2. Confirm responses contain expected fields.\n3. Confirm the client handles missing optional fields safely.",
    input: "Public API responses",
    component: "Maintainability",
    comments: "Consistent API shapes reduce runtime issues in public views.",
  },
  {
    id: "ID-055",
    module: "No Removed Feature Links",
    scenario: "User does not see links to removed booking, payment, chatbot, calendar, or admin workflows.",
    action: "1. Review public navigation, footer, package pages, and contact page.\n2. Search visible links and buttons for removed workflows.\n3. Confirm only current public site actions remain.",
    input: "Public visible links",
    component: "Functional Suitability",
    comments: "Tracker scope aligns with the current Zion public web application.",
  },
];

function toMatrix(record) {
  return [
    record.id,
    record.module,
    record.scenario,
    record.action,
    record.input,
    "PASSED",
    null,
    record.component,
    record.comments,
  ];
}

if (rows.length !== 55) {
  throw new Error(`Expected 55 rows, received ${rows.length}`);
}

await fs.mkdir(verifyDir, { recursive: true });

const input = await FileBlob.load(workbookPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem("Test Cases (Web)");

sheet.getRange("B4").values = [["Zion Events Place"]];
sheet.getRange("H5").values = [[55]];
sheet.getRange("H6").values = [[55]];
sheet.getRange("H7").values = [[0]];
sheet.getRange("I6").values = [[1]];

const existingCount = 30;
const firstDataRow = 11;
const finalRow = 66;
sheet.getRange("A13:I13").values = [["CORE PAGES AND PACKAGE PAGES", null, null, null, null, null, null, null, null]];
sheet.getRange("A41:I41").copyTo(sheet.getRange(`A42:I${finalRow}`), "all");
sheet.getRange("A11:I12").values = rows.slice(0, 2).map(toMatrix);
sheet.getRange(`A14:I${finalRow}`).values = rows.slice(2).map(toMatrix);

const used = sheet.getUsedRange();
const idValues = sheet.getRange(`A${firstDataRow}:A${finalRow}`).values.flat();
const ids = idValues.filter((value) => /^ID-\d{3}$/.test(String(value ?? "")));
if (ids.length !== 55) {
  throw new Error(`Expected 55 web test cases after edit, found ${ids.length}`);
}
if (new Set(ids).size !== 55) {
  throw new Error("Duplicate test-case IDs found after edit");
}
if (ids[0] !== "ID-001" || ids[54] !== "ID-055") {
  throw new Error(`Unexpected ID range ${ids[0]} to ${ids[54]}`);
}

const headerValues = sheet.getRange("A9:I9").values[0];
if (JSON.stringify(headerValues) !== JSON.stringify(headers)) {
  throw new Error("Header row changed unexpectedly");
}

workbook.recalculate();

const formulaErrors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log("FORMULA_ERRORS");
console.log(formulaErrors.ndjson);

const finalInspect = await workbook.inspect({
  kind: "region,table",
  sheetId: "Test Cases (Web)",
  range: `A1:I${finalRow}`,
  maxChars: 24000,
  tableMaxRows: 70,
  tableMaxCols: 9,
  tableMaxCellChars: 120,
});
console.log("FINAL_INSPECT");
console.log(finalInspect.ndjson);
console.log(`FINAL_WEB_TEST_CASE_COUNT ${ids.length}`);
console.log(`USED_RANGE_AFTER_EDIT ${used.address}`);

const preview = await workbook.render({
  sheetName: "Test Cases (Web)",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${verifyDir}/Test Cases (Web) - after.png`, new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(tempOutputPath);

const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(tempOutputPath));
const reopenedSheet = reopened.worksheets.getItem("Test Cases (Web)");
const reopenedIds = reopenedSheet
  .getRange("A11:A66")
  .values
  .flat()
  .filter((value) => /^ID-\d{3}$/.test(String(value ?? "")));
console.log(`REOPENED_WEB_TEST_CASE_COUNT ${reopenedIds.length}`);
console.log(`REOPENED_PROJECT_NAME ${reopenedSheet.getRange("B4").values[0][0]}`);
console.log(`REOPENED_TOTAL ${reopenedSheet.getRange("H5").values[0][0]}`);
console.log(`REOPENED_PASS ${reopenedSheet.getRange("H6").values[0][0]}`);
console.log(`REOPENED_FAIL ${reopenedSheet.getRange("H7").values[0][0]}`);
console.log(`TEMP_OUTPUT ${tempOutputPath}`);
