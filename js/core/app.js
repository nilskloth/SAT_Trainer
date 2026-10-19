/* =========================================================
   Boot + hash router.
   Two levels share one shell: Primary (KS2 SATs) and
   Secondary (languages). The level is chosen on #/start and
   remembered; each level has its own nav.
   ========================================================= */

import { initStore, getStore, setLevel } from "./store.js";
import { loadContent } from "./loader.js";
import { renderHome } from "../views/home.js";
import { renderPractice } from "../views/practice.js";
import { renderPapers } from "../views/paper.js";
import { renderProgress } from "../views/progress.js";
import { renderStart } from "../views/start.js";
import { renderSecondary } from "../views/secondary/home.js";
import { availableLangs } from "../views/secondary/langs.js";

const ROUTES = [
  { path: "start", render: renderStart },
  { path: "home", level: "primary", render: renderHome },
  { path: "papers", level: "primary", render: renderPapers },
  { path: "practice", level: "primary", render: renderPractice },
  { path: "secondary", level: "secondary", render: renderSecondary },
  { path: "grown-ups", render: renderProgress }
];

const NAV = {
  primary: [
    { href: "#/home", label: "Home", match: "home" },
    { href: "#/papers", label: "Papers", match: "papers" },
    { href: "#/practice", label: "Practice", match: "practice" },
    { href: "#/grown-ups", label: "Grown-ups", match: "grown-ups" }
  ],
  secondary: [
    { href: "#/secondary", label: "Home", match: "secondary" },
    /* one item per language with word lists — filled in by refreshLanguageNav() */
    { href: "#/grown-ups", label: "Grown-ups", match: "grown-ups" }
  ]
};

/* Languages appear in the nav once they have word lists (built in or uploaded). */
async function refreshLanguageNav() {
  const langs = await availableLangs();
  NAV.secondary = [
    NAV.secondary[0],
    ...langs.map(l => ({ href: `#/secondary/${l.code}`, label: l.label, match: `secondary/${l.code}` })),
    NAV.secondary[NAV.secondary.length - 1]
  ];
  const { path, params } = parseHash();
  if (getStore().settings.level === "secondary") buildChrome("secondary", path, params);
}

const TITLES = { primary: "SATs Trainer", secondary: "Language Trainer" };
const HOME = { primary: "#/home", secondary: "#/secondary" };

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { path: parts[0] || "", params: parts.slice(1) };
}

function buildChrome(level, path, params) {
  document.querySelector(".app-title").textContent = TITLES[level] || "Trainer";
  const nav = document.querySelector(".app-nav");
  nav.innerHTML = "";
  if (!level || path === "start") return;

  const here = [path, ...params].join("/");
  const items = NAV[level];
  /* longest matching prefix wins, so "secondary/de" beats "secondary" */
  const active = items.filter(i => here === i.match || here.startsWith(i.match + "/"))
    .sort((a, b) => b.match.length - a.match.length)[0];

  items.forEach(i => {
    const a = document.createElement("a");
    a.href = i.href;
    a.textContent = i.label;
    if (i === active) a.classList.add("active");
    nav.appendChild(a);
  });

  const sw = document.createElement("a");
  sw.href = "#/start";
  sw.className = "level-switch";
  sw.textContent = level === "primary" ? "Primary ⇄" : "Secondary ⇄";
  sw.title = "Switch between Primary and Secondary";
  nav.appendChild(sw);
}

function route() {
  const store = getStore();
  let { path, params } = parseHash();
  let level = store.settings.level;

  if (!level && path !== "start") { location.replace("#/start"); return; }
  if (!path) { location.replace(HOME[level]); return; }

  const match = ROUTES.find(r => r.path === path);
  if (!match) { location.replace(HOME[level]); return; }

  /* A deep link into the other level switches level. */
  if (match.level && match.level !== level) {
    setLevel(match.level);
    level = match.level;
  }

  buildChrome(level, path, params);

  const view = document.getElementById("view");
  view.innerHTML = "";
  delete view.dataset.subject;
  match.render(view, params);
}

(async function boot() {
  const view = document.getElementById("view");
  try {
    initStore();
    view.innerHTML = `<div class="card"><p class="muted">Getting your questions ready…</p></div>`;
    await loadContent();
    window.addEventListener("hashchange", route);
    route();
    refreshLanguageNav();
    window.addEventListener("langs-changed", refreshLanguageNav);   // after a word-list upload
    console.log("Trainer ready");
  } catch (err) {
    console.error("Failed to start:", err);
    view.innerHTML = `
      <div class="card">
        <h2 style="margin-top:0;">Something needs fixing</h2>
        <p>The question files couldn't load. Check your connection and refresh the page.</p>
        <p class="muted">${String(err.message || err)}</p>
      </div>`;
  }
})();
