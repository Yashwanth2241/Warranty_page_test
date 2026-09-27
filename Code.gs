const SHEET_NAME = "Warranty Registrations";
const HEADERS = ["Registration ID", "Full name", "Purchase date", "Invoice number", "Updated at", "Phone number", "Email"];
const PREVIOUS_HEADERS = ["Registration ID", "Revision", "Full name", "Purchase date", "Invoice number", "Updated at"];

function setup() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error("Open this script from the target spreadsheet.");

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty("SPREADSHEET_ID", spreadsheet.getId());

  let apiToken = properties.getProperty("API_TOKEN");
  if (!apiToken) {
    apiToken = Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty("API_TOKEN", apiToken);
  }
  console.log("Set GOOGLE_APPS_SCRIPT_TOKEN in .env to: " + apiToken);
}

function doPost(event) {
  try {
    const draft = JSON.parse(event.postData.contents);
    const properties = PropertiesService.getScriptProperties();
    if (draft.apiToken !== properties.getProperty("API_TOKEN")) {
      return jsonResponse({ saved: false, error: "Unauthorized request." });
    }
    if (!isValidDraft(draft)) {
      return jsonResponse({ saved: false, error: "Invalid registration data." });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheetId = properties.getProperty("SPREADSHEET_ID");
      if (!spreadsheetId) throw new Error("Run setup() from the spreadsheet before deploying.");

      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
      ensureHeaders(sheet);

      let rowNumber = 0;
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const match = sheet.getRange(2, 1, lastRow - 1, 1)
          .createTextFinder(draft.registrationId)
          .matchEntireCell(true)
          .findNext();
        if (match) rowNumber = match.getRow();
      }

      if (!rowNumber) {
        rowNumber = sheet.getLastRow() + 1;
      }

      const values = [[
        draft.registrationId,
        asPlainText(draft.fullName),
        asPlainText(draft.purchaseDate),
        asPlainText(draft.invoiceNumber),
        new Date().toISOString(),
        asPlainText(draft.phoneNumber),
        asPlainText(draft.email)
      ]];
      const range = sheet.getRange(rowNumber, 1, 1, HEADERS.length);
      range.setNumberFormat("@");
      range.setValues(values);
      return jsonResponse({ saved: true });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return jsonResponse({ saved: false, error: "Could not write to the warranty sheet." });
  }
}

function ensureHeaders(sheet) {
  const currentHeaders = sheet.getRange(1, 1, 1, 8).getDisplayValues()[0];
  if (currentHeaders.every(value => !value)) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }
  const previousHeadersMatch = PREVIOUS_HEADERS.every((header, index) => currentHeaders[index] === header);
  const previousContactHeaders = currentHeaders.slice(6, 8);
  const contactHeadersAreCompatible = previousContactHeaders.every((header, index) => !header || header === HEADERS[index + 5]);
  if (previousHeadersMatch && contactHeadersAreCompatible) {
    sheet.deleteColumn(2);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }
  const headersMatch = HEADERS.every((header, index) => currentHeaders[index] === header)
    && currentHeaders.slice(HEADERS.length).every(value => !value);
  if (!headersMatch) {
    throw new Error("The warranty sheet has unexpected column headers.");
  }
}

function isValidDraft(draft) {
  const isUuid = typeof draft.registrationId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draft.registrationId);
  const fields = [draft.fullName, draft.phoneNumber, draft.email, draft.purchaseDate, draft.invoiceNumber];
  return isUuid && fields.every(value => typeof value === "string" && value.length <= 200);
}

function asPlainText(value) {
  return /^[=+@\-]/.test(value) ? "'" + value : value;
}

function jsonResponse(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}