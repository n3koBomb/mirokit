const $ = (id) => document.getElementById(id);
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
let token = "";
let cursor = null;
let busy = false;
let diagnosticBusy = false;
try { token = sessionStorage.getItem("mirokitAdminToken") || ""; } catch { /* In-memory login still works. */ }
$("statusLogin").hidden = !local;
try { document.body.classList.toggle("theme-dark", localStorage.getItem("mirokitTheme") === "dark"); } catch { /* Default theme. */ }

function appendVisit(visit) {
  const row = document.createElement("tr");
  const devices = { mobile: "Smartphone", desktop: "Computer", tablet: "Tablet", unknown: "Unbekannt" };
  let country = "Unbekannt";
  if (visit.country !== "unknown") {
    try { country = new Intl.DisplayNames(["de"], { type: "region" }).of(visit.country); } catch { country = visit.country; }
  }
  for (const value of [new Date(visit.visitedAt).toLocaleString("de"), visit.path, country, devices[visit.device] || "Unbekannt", visit.browser === "unknown" ? "Unbekannt" : visit.browser]) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.append(cell);
  }
  $("adminStatusRows").append(row);
}

async function load(more = false) {
  if (busy) return;
  busy = true;
  $("adminStatusRefresh").disabled = true;
  $("adminStatusMore").disabled = true;
  $("adminStatusNotice").textContent = "Aufrufdetails werden geladen…";
  if (!more) { $("adminStatusRows").replaceChildren(); cursor = null; $("adminStatusMore").hidden = true; }
  try {
    const query = more && cursor ? `?before=${encodeURIComponent(cursor)}` : "";
    const response = await fetch(`/api/v1/admin/status/visits${query}`, {
      credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: local && token ? { "X-MiroKIT-Admin-Token": token } : {},
    });
    if (response.status === 401 || response.status === 403) throw new Error(local ? "Bitte ein gültiges lokales Admin-Token eingeben." : "Zugriff verweigert. Bitte über Cloudflare Access anmelden.");
    if (!response.ok) throw new Error("Die Aufrufdetails sind nicht verfügbar. Bitte Datenbankmigration und Verbindung prüfen.");
    const data = await response.json();
    data.visits.forEach(appendVisit);
    cursor = data.nextCursor;
    $("adminStatusMore").hidden = !cursor;
    $("adminStatusNotice").textContent = $("adminStatusRows").children.length ? `${$("adminStatusRows").children.length} Aufrufe geladen.` : "Noch keine Aufrufdetails vorhanden.";
  } catch (error) {
    $("adminStatusNotice").textContent = error.message;
  } finally {
    busy = false;
    $("adminStatusRefresh").disabled = diagnosticBusy;
    $("adminStatusMore").disabled = false;
  }
}

function agentName(agent) {
  return ({ browser: "Browser (DNT/GPC)", "verified-bot": "Bot ohne erkannte Familie", "other-automation": "Sonstige Automation" })[agent] || agent;
}

async function loadDiagnostics() {
  if (diagnosticBusy) return;
  diagnosticBusy = true;
  $("adminStatusRefresh").disabled = true;
  $("diagnosticNotice").textContent = "Bot- und DNT/GPC-Zähler werden geladen…";
  for (const id of ["diagnosticRequests", "diagnosticBots", "diagnosticDnt", "diagnosticGpc"]) $(id).textContent = "—";
  $("diagnosticRows").replaceChildren();
  $("diagnosticAgents").replaceChildren();
  $("diagnosticScope").textContent = "";
  try {
    const response = await fetch("/api/v1/admin/status/diagnostics", {
      credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(10000),
      headers: local && token ? { "X-MiroKIT-Admin-Token": token } : {},
    });
    if (response.status === 401 || response.status === 403) throw new Error(local ? "Bitte ein gültiges lokales Admin-Token eingeben." : "Zugriff verweigert. Bitte über Cloudflare Access anmelden.");
    if (!response.ok) throw new Error("Die Bot-/DNT-/GPC-Zähler sind nicht verfügbar. Bitte Migration 0010 und Datenbankverbindung prüfen.");
    const data = await response.json();
    if (!data.success) throw new Error("Die Bot-/DNT-/GPC-Zähler konnten nicht geladen werden.");
    const number = (value) => new Intl.NumberFormat("de").format(value);
    for (const [id, key] of [["diagnosticRequests", "requests"], ["diagnosticBots", "bots"], ["diagnosticDnt", "dnt"], ["diagnosticGpc", "gpc"]]) $(id).textContent = number(data.totals[key]);
    for (const agent of data.agents) {
      const row = document.createElement("div");
      row.className = "st-row";
      const label = document.createElement("span");
      label.textContent = `${agentName(agent.agent)} · ${agent.verifiedBot ? "Cloudflare bestätigt" : "Botstatus nicht bestätigt"} · zuletzt ${agent.lastDay} (UTC)`;
      const count = document.createElement("span");
      count.textContent = number(agent.views);
      row.append(label, count);
      $("diagnosticAgents").append(row);
    }
    if (!data.agents.length) $("diagnosticAgents").textContent = "Noch keine erkannten Bots oder automatisierten Werkzeuge erfasst.";
    for (const group of data.groups) {
      const row = document.createElement("tr");
      for (const value of [group.day, group.path, agentName(group.agent), group.isBot ? group.verifiedBot ? "Cloudflare bestätigt" : "Nicht bestätigt" : "Kein erkannter Bot", group.dnt ? "Ja" : "—", group.gpc ? "Ja" : "—", number(group.views)]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      $("diagnosticRows").append(row);
    }
    $("diagnosticScope").textContent = `${data.host} · ab ${data.since} (UTC) · ${number(data.groups.length)} von ${number(data.totals.groups)} Tagesgruppen angezeigt (höchstens 200). Botübersicht: bis zu 50 Gruppen.`;
    $("diagnosticNotice").textContent = data.totals.requests ? "Zähler aktualisiert. Frühere, nicht erfasste Aufrufe sind nicht enthalten." : "Noch keine Bot- oder DNT/GPC-Aufrufe erfasst.";
  } catch (error) {
    $("diagnosticNotice").textContent = error.message;
  } finally {
    diagnosticBusy = false;
    $("adminStatusRefresh").disabled = busy;
  }
}

function refreshAll() { void load(); void loadDiagnostics(); }
$("statusLogin").addEventListener("submit", (event) => {
  event.preventDefault();
  token = $("statusToken").value.trim();
  try { sessionStorage.setItem("mirokitAdminToken", token); } catch { /* In-memory token only. */ }
  $("statusToken").value = "";
  refreshAll();
});
$("adminStatusRefresh").addEventListener("click", refreshAll);
$("adminStatusMore").addEventListener("click", () => void load(true));
if (!local || token) refreshAll();
else $("adminStatusNotice").textContent = "Zum Laden das lokale Admin-Token eingeben.";
