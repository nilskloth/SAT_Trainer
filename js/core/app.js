/* =========================================================
   v2 boot + hash router.
   ========================================================= */

import { initStore } from "./store.js";
import { loadContent } from "./loader.js";
import { renderHome } from "../views/home.js";
import { renderPractice } from "../views/practice.js";
import { renderPapers } from "../views/paper.js";
import { renderProgress } from "../views/progress.js";

const ROUTES = [
  { path: "home", nav: "Home", render: renderHome },
  { path: "papers", nav: "Papers", render: renderPapers },
  { path: "practice", nav: "Practice", render: renderPractice },
  { path: "grown-ups", nav: "Grown-ups", render: renderProgress }
];

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { path: parts[0] || "home", params: parts.slice(1) };
}

function route() {
  const { path, params } = parseHash();
  const match = ROUTES.find(r => r.path === path) || ROUTES[0];

  document.querySelectorAll(".app-nav a").forEach(a => {
    a.classList.toggle("active", a.dataset.route === match.path);
  });

  const view = document.getElementById("view");
  view.innerHTML = "";
  delete view.dataset.subject;
  match.render(view, params);
}

function buildNav() {
  const nav = document.querySelector(".app-nav");
  nav.innerHTML = "";
  ROUTES.forEach(r => {
    const a = document.createElement("a");
    a.href = `#/${r.path}`;
    a.dataset.route = r.path;
    a.textContent = r.nav;
    nav.appendChild(a);
  });
}

(async function boot() {
  const view = document.getElementById("view");
  try {
    initStore();
    view.innerHTML = `<div class="card"><p class="muted">Getting your questions ready…</p></div>`;
    await loadContent();
    buildNav();
    window.addEventListener("hashchange", route);
    route();
    console.log("SATs Trainer v2 ready");
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
