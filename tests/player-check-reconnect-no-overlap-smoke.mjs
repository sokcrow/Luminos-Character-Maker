import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const coordinatorCode = fs.readFileSync("js/theatre-check-coordinator.js", "utf8");
const opposedCode = fs.readFileSync("js/theatre-opposed-checks.js", "utf8");
const css = fs.readFileSync("css/theatre-check-coordinator.css", "utf8");
const html = fs.readFileSync("hoja_personaje.html", "utf8");
new vm.Script(coordinatorCode, { filename: "js/theatre-check-coordinator.js" });
new vm.Script(opposedCode, { filename: "js/theatre-opposed-checks.js" });

assert.match(css, /#theatre-check-front-layer \.theatre-check-player-notice[\s\S]*?pointer-events: none !important;/,
  "Notices must not intercept clicks");
assert.match(css, /#theatre-check-front-layer \.theatre-check-result-stack[\s\S]*?display: flex;/,
  "Recent results must have a dedicated layout");
assert.match(css, /#theatre-check-front-layer\.has-check-command-prompt \.theatre-check-result-stack/,
  "Results must not cover a pending Check");
assert.match(coordinatorCode, /RESULT_NOTICE_MAX_AGE_MS = 25 \* 1000/,
  "Rejoining must not replay 10 minutes of result notifications");
assert.match(coordinatorCode, /state\.queuedCommandKeys\.has\(snapshot\.key\)/,
  "Firebase replay must not enqueue duplicate commands");
assert.match(opposedCode, /state\.opposedCommands\.get\(prompt\.dataset\.commandKey\)/,
  "VS prompts must bind by exact command key");
assert.ok(html.includes("v=20261009-check-reconnect-2"),
  "Player must receive fresh Check assets, not cached versions");

function element(tagName) {
  const classes = new Set();
  return {
    tagName: tagName.toUpperCase(), id: "", dataset: {}, children: [], parentElement: null,
    textContent: "", listeners: {}, style: {},
    classList: {
      contains(name) { return classes.has(name); },
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
    },
    setAttribute() {},
    appendChild(child) {
      if (child.parentElement) child.remove();
      child.parentElement = this;
      this.children.push(child);
      return child;
    },
    append(...children) { children.forEach((child) => this.appendChild(child)); },
    remove() {
      if (this.parentElement) {
        const siblings = this.parentElement.children;
        const index = siblings.indexOf(this);
        if (index >= 0) siblings.splice(index, 1);
      }
      this.parentElement = null;
    },
    get isConnected() { return !!this.parentElement; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener(type, listener) { this.listeners[type] = listener; },
  };
}

const body = element("body");
body.classList.add("player-instance-theatre");
const theatre = element("main");
theatre.id = "theatre-view-player";
body.appendChild(theatre);
const find = (root, id) => root.id === id ? root :
  root.children.map((child) => find(child, id)).find(Boolean) || null;
const document = {
  readyState: "loading", body, createElement: element,
  addEventListener() {}, querySelector() { return null; },
  getElementById(id) { return find(body, id); },
};

const listeners = new Map();
const seen = new Map([["luminousTheatreCheck:interrupted-1", "done"]]);
const sessionStorage = {
  getItem(key) { return seen.get(key) ?? null; },
  setItem(key, value) { seen.set(key, value); },
  removeItem(key) { seen.delete(key); },
};
const refs = (path = "") => ({
  limitToLast() { return this; },
  on(type, listener) { listeners.set(`${path}:${type}`, listener); },
  once: async () => ({
    val: () => path.endsWith("/status") ? "issued" : null,
  }),
});
const database = () => ({ ref: refs });
database.ServerValue = { TIMESTAMP: 1 };
const window = {
  document, sessionStorage, console,
  firebase: { database, auth: () => ({ currentUser: { uid: "player-1" } }) },
};
window.window = window;
vm.runInNewContext(coordinatorCode, window);
window.LuminousTheatreCheckCoordinator.bindAuthorizedData();

const commandListener = listeners.get("theatre_check_commands/player-1:child_added");
assert.equal(typeof commandListener, "function");

const interrupted = {
  status: "issued", targetUid: "player-1", roomKey: "default",
  clientIssuedAt: Date.now(), rollSpec: { kind: "skill", abilityId: "wis", skillId: "perception", label: "Perception" },
  check: { thresholdRaw: 18, hiddenThreshold: false },
};
const snapshot = { key: "interrupted-1", val: () => interrupted };
await commandListener(snapshot);
assert.equal(sessionStorage.getItem("luminousTheatreCheck:interrupted-1"), null,
  "An interrupted roll must be recoverable even when the last tab marked it done");

let prompt = document.getElementById("theatre-check-command-prompt");
assert.ok(prompt, "The recovered command must display TIRAR again");
assert.match(prompt.children[0].textContent, /INTERRUMPIDO/);
const button = prompt.children.find((child) => child.tagName === "BUTTON");
assert.equal(button.textContent, "TIRAR");
await commandListener(snapshot);
assert.equal(body.children.filter((child) => child.id === "theatre-check-front-layer").length, 1);
assert.equal(document.getElementById("theatre-check-front-layer").children
  .filter((child) => child.id === "theatre-check-command-prompt").length, 1,
  "Command replay must not stack a second prompt over the first");

button.listeners.click();
await new Promise((resolve) => setImmediate(resolve));
prompt = document.getElementById("theatre-check-command-prompt");
assert.ok(prompt, "A missing Stats roll target must not silently discard the Check");
assert.equal(button.disabled, false, "TIRAR must unlock after a recoverable error");
assert.equal(button.textContent, "REINTENTAR");
assert.ok(document.getElementById("theatre-check-front-layer")
  .classList.contains("has-check-command-prompt"), "The prompt must retain priority while retrying");

console.log("Player Check reconnect and no-overlap regression: OK");
