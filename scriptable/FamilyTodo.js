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

const BASE_URL = "https://script.google.com/macros/s/AKfycbxCW36ESXwaoJHZmOXRJsJ6fc0hme6TInILJO01mvZ4r2LkpoUtfLdVeTx15dB7xrAduQ/exec";
const TOKEN = "7wheW5VA4Wyxx_8XnUg1wEtIZ1PbQCVX";
const WHO_OPTIONS = ["Ty", "Kari", "Olivia", "family", "parents"];

async function getTasks() {
  const req = new Request(`${BASE_URL}?token=${encodeURIComponent(TOKEN)}`);
  const data = await req.loadJSON();
  if (data.error) throw new Error(data.error);
  return data.tasks;
}

async function post(body) {
  const req = new Request(BASE_URL);
  req.method = "POST";
  req.headers = { "Content-Type": "text/plain;charset=utf-8" };
  req.body = JSON.stringify({ token: TOKEN, ...body });
  const data = await req.loadJSON();
  if (data.error) throw new Error(data.error);
  return data;
}

function isDone(task) {
  return task.done === true || task.done === "TRUE" || task.done === "true";
}

function isOverdue(task) {
  return !isDone(task) && task.due_at && new Date(task.due_at) < new Date();
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
    .filter(t => !isDone(t))
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
  let tasks;
  try {
    tasks = await getTasks();
  } catch (e) {
    const alert = new Alert();
    alert.title = "Error";
    alert.message = "Failed to load tasks: " + e.message;
    alert.addAction("OK");
    await alert.presentAlert();
    return;
  }

  const table = new UITable();
  table.showSeparators = true;

  const addRow = new UITableRow();
  addRow.dismissOnSelect = false;
  addRow.addText("➕ Add Task");
  addRow.onSelect = async () => {
    await addTaskFlow();
    await showTable();
  };
  table.addRow(addRow);

  addSection(table, "Regular", tasks.filter(t => t.category === "regular"));
  addSection(table, "Big", tasks.filter(t => t.category === "big"));

  await table.present();
}

function addSection(table, label, items) {
  const header = new UITableRow();
  header.isHeader = true;
  header.addText(label);
  table.addRow(header);

  const sorted = items.slice().sort((a, b) => Number(isDone(a)) - Number(isDone(b)));

  if (sorted.length === 0) {
    const row = new UITableRow();
    row.addText("Nothing here").titleColor = Color.gray();
    table.addRow(row);
    return;
  }

  for (const task of sorted) {
    const row = new UITableRow();
    row.dismissOnSelect = false;

    const done = isDone(task);
    const overdue = isOverdue(task);

    const checkCell = row.addText(done ? "✅" : "⬜️");
    checkCell.widthWeight = 8;

    const metaParts = [task.who, task.due_at ? formatDue(task.due_at) : null].filter(Boolean);
    const textCell = row.addText(task.text, metaParts.join(" · "));
    textCell.widthWeight = 80;
    if (done) {
      textCell.titleColor = Color.gray();
      textCell.subtitleColor = Color.gray();
    } else if (overdue) {
      textCell.titleColor = new Color("#b0413e");
      textCell.subtitleColor = new Color("#b0413e");
    }

    row.onSelect = async () => {
      await taskActionFlow(task);
      await showTable();
    };

    table.addRow(row);
  }
}

async function taskActionFlow(task) {
  const done = isDone(task);
  const alert = new Alert();
  alert.title = task.text;
  alert.message = [task.who, task.due_at ? formatDue(task.due_at) : null].filter(Boolean).join(" · ");
  alert.addAction(done ? "Mark Not Done" : "Mark Done");
  alert.addDestructiveAction("Delete");
  alert.addCancelAction("Cancel");
  const choice = await alert.presentSheet();

  if (choice === 0) {
    await post({ action: "toggle", id: task.id, done: !done });
  } else if (choice === 1) {
    await post({ action: "delete", id: task.id });
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
    await post({
      action: "create",
      id: Math.random().toString(36).slice(2, 10),
      text,
      category,
      who,
      due_at
    });
  } catch (e) {
    const errAlert = new Alert();
    errAlert.title = "Failed to add task";
    errAlert.message = e.message;
    errAlert.addAction("OK");
    await errAlert.presentAlert();
  }
}
