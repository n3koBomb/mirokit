/* Document tabs follow the contacts page's keyboard and browser-history behavior. */
(() => {
  const tabs = [...document.querySelectorAll('.privacy-tabs [role="tab"]')];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));

  function activate(index) {
    tabs.forEach((tab, position) => {
      const selected = position === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[position].hidden = !selected;
    });
  }

  function select(index) {
    activate(index);
    const hash = `#${panels[index].id}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }

  function syncLocation() {
    // Contents links such as #privacy-6 must also select the Russian document.
    const target = document.getElementById(window.location.hash.slice(1));
    const index = panels.findIndex((panel) => target && panel.contains(target));
    activate(index < 0 ? 0 : index);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(index));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(next);
      tabs[next].focus();
    });
  });

  window.addEventListener("hashchange", syncLocation);
  window.addEventListener("popstate", syncLocation);
  syncLocation();
})();
