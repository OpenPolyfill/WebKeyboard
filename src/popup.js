"use strict";
const input = document.querySelector("#search");
const options = document.querySelector("#options");
const status = document.querySelector("#status");
const send = (action, extra = {}) => browser.runtime.sendMessage({ type: "webkeyboard-layout", action, ...extra });
async function start() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const origin = tab?.url ? new URL(tab.url).origin : null;
  if (!origin || origin === "null") { status.textContent = "This page cannot have a site-specific layout."; input.disabled = true; return; }
  const [saved, customs, standardLayouts] = await Promise.all([
    send("getLayout", { origin }),
    send("listCustomLayouts"),
    send("listLayouts"),
  ]);
  const systemLayoutName = saved.systemLayoutName;
  const systemChoice = systemLayoutName ? `System (${systemLayoutName})` : "System";
  const choices = [{ id: "system", name: systemChoice }, ...standardLayouts, ...customs.map((x) => ({ id: `custom:${x.id}`, name: `${x.name} (custom)` }))];
  function render() {
    const matches = choices.filter((x) => x.name.toLowerCase().includes(input.value.trim().toLowerCase()));
    options.replaceChildren(...matches.map((choice) => {
      const button = document.createElement("button");
      button.type = "button"; button.setAttribute("role", "option"); button.textContent = choice.name;
      button.setAttribute("aria-selected", String(choice.id === saved.layoutId));
      button.addEventListener("click", async () => {
        await send("setOriginLayout", { origin, layoutId: choice.id });
        status.textContent = `Saved ${choice.name} for ${origin}.`;
        window.close();
      });
      return button;
    }));
    if (!matches.length) options.textContent = "No matching layouts";
  }
  input.addEventListener("input", render); render();
  document.querySelector("#editor").addEventListener("click", () => browser.tabs.create({ url: browser.runtime.getURL("editor.html") }));
}
start().catch((error) => { status.textContent = error.message; });
