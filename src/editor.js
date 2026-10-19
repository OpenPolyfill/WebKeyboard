 "use strict";
const send = (action, extra = {}) => browser.runtime.sendMessage({ type: "webkeyboard-layout", action, ...extra });
const form = document.querySelector("#form");
const list = document.querySelector("#list");
const status = document.querySelector("#status");
const inheritSource = document.querySelector("#inherit-source");
let customLayouts = [];

async function refresh() {
  const [standards, customs] = await Promise.all([
    send("listLayouts"),
    send("listCustomLayouts"),
  ]);
  customLayouts = customs;
  inheritSource.replaceChildren(new Option("Select a layout…", ""));
  for (const item of standards) {
    inheritSource.add(new Option(item.name, item.id));
  }
  for (const item of customs) {
    inheritSource.add(new Option(`${item.name} (custom)`, `custom:${item.id}`));
  }

  list.replaceChildren(...customs.map((item) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    const edit = document.createElement("button");
    const remove = document.createElement("button");
    name.textContent = item.name;
    edit.textContent = "Edit";
    remove.textContent = "Delete";
    edit.addEventListener("click", () => {
      document.querySelector("#id").value = item.id;
      document.querySelector("#name").value = item.name;
      document.querySelector("#data").value = JSON.stringify(item.data, null, 2);
    });
    remove.addEventListener("click", async () => {
      await send("deleteCustomLayout", { id: item.id });
      await refresh();
      status.textContent = `Deleted ${item.name}.`;
    });
    li.append(name, edit, remove);
    return li;
  }));
}

document.querySelector("#inherit").addEventListener("click", async () => {
  const sourceId = inheritSource.value;
  if (!sourceId) return;
  try {
    const inherited = sourceId.startsWith("custom:")
      ? customLayouts.find((item) => item.id === sourceId.slice(7))
      : await send("getLayoutPreset", { id: sourceId });
    if (!inherited) throw new Error("The selected layout is unavailable");
    document.querySelector("#id").value = "";
    if (!document.querySelector("#name").value.trim()) {
      document.querySelector("#name").value = `${inherited.name} copy`;
    }
    document.querySelector("#data").value = JSON.stringify(inherited.data, null, 2);
    status.textContent = `Inherited ${inherited.name}; save it as a custom layout.`;
  } catch (error) {
    status.textContent = error.message;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = JSON.parse(document.querySelector("#data").value);
    const saved = await send("saveCustomLayout", {
      layout: {
        id: document.querySelector("#id").value || undefined,
        name: document.querySelector("#name").value,
        data,
      },
    });
    status.textContent = `Saved ${saved.name}.`;
    form.reset();
    await refresh();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector("#clear").addEventListener("click", () => form.reset());
refresh().catch((error) => { status.textContent = error.message; });
