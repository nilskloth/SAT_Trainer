/* =========================================================
   v2 boot + hash router.
   Views register as { path, title, render(el, params) }.
   ========================================================= */

import { initStore } from "./store.js";
import { renderHome } from "../views/home.js";
import { renderPractice } from "../views/practice.js";
import { renderPapers } from "../views/paper.js";
import { renderProgress } from "../views/progress.js";

const ROUTES = [
  { path: "home", nav: "Home", render: renderHome },
  { path: "practice", nav: "Practice", render: renderPractice },
  { path: "papers", nav: "Papers", render: renderPapers },
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

initStore();
buildNav();
window.addEventListener("hashchange", route);
route();

console.log("SATs Trainer v2 shell ready");
