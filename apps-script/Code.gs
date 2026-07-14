const SECRET = "7wheW5VA4Wyxx_8XnUg1wEtIZ1PbQCVX";
const SHEET_NAME = "Todo";

function doGet(e) {
  if (e.parameter.token !== SECRET) return json({ error: "unauthorized" });
  const rows = getSheet().getDataRange().getValues();
  const headers = rows.shift();
  const tasks = rows
    .filter(r => r[0] !== "")
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
  return json({ tasks });
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.token !== SECRET) return json({ error: "unauthorized" });

  const sheet = getSheet();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (body.action === "create") {
    sheet.appendRow([
      body.id,
      body.text,
      body.category,
      body.who || "",
      body.due_at || "",
      false,
      new Date().toISOString()
    ]);
  } else if (body.action === "toggle") {
    const row = findRow(sheet, body.id);
    if (!row) return json({ error: "not found" });
    sheet.getRange(row, headers.indexOf("done") + 1).setValue(body.done);
  } else if (body.action === "update") {
    const row = findRow(sheet, body.id);
    if (!row) return json({ error: "not found" });
    ["text", "category", "who", "due_at"].forEach(field => {
      if (body[field] !== undefined) {
        sheet.getRange(row, headers.indexOf(field) + 1).setValue(body[field]);
      }
    });
  } else if (body.action === "delete") {
    const row = findRow(sheet, body.id);
    if (row) sheet.deleteRow(row);
  } else {
    return json({ error: "unknown action" });
  }
  return json({ ok: true });
}

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function findRow(sheet, id) {
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues().flat();
  const idx = ids.indexOf(id);
  return idx === -1 ? null : idx + 2;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
