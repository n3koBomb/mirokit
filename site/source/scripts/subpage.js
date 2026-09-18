/* Shared theme behavior for the privacy page, whose document has no page module. */
const subpageToggle = document.querySelector("[data-theme-toggle]");
let subpageTheme = "light";

try {
   subpageTheme = localStorage.getItem("mirokitTheme") === "dark" ? "dark" : "light";
} catch {
   // Theme still applies to this page when storage is blocked.
}

function syncSubpageTheme() {
   const isDark = subpageTheme === "dark";
   document.documentElement.dataset.theme = subpageTheme;
   document.body.classList.toggle("theme-dark", isDark);
   if (!subpageToggle) return;
   const labelKey = isDark ? "theme_light" : "theme_dark";
   const label = T[currentLang]?.[labelKey] || (isDark ? "Light theme" : "Dark theme");
   subpageToggle.setAttribute("aria-pressed", String(isDark));
   subpageToggle.setAttribute("aria-label", label);
   subpageToggle.setAttribute("title", label);
   const labelNode = subpageToggle.querySelector(".theme-toggle-label");
   if (labelNode) labelNode.textContent = label;
}

subpageToggle?.addEventListener("click", () => {
   subpageTheme = subpageTheme === "dark" ? "light" : "dark";
   try {
      localStorage.setItem("mirokitTheme", subpageTheme);
   } catch {
      // Theme still applies to this page when storage is blocked.
   }
   syncSubpageTheme();
});

document.addEventListener("mirokit:languagechange", syncSubpageTheme);
syncSubpageTheme();
