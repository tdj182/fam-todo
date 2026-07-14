# Family Todo App — Build Spec

## Overview
Family todo list app. Google Sheets as backend (via Apps Script Web App), read/write from a website first. Later: iPhone 14 via Scriptable (calls same URL), then a Raspberry Pi touchscreen / Magic Mirror display when we're in the new house.

**Phase 1 (this spec): Sheet + Apps Script backend + website (read/write).**
**Phase 2 (later): Scriptable widget on iPhone hitting the same URL.**
**Phase 3 (later): Pi touchscreen + Magic Mirror visuals, new backend migration.**

---

## 1. Google Sheet schema

One tab named `Tasks`. One row per task. Row order is never meaningful — always key by `id`, never by row index in app logic (row index is only used internally by Apps Script to locate a row to update/delete).

| column | type | notes |
|---|---|---|
| `id` | string | short unique id (e.g. `a1b2c3`), generated client-side or in Apps Script on create |
| `text` | string | task description |
| `category` | string | `"regular"` or `"big"` |
| `who` | string | one of: `Ty`, `Kari`, `Olivia`, `family`, `parents` (free text field, but app UI should offer these as quick-select options; don't hard-lock to an enum in the sheet itself in case we add people later) |
| `due_at` | string (ISO 8601) | e.g. `2026-07-20T18:00:00Z`. Can be blank/empty string if no due date set. |
| `done` | boolean | `TRUE` / `FALSE` |
| `created_at` | string (ISO 8601) | set on creation, never edited |

Header row is row 1. Data starts row 2.

---

## 2. Apps Script Web App (backend)

Bound script on the Sheet. Deployed as Web App, execute as owner, access "Anyone with the link." Auth is a shared secret token passed in every request (query param on GET, body field on POST) — no OAuth needed on any client.

### Endpoints

**GET `?token=SECRET`**
Returns all tasks as JSON:
```json
{ "tasks": [ { "id": "...", "text": "...", "category": "...", "who": "...", "due_at": "...", "done": false, "created_at": "..." } ] }
```

**POST** (JSON body, all actions share this endpoint, disambiguated by `action` field)

- `action: "create"` — body: `{ token, id, text, category, who, due_at }`. Appends row, sets `done=false`, `created_at=now`.
- `action: "toggle"` — body: `{ token, id, done }`. Sets `done` column for matching `id`.
- `action: "update"` — body: `{ token, id, text?, category?, who?, due_at? }`. Updates any provided fields for matching `id` (for editing a task after creation, e.g. changing due date or reassigning `who`).
- `action: "delete"` — body: `{ token, id }`. Deletes the row matching `id`.

All responses: `{ ok: true }` on success, `{ error: "..." }` with non-200-equivalent handling on failure (Apps Script Web Apps can't set real HTTP status codes for doPost easily — just check `error` field client-side).

### Reference implementation (Apps Script, Code.gs)

```javascript
const SECRET = "REPLACE_WITH_RANDOM_STRING";
const SHEET_NAME = "Tasks";

function doGet(e) {
  if (e.parameter.token !== SECRET) return json({ error: "unauthorized" });
  const rows = getSheet().getDataRange().getValues();
  const headers = rows.shift();
  const tasks = rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])));
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
```

---

## 3. Website (Phase 1 deliverable)

Single-page app, vanilla JS or lightweight React (matches prior dinner-picker app pattern). Static-hostable (e.g. GitHub Pages).

### Structure
- Two sections: **Regular** and **Big** (filtered by `category`)
- Each task row shows: checkbox (toggle done), text, `who` badge/tag, due date/time (formatted human-readable, e.g. "Jul 20, 6:00 PM"), delete button
- Overdue tasks (due_at in the past, not done) should be visually flagged (e.g. red text/border) — this is the main payoff of adding due dates, don't skip it
- "Add task" form: text input, category toggle (Regular/Big), `who` selector (quick buttons for Ty/Kari/Olivia/family/parents), due date/time picker (optional field)
- Done tasks: either hide by default with a "show completed" toggle, or show struck-through at bottom of each section — pick one, don't overbuild

### `api.js` — single wrapper module, all clients (website now, Scriptable/Pi later) reuse this shape
```javascript
const BASE_URL = "https://script.google.com/macros/s/XXXX/exec";
const TOKEN = "REPLACE_WITH_RANDOM_STRING"; // same secret as Apps Script

async function getTasks() { ... }              // GET
async function addTask({text, category, who, due_at}) { ... }  // POST action:create, generate id client-side (crypto.randomUUID().slice(0,8) or similar)
async function toggleTask(id, done) { ... }     // POST action:toggle
async function updateTask(id, fields) { ... }   // POST action:update
async function deleteTask(id) { ... }           // POST action:delete
```

Poll every 15–30s or refetch on window focus. No websockets/live-push needed at this scale.

### Known tradeoff to flag to user, not silently swallow
The `TOKEN` will be visible in client-side JS on a static-hosted site. Fine for a family app, but don't accidentally reuse this token/pattern for anything more sensitive later.

---

## 4. Explicitly out of scope for Phase 1
- Scriptable/iPhone widget (Phase 2 — same `api.js` calls, ported to Scriptable's `Request` object)
- Raspberry Pi / Magic Mirror display (Phase 3 — likely backend migration off Sheets to SQLite+local API on the Pi; revisit then)
- Push notifications / reminders for due dates (possible future addition once due_at is in place and proven useful)
- Multi-list/multi-family support, recurring tasks, auth beyond the shared token

---

## 5. Open decisions to make before/during build
- Exact random secret token value (generate and keep out of git if this repo goes public)
- Whether `due_at` uses local time entry (probably yes — a date/time `<input>` on the website, converted to ISO/UTC on submit) since this is a household app, not multi-timezone
- Whether "who" quick-select buttons should be strictly limited to the 5 named values or allow free text for edge cases (e.g. a babysitter) — recommend allowing free text with the 5 as shortcuts, per schema note above
