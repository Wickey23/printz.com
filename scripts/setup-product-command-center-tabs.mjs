import nextEnv from "@next/env";
const {loadEnvConfig} = nextEnv;
import {GoogleSheetsClient} from "./lib/google-sheets-client.mjs";

loadEnvConfig(process.cwd());

const SHEET_ID = "14L2liBREJYQSO_rhaAon_1RXonZIah91y77f4T3ctXs";
const WORKING = "Sheet1";
const ROW_COUNT = 1000;
const HEADER_COLOR = {red: 0.18, green: 0.43, blue: 0.32};
const LIGHT_HEADER_COLOR = {red: 0.9, green: 0.94, blue: 0.91};

const tabs = [
  {
    title: "Research Queue",
    color: {red: 0.13, green: 0.44, blue: 0.75},
    headers: [
      "Canonical Row ID", "Product ID", "Keywords to search", "Results of keyword", "Volume", "Competition", "Keyword Score",
      "WHAT TO SEARCH IN BAMBU STUDIO", "Bambu studio FOUND PRINT", "Maker World Link", "Source URL", "Source Platform",
      "Auto-Fill from Source Link", "Source Enrichment Status", "Workflow Status", "Ready Checklist", "Send to Final Stage / Site", "Working Sync Status",
    ],
  },
  {
    title: "Listing Builder",
    color: {red: 0.35, green: 0.23, blue: 0.68},
    headers: [
      "Canonical Row ID", "Product ID", "Name", "Slug", "Short Description", "Full Description", "Category", "Price", "Etsy URL",
      "Main Image (Drive or Direct URL)", "Drive Media Folder URL", "Video URL", "Material Options (comma-separated)", "Dimensions",
      "Customization Notes", "Personalization Enabled", "Personalization Prompt", "Color Options (comma-separated)", "Size Options (comma-separated)",
      "Finish Options (comma-separated)", "Processing Time", "Care Instructions", "Tags", "Featured", "Active on Site", "Ready Checklist",
      "Send to Final Stage / Site", "Working Sync Status",
    ],
  },
  {
    title: "Rights & Attribution",
    color: {red: 0.75, green: 0.36, blue: 0.12},
    headers: [
      "Canonical Row ID", "Product ID", "Source URL", "Creator Name", "License Type", "License URL", "Commercial Sale Allowed",
      "Modification Allowed", "Attribution Required", "Share-Alike Required", "Trademark Review", "Rights Status", "Attribution Text",
      "Rights Snapshot", "License Notes", "Etsy Attribution", "Modification Rules", "Ready Checklist", "Working Sync Status",
    ],
  },
  {
    title: "Pricing & Production",
    color: {red: 0.08, green: 0.52, blue: 0.39},
    headers: [
      "Canonical Row ID", "Product ID", "Name", "Price", "Estimated Grams", "Estimated Print Hours", "Material Cost / Gram",
      "Machine Cost / Hour", "Labor Cost", "Packaging Cost", "Failure Allowance %", "Marketplace Fee %", "Target Margin %",
      "Estimated Cost", "Suggested Price", "Pricing Status", "Ready Checklist", "Send to Final Stage / Site", "Working Sync Status",
    ],
  },
];

const spreadsheetId = process.env.PRINTZ_PRODUCT_SHEET_ID || SHEET_ID;
const sheets = new GoogleSheetsClient({spreadsheetId, env: process.env});

const metadata = await sheets.request(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))`);
const existing = new Map(metadata.sheets.map((sheet) => [sheet.properties.title, sheet.properties]));
const addRequests = tabs
  .filter((tab) => !existing.has(tab.title))
  .map((tab, index) => ({
    addSheet: {
      properties: {
        title: tab.title,
        index: 1 + index,
        tabColor: tab.color,
        gridProperties: {rowCount: ROW_COUNT, columnCount: Math.max(tab.headers.length, 20), frozenRowCount: 1},
      },
    },
  }));

if (addRequests.length) {
  await batchUpdate(addRequests);
}

const refreshed = await sheets.request(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))`);
const sheetProps = new Map(refreshed.sheets.map((sheet) => [sheet.properties.title, sheet.properties]));
const sheet1Headers = (await sheets.getValues(`${quote(WORKING)}!A1:CS1`))[0] || [];
const sourceColumns = new Map(sheet1Headers.map((header, index) => [String(header).trim(), col(index + 1)]).filter(([header]) => header));
const valueUpdates = [];
const formatRequests = [];

for (const tab of tabs) {
  const props = sheetProps.get(tab.title);
  if (!props) throw new Error(`Missing tab after setup: ${tab.title}`);

  const neededColumns = tab.headers.length;
  if ((props.gridProperties.columnCount || 0) < neededColumns || (props.gridProperties.rowCount || 0) < ROW_COUNT) {
    formatRequests.push({
      updateSheetProperties: {
        properties: {sheetId: props.sheetId, gridProperties: {rowCount: ROW_COUNT, columnCount: neededColumns}},
        fields: "gridProperties(rowCount,columnCount)",
      },
    });
  }

  valueUpdates.push({range: `${quote(tab.title)}!A1:${col(neededColumns)}1`, values: [tab.headers]});
  valueUpdates.push({range: `${quote(tab.title)}!A2:${col(neededColumns)}${ROW_COUNT}`, values: formulaRows(tab.headers, sourceColumns)});

  formatRequests.push(
    {
      repeatCell: {
        range: {sheetId: props.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: neededColumns},
        cell: {
          userEnteredFormat: {
            backgroundColor: tab.title === "Rights & Attribution" ? LIGHT_HEADER_COLOR : HEADER_COLOR,
            textFormat: {bold: true, foregroundColor: {red: 1, green: 1, blue: 1}},
            horizontalAlignment: "CENTER",
            wrapStrategy: "WRAP",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,wrapStrategy)",
      },
    },
    {
      updateSheetProperties: {
        properties: {sheetId: props.sheetId, gridProperties: {frozenRowCount: 1}},
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      setBasicFilter: {
        filter: {range: {sheetId: props.sheetId, startRowIndex: 0, endRowIndex: ROW_COUNT, startColumnIndex: 0, endColumnIndex: neededColumns}},
      },
    },
  );

  addValidation(formatRequests, props.sheetId, tab.headers, "Send to Final Stage / Site", ["TRUE", "FALSE"]);
  addValidation(formatRequests, props.sheetId, tab.headers, "Active on Site", ["TRUE", "FALSE"]);
  addValidation(formatRequests, props.sheetId, tab.headers, "Featured", ["TRUE", "FALSE"]);
  addValidation(formatRequests, props.sheetId, tab.headers, "Personalization Enabled", ["TRUE", "FALSE"]);
  addValidation(formatRequests, props.sheetId, tab.headers, "Workflow Status", ["Research", "Needs Review", "Ready", "Queued", "Processing", "Live", "Blocked", "Conflict"]);
  addValidation(formatRequests, props.sheetId, tab.headers, "Rights Status", ["Needs Review", "Approved", "Blocked"]);
  addValidation(formatRequests, props.sheetId, tab.headers, "Pricing Status", ["Needs Inputs", "Calculated", "Manual Override"]);
}

await sheets.batch(valueUpdates, "USER_ENTERED");
if (formatRequests.length) await batchUpdate(formatRequests);

console.log(JSON.stringify({spreadsheetId, createdTabs: addRequests.length, configuredTabs: tabs.map((tab) => tab.title)}, null, 2));

function formulaRows(headers, sourceColumns) {
  const rows = [];
  for (let row = 2; row <= ROW_COUNT; row++) {
    rows.push(headers.map((header) => {
      const source = sourceColumns.get(header);
      return source ? `=${quote(WORKING)}!${source}${row}` : "";
    }));
  }
  return rows;
}

function addValidation(requests, sheetId, headers, header, values) {
  const index = headers.indexOf(header);
  if (index < 0) return;
  requests.push({
    setDataValidation: {
      range: {sheetId, startRowIndex: 1, endRowIndex: ROW_COUNT, startColumnIndex: index, endColumnIndex: index + 1},
      rule: {
        condition: {type: "ONE_OF_LIST", values: values.map((userEnteredValue) => ({userEnteredValue}))},
        strict: false,
        showCustomUi: true,
      },
    },
  });
}

async function batchUpdate(requests) {
  await sheets.request(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({requests}),
  });
}

function quote(name) {
  return `'${String(name).replaceAll("'", "''")}'`;
}

function col(n) {
  let s = "";
  while (n) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
