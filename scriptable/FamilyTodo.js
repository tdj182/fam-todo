// Variables used by Scriptable.
// icon-color: green; icon-glyph: list-check;
//
// Setup:
// 1. Install the free "Scriptable" app from the App Store.
// 2. In Scriptable, tap + to create a new script named "Family Todo".
// 3. Paste this whole file in and save.
// 4. Run it once directly to confirm it loads your tasks.
// 5. Long-press your home screen -> + -> search "Scriptable" -> add a
//    widget -> tap it -> set Script to "Family Todo" and
//    "When Interacting" to "Run Script".
//
// Backend: talks directly to Supabase's REST API (PostgREST) using the
// public anon key. Standard task CRUD has no login wall (see
// johnson-family-webapps/docs/supabase-personal-backend-brief_1.md,
// section 6.1) -- same trust model as the old shared-secret-token setup
// this replaces, just against public.todo_tasks instead of a Google Sheet.

const SUPABASE_URL = "https://xohawddgigksbckacfwe.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvaGF3ZGRnaWdrc2Jja2FjZndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTU3MzAsImV4cCI6MjEwMDI5MTczMH0.EVxvQywfJjAge9xPBuI-qK-H47ZugHqBoUBbfcbk4ao";
const WEBSITE_URL = "https://johnson-family-webapps.vercel.app/todo";
const WHO_OPTIONS = ["Ty", "Kari", "Olivia", "family", "parents"];

async function supabaseRequest(path, { method = "GET", body, prefer } = {}) {
  const req = new Request(`${SUPABASE_URL}/rest/v1/${path}`);
  req.method = method;
  req.headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
  if (body !== undefined) req.body = JSON.stringify(body);

  const data = await req.loadJSON();
  const status = req.response.statusCode;
  if (status < 200 || status >= 300) {
    const message = data && data.message ? data.message : `HTTP ${status}`;
    throw new Error(message);
  }
  return data;
}

async function getTasks() {
  return supabaseRequest("todo_tasks?select=*&order=created_at.asc");
}

async function createTask({ text, category, who, due_at }) {
  await supabaseRequest("todo_tasks", {
    method: "POST",
    body: { text, category, who: who || null, due_at: due_at || null },
    prefer: "return=minimal",
  });
}

async function toggleTask(id, done) {
  await supabaseRequest(`todo_tasks?id=eq.${id}`, {
    method: "PATCH",
    body: { done },
    prefer: "return=minimal",
  });
}

async function deleteTask(id) {
  await supabaseRequest(`todo_tasks?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
}

function isOverdue(task) {
  return !task.done && task.due_at && new Date(task.due_at) < new Date();
}

function formatDue(iso) {
  const fmt = new DateFormatter();
  fmt.useShortDateStyle();
  fmt.useShortTimeStyle();
  return fmt.string(new Date(iso));
}

if (config.runsInWidget) {
  Script.setWidget(await createWidget());
  Script.complete();
} else {
  await showTable();
  Script.complete();
}

async function createWidget() {
  const widget = new ListWidget();
  widget.backgroundColor = Color.dynamic(new Color("#f7f6f3"), new Color("#1c1b19"));

  let tasks;
  try {
    tasks = await getTasks();
  } catch (e) {
    widget.addText("Failed to load: " + e.message);
    return widget;
  }

  const title = widget.addText("Family Todo");
  title.font = Font.boldSystemFont(16);
  title.textColor = Color.dynamic(new Color("#2b2a27"), new Color("#ece9e1"));
  widget.addSpacer(6);

  const pending = tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      const ad = a.due_at ? new Date(a.due_at).getTime() : Infinity;
      const bd = b.due_at ? new Date(b.due_at).getTime() : Infinity;
      return ad - bd;
    });

  const max = config.widgetFamily === "large" ? 10 : config.widgetFamily === "medium" ? 5 : 4;
  const shown = pending.slice(0, max);

  if (shown.length === 0) {
    const empty = widget.addText("Nothing pending 🎉");
    empty.textColor = Color.gray();
    empty.font = Font.systemFont(13);
  }

  for (const task of shown) {
    const row = widget.addStack();
    row.layoutHorizontally();
    row.addText(isOverdue(task) ? "🔴" : "⚪️").font = Font.systemFont(11);
    row.addSpacer(6);

    const col = row.addStack();
    col.layoutVertically();

    const text = col.addText(task.text);
    text.font = Font.systemFont(13);
    text.lineLimit = 1;
    text.textColor = isOverdue(task)
      ? new Color("#b0413e")
      : Color.dynamic(new Color("#2b2a27"), new Color("#ece9e1"));

    const metaParts = [task.who, task.due_at ? formatDue(task.due_at) : null].filter(Boolean);
    if (metaParts.length) {
      const meta = col.addText(metaParts.join(" · "));
      meta.font = Font.systemFont(10);
      meta.textColor = Color.gray();
    }

    widget.addSpacer(4);
  }

  widget.addSpacer();
  const footer = widget.addText("Tap to open");
  footer.font = Font.systemFont(9);
  footer.textColor = Color.gray();

  return widget;
}

async function showTable() {
  const table = new UITable();
  table.showSeparators = true;
  let rows = [];

  const reload = async () => {
    for (const row of rows) table.removeRow(row);
    rows = await buildRows(reload);
    for (const row of rows) table.addRow(row);
    table.reload();
  };

  rows = await buildRows(reload);
  for (const row of rows) table.addRow(row);

  await table.present();
}

async function buildRows(reload) {
  let tasks;
  try {
    tasks = await getTasks();
  } catch (e) {
    const alert = new Alert();
    alert.title = "Error";
    alert.message = "Failed to load tasks: " + e.message;
    alert.addAction("OK");
    await alert.presentAlert();
    return [];
  }

  const rows = [];

  const linkRow = new UITableRow();
  linkRow.dismissOnSelect = true;
  linkRow.addText("🌐 Open Website");
  linkRow.onSelect = () => Safari.open(WEBSITE_URL);
  rows.push(linkRow);

  const addRow = new UITableRow();
  addRow.dismissOnSelect = false;
  addRow.addText("➕ Add Task");
  addRow.onSelect = async () => {
    await addTaskFlow();
    await reload();
  };
  rows.push(addRow);

  rows.push(...buildSection("Regular", tasks.filter((t) => t.category === "regular"), reload));
  rows.push(...buildSection("Big", tasks.filter((t) => t.category === "big"), reload));

  return rows;
}

function buildSection(label, items, reload) {
  const rows = [];

  const header = new UITableRow();
  header.isHeader = true;
  header.addText(label);
  rows.push(header);

  const sorted = items.slice().sort((a, b) => Number(a.done) - Number(b.done));

  if (sorted.length === 0) {
    const row = new UITableRow();
    row.addText("Nothing here").titleColor = Color.gray();
    rows.push(row);
    return rows;
  }

  for (const task of sorted) {
    const row = new UITableRow();
    row.dismissOnSelect = false;

    const overdue = isOverdue(task);

    const checkCell = row.addText(task.done ? "✅" : "⬜️");
    checkCell.widthWeight = 8;

    const metaParts = [task.who, task.due_at ? formatDue(task.due_at) : null].filter(Boolean);
    const textCell = row.addText(task.text, metaParts.join(" · "));
    textCell.widthWeight = 80;
    if (task.done) {
      textCell.titleColor = Color.gray();
      textCell.subtitleColor = Color.gray();
    } else if (overdue) {
      textCell.titleColor = new Color("#b0413e");
      textCell.subtitleColor = new Color("#b0413e");
    }

    row.onSelect = async () => {
      await taskActionFlow(task);
      await reload();
    };

    rows.push(row);
  }

  return rows;
}

async function taskActionFlow(task) {
  const alert = new Alert();
  alert.title = task.text;
  alert.message = [task.who, task.due_at ? formatDue(task.due_at) : null].filter(Boolean).join(" · ");
  alert.addAction(task.done ? "Mark Not Done" : "Mark Done");
  alert.addDestructiveAction("Delete");
  alert.addCancelAction("Cancel");
  const choice = await alert.presentSheet();

  try {
    if (choice === 0) {
      await toggleTask(task.id, !task.done);
    } else if (choice === 1) {
      await deleteTask(task.id);
    }
  } catch (e) {
    const errAlert = new Alert();
    errAlert.title = "Action failed";
    errAlert.message = e.message;
    errAlert.addAction("OK");
    await errAlert.presentAlert();
  }
}

async function addTaskFlow() {
  const textAlert = new Alert();
  textAlert.title = "New Task";
  textAlert.addTextField("Task description");
  textAlert.addAction("Next");
  textAlert.addCancelAction("Cancel");
  const r1 = await textAlert.presentAlert();
  if (r1 === -1) return;
  const text = textAlert.textFieldValue(0).trim();
  if (!text) return;

  const catAlert = new Alert();
  catAlert.title = "Category";
  catAlert.addAction("Regular");
  catAlert.addAction("Big");
  const category = (await catAlert.presentSheet()) === 1 ? "big" : "regular";

  const whoAlert = new Alert();
  whoAlert.title = "Who?";
  for (const w of WHO_OPTIONS) whoAlert.addAction(w);
  whoAlert.addAction("Other...");
  whoAlert.addCancelAction("Skip");
  const whoChoice = await whoAlert.presentSheet();
  let who = "";
  if (whoChoice >= 0 && whoChoice < WHO_OPTIONS.length) {
    who = WHO_OPTIONS[whoChoice];
  } else if (whoChoice === WHO_OPTIONS.length) {
    const customAlert = new Alert();
    customAlert.title = "Who?";
    customAlert.addTextField("Name");
    customAlert.addAction("OK");
    customAlert.addCancelAction("Cancel");
    if ((await customAlert.presentAlert()) !== -1) {
      who = customAlert.textFieldValue(0).trim();
    }
  }

  const dueAlert = new Alert();
  dueAlert.title = "Due date?";
  dueAlert.addAction("Set due date");
  dueAlert.addAction("No due date");
  let due_at = "";
  if ((await dueAlert.presentSheet()) === 0) {
    const dp = new DatePicker();
    dp.initialDate = new Date();
    due_at = (await dp.pickDateAndTime()).toISOString();
  }

  try {
    await createTask({ text, category, who, due_at });
  } catch (e) {
    const errAlert = new Alert();
    errAlert.title = "Failed to add task";
    errAlert.message = e.message;
    errAlert.addAction("OK");
    await errAlert.presentAlert();
  }
}
