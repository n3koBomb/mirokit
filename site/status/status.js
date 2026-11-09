/* global T, currentLang */
const $ = (id) => document.getElementById(id);
const copy = (key) => T[currentLang]?.[`st_${key}`] || T.en[`st_${key}`] || key;
let view = "server";
let server = null;
let visits = null;
const errors = { server: false, visitors: false };
const loading = new Set();
const number = (value) => new Intl.NumberFormat(currentLang).format(value);

function notice() {
  $("statusRefresh").disabled = loading.has(view);
  $("statusNotice").textContent = errors[view] ? copy(view === "server" ? "error" : "stats_error") : loading.has(view) ? copy("loading") : "";
}

function renderServer() {
  const banner = $("serviceBanner");
  const state = errors.server ? "unknown" : server?.status || "unknown";
  banner.dataset.state = state;
  $("serviceTitle").textContent = copy(state === "operational" ? "all_operational" : state === "degraded" ? "degraded" : "waiting");
  $("serviceChecked").textContent = server ? `${copy("checked")}: ${new Date(server.checkedAt).toLocaleString(currentLang)}${errors.server ? ` · ${copy("stale")}` : ""}` : copy(errors.server ? "error" : "loading");
  const container = $("serviceComponents");
  container.setAttribute("aria-busy", String(loading.has("server")));
  container.replaceChildren();
  for (const id of ["worker", "website", "database", "media"]) {
    const component = server?.components.find((item) => item.id === id);
    const status = errors.server ? "unknown" : component?.status || "unknown";
    const row = document.createElement("article");
    row.className = "st-service";
    const description = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = copy(id);
    const note = document.createElement("p");
    note.textContent = copy(`${id}_note`);
    description.append(heading, note);
    const result = document.createElement("div");
    result.className = "st-service-state";
    result.dataset.state = status;
    result.textContent = copy(status);
    if (component?.latencyMs != null && !errors.server) {
      const latency = document.createElement("small");
      latency.textContent = `${number(component.latencyMs)} ms`;
      result.append(latency);
    }
    row.append(description, result);
    container.append(row);
  }
}

function countryLabel(code) {
  if (code === "unknown") return copy("unknown");
  try { return new Intl.DisplayNames([currentLang], { type: "region" }).of(code); }
  catch { return code; }
}

function rows(container, entries, label = (value) => value) {
  container.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "st-empty";
    empty.textContent = copy("empty");
    container.append(empty);
  }
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "st-row";
    const name = document.createElement("span");
    name.textContent = label(entry.label);
    const count = document.createElement("span");
    count.textContent = number(entry.views);
    row.append(name, count);
    container.append(row);
  }
}

function renderVisits() {
  const available = Boolean(visits) && !errors.visitors;
  $("visitsTotal").textContent = available ? number(visits.totals.views) : "—";
  $("visitsToday").textContent = available ? number(visits.totals.today) : "—";
  $("visitsSince").textContent = !available ? copy("stats_error") : visits.totals.since ? `${copy("since")}: ${visits.totals.since} · ${visits.host}` : copy("empty");
  const chart = $("visitsChart");
  chart.replaceChildren();
  const daily = [];
  if (available) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - 29);
    for (let i = 0; i < 30; i++) {
      const day = date.toISOString().slice(0, 10);
      daily.push({ label: day, views: visits.daily.find((entry) => entry.day === day)?.views || 0 });
      date.setUTCDate(date.getUTCDate() + 1);
    }
    const maximum = Math.max(1, ...daily.map((entry) => entry.views));
    for (const entry of daily) {
      const bar = document.createElement("span");
      bar.className = "st-bar";
      bar.dataset.empty = String(entry.views === 0);
      bar.style.height = `${Math.max(2, entry.views / maximum * 100)}%`;
      bar.title = `${entry.label}: ${number(entry.views)}`;
      bar.setAttribute("aria-hidden", "true");
      chart.append(bar);
    }
    chart.setAttribute("aria-label", `${copy("daily")}: ${number(daily.reduce((total, item) => total + item.views, 0))} ${copy("pageviews")}`);
  } else {
    chart.setAttribute("aria-label", copy("stats_error"));
  }
  rows($("visitsDaily"), daily);
  rows($("visitCountries"), available ? visits.countries : [], countryLabel);
  rows($("visitDevices"), available ? visits.devices : [], copy);
  rows($("visitPages"), available ? visits.pages : []);
}

async function load(section) {
  if (loading.has(section)) return;
  loading.add(section);
  notice();
  if (section === "server") renderServer();
  try {
    const response = await fetch(section === "server" ? "/api/v1/status" : "/api/v1/status/visits", { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Request failed");
    const data = await response.json();
    if (data.success !== true) throw new Error("Invalid response");
    if (section === "server") server = data;
    else visits = data;
    errors[section] = false;
  } catch {
    errors[section] = true;
  } finally {
    loading.delete(section);
    if (section === "server") renderServer();
    else renderVisits();
    notice();
  }
}

function setView() {
  view = new URL(location.href).searchParams.get("view") === "visitors" ? "visitors" : "server";
  for (const link of document.querySelectorAll("[data-status-view]")) {
    if (link.dataset.statusView === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
    const target = new URL(location.href);
    target.searchParams.set("view", link.dataset.statusView);
    link.href = `${target.pathname}${target.search}`;
  }
  $("serverPanel").hidden = view !== "server";
  $("visitorsPanel").hidden = view !== "visitors";
  notice();
  void load(view);
}

for (const link of document.querySelectorAll("[data-status-view]")) {
  link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState(null, "", link.href);
    setView();
  });
}
$("statusRefresh").addEventListener("click", () => void load(view));
$("statusHost").textContent = location.hostname;
window.addEventListener("popstate", setView);
document.addEventListener("mirokit:languagechange", () => { renderServer(); if (visits || errors.visitors) renderVisits(); notice(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) void load(view); });
setInterval(() => { if (!document.hidden && view === "server") void load("server"); }, 60000);
renderServer();
setView();
