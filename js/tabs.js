/* =========================
   Tabs (ES module)
========================= */
/* jshint esversion: 11 */

export function initTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));

  function showTab(name) {
    tabs.forEach(function (tab) {
      tab.classList.toggle("active", tab.dataset.tab === name);
    });

    document.querySelectorAll("[id^='tab-']").forEach(function (panel) {
      panel.classList.toggle("hidden", panel.id !== `tab-${name}`);
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      showTab(tab.dataset.tab);
    });
  });

  const active = tabs.find(function (t) { return t.classList.contains("active"); });
  showTab(active ? active.dataset.tab : "runner");
}

/* Optional bridge */
window.initTabs = initTabs;