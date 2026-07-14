const BASE_URL = "https://script.google.com/macros/s/AKfycbxCW36ESXwaoJHZmOXRJsJ6fc0hme6TInILJO01mvZ4r2LkpoUtfLdVeTx15dB7xrAduQ/exec";
const TOKEN = "7wheW5VA4Wyxx_8XnUg1wEtIZ1PbQCVX";

async function getTasks() {
  const res = await fetch(`${BASE_URL}?token=${encodeURIComponent(TOKEN)}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.tasks;
}

async function addTask({ text, category, who, due_at }) {
  const id = crypto.randomUUID().slice(0, 8);
  await post({ action: "create", id, text, category, who, due_at });
  return id;
}

async function toggleTask(id, done) {
  await post({ action: "toggle", id, done });
}

async function updateTask(id, fields) {
  await post({ action: "update", id, ...fields });
}

async function deleteTask(id) {
  await post({ action: "delete", id });
}

async function post(body) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: TOKEN, ...body })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}
