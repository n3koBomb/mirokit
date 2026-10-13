const $ = (id) => document.getElementById(id);
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
let token = "";
let cursor = null;
let busy = false;
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
    $("adminStatusRefresh").disabled = false;
    $("adminStatusMore").disabled = false;
  }
}
$("statusLogin").addEventListener("submit", (event) => {
  event.preventDefault();
  token = $("statusToken").value.trim();
  try { sessionStorage.setItem("mirokitAdminToken", token); } catch { /* In-memory token only. */ }
  $("statusToken").value = "";
  void load();
});
$("adminStatusRefresh").addEventListener("click", () => void load());
$("adminStatusMore").addEventListener("click", () => void load(true));
if (!local || token) void load();
else $("adminStatusNotice").textContent = "Zum Laden das lokale Admin-Token eingeben.";
