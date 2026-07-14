const WHO_OPTIONS = ["Ty", "Kari", "Olivia", "family", "parents"];
const POLL_INTERVAL_MS = 20000;

let tasks = [];
let selectedCategory = "regular";
let selectedWho = "";

const regularList = document.getElementById("regular-list");
const bigList = document.getElementById("big-list");
const addForm = document.getElementById("add-form");
const textInput = document.getElementById("text-input");
const dueInput = document.getElementById("due-input");
const whoInput = document.getElementById("who-input");
const whoButtons = document.getElementById("who-buttons");
const refreshBtn = document.getElementById("refresh-btn");

document.querySelectorAll(".cat-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    selectedCategory = btn.dataset.category;
    document.querySelectorAll(".cat-btn").forEach(b => b.classList.toggle("active", b === btn));
  });
});

whoButtons.addEventListener("click", e => {
  const btn = e.target.closest(".who-btn");
  if (!btn) return;
  selectedWho = btn.dataset.who;
  whoInput.value = selectedWho;
  document.querySelectorAll(".who-btn").forEach(b => b.classList.toggle("active", b === btn));
});

whoInput.addEventListener("input", () => {
  selectedWho = whoInput.value;
  document.querySelectorAll(".who-btn").forEach(b => b.classList.toggle("active", b.dataset.who === selectedWho));
});

refreshBtn.addEventListener("click", load);

const addBtn = addForm.querySelector(".add-btn");

addForm.addEventListener("submit", async e => {
  e.preventDefault();
  const text = textInput.value.trim();
  if (!text) return;

  const due_at = dueInput.value ? new Date(dueInput.value).toISOString() : "";

  addBtn.disabled = true;
  addBtn.textContent = "Adding...";

  try {
    await addTask({ text, category: selectedCategory, who: selectedWho, due_at });
    textInput.value = "";
    dueInput.value = "";
    whoInput.value = "";
    selectedWho = "";
    document.querySelectorAll(".who-btn").forEach(b => b.classList.remove("active"));
  } catch (err) {
    console.error("Failed to add task", err);
  } finally {
    addBtn.disabled = false;
    addBtn.textContent = "Add task";
  }

  load();
});

function render() {
  renderList(regularList, tasks.filter(t => t.category === "regular"));
  renderList(bigList, tasks.filter(t => t.category === "big"));
}

function renderList(el, items) {
  el.innerHTML = "";

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-state";
    li.textContent = "Nothing here";
    el.appendChild(li);
    return;
  }

  items
    .slice()
    .sort((a, b) => Number(isDone(a)) - Number(isDone(b)))
    .forEach(task => el.appendChild(renderItem(task)));
}

function renderItem(task) {
  const done = isDone(task);
  const overdue = !done && task.due_at && new Date(task.due_at) < new Date();

  const li = document.createElement("li");
  li.className = "task-item" + (done ? " done" : "") + (overdue ? " overdue" : "");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = done;
  checkbox.addEventListener("change", async () => {
    const next = checkbox.checked;
    setBusy(true);
    try {
      await toggleTask(task.id, next);
    } catch (err) {
      console.error("Failed to toggle task", err);
      checkbox.checked = !next;
      setBusy(false);
      return;
    }
    load();
  });

  const main = document.createElement("div");
  main.className = "task-main";

  const textEl = document.createElement("div");
  textEl.className = "task-text";
  textEl.textContent = task.text;

  const meta = document.createElement("div");
  meta.className = "task-meta";

  if (task.who) {
    const whoBadge = document.createElement("span");
    whoBadge.className = "who-badge";
    whoBadge.textContent = task.who;
    meta.appendChild(whoBadge);
  }

  if (task.due_at) {
    const dueEl = document.createElement("span");
    dueEl.className = "due-date" + (overdue ? " overdue-text" : "");
    dueEl.textContent = formatDue(task.due_at);
    meta.appendChild(dueEl);
  }

  main.appendChild(textEl);
  if (meta.childNodes.length) main.appendChild(meta);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "✕";
  deleteBtn.title = "Delete";
  deleteBtn.addEventListener("click", async () => {
    setBusy(true);
    try {
      await deleteTask(task.id);
    } catch (err) {
      console.error("Failed to delete task", err);
      setBusy(false);
      return;
    }
    load();
  });

  function setBusy(busy) {
    li.classList.toggle("pending", busy);
    checkbox.disabled = busy;
    deleteBtn.disabled = busy;
    deleteBtn.innerHTML = busy ? '<span class="spinner"></span>' : "✕";
  }

  li.appendChild(checkbox);
  li.appendChild(main);
  li.appendChild(deleteBtn);
  return li;
}

function isDone(task) {
  return task.done === true || task.done === "TRUE" || task.done === "true";
}

function formatDue(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function load() {
  refreshBtn.classList.add("spinning");
  try {
    tasks = await getTasks();
    render();
  } catch (err) {
    console.error("Failed to load tasks", err);
  } finally {
    refreshBtn.classList.remove("spinning");
  }
}

load();
setInterval(load, POLL_INTERVAL_MS);
window.addEventListener("focus", load);
