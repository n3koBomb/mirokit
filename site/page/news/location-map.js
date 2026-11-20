import { NEWS_COPY } from "../../source/scripts/news-presentation.js";

// Address lookup and map requests happen only after the visitor presses Show map.
const roots = new WeakSet();
const coordinatesCache = new Map();

export function locationMapUrls(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error("Invalid coordinates");
  const [lon, lat] = coordinates;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error("Invalid coordinates");
  const embed = new URL("https://www.openstreetmap.org/export/embed.html");
  embed.searchParams.set("bbox", [Math.max(-180, lon - .012), Math.max(-90, lat - .008), Math.min(180, lon + .012), Math.min(90, lat + .008)].join(","));
  embed.searchParams.set("layer", "mapnik");
  embed.searchParams.set("marker", `${lat},${lon}`);
  return { embed: embed.href, full: `https://www.openstreetmap.org/#map=16/${lat}/${lon}` };
}

async function locate(address, lang) {
  const key = `${lang}:${address}`;
  if (coordinatesCache.has(key)) return coordinatesCache.get(key);
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", address);
  url.searchParams.set("limit", "1");
  url.searchParams.set("lang", lang);
  const response = await fetch(url, { credentials: "omit", signal: AbortSignal.timeout(10000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Location lookup failed");
  const result = await response.json();
  const coordinates = result.features?.[0]?.geometry?.coordinates;
  const urls = locationMapUrls(coordinates);
  if (coordinatesCache.size >= 30) coordinatesCache.delete(coordinatesCache.keys().next().value);
  coordinatesCache.set(key, urls);
  return urls;
}

export function installNewsLocationMaps(root) {
  root.querySelectorAll(".nw-map-load").forEach((button) => { button.hidden = false; });
  root.querySelectorAll("[data-news-map-open]").forEach((link) => { link.setAttribute("aria-controls", "newsLocationMap"); link.setAttribute("aria-expanded", "false"); });
  if (roots.has(root)) return;
  roots.add(root);
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !(event.target instanceof Element)) return;
    const card = event.target.closest("[data-news-map-address]");
    if (card && !card.querySelector(".nw-map-stage").hidden) {
      event.preventDefault(); event.stopPropagation();
      card.querySelector(".nw-map-close").click();
    }
  });
  root.addEventListener("click", async (event) => {
    const place = event.target instanceof Element ? event.target.closest("[data-news-map-open]") : null;
    if (place && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      const card = place.closest(".nw-event-facts").querySelector("[data-news-map-address]");
      if (card.querySelector(".nw-map-stage").hidden) card.querySelector(".nw-map-load").click();
      else card.querySelector(".nw-map-close").focus();
      return;
    }
    const close = event.target instanceof Element ? event.target.closest(".nw-map-close") : null;
    if (close) {
      const card = close.closest("[data-news-map-address]");
      card.querySelector(".nw-map-stage").hidden = true;
      card.querySelector(".nw-map-frame").replaceChildren();
      const button = card.querySelector(".nw-map-load");
      button.hidden = false;
      button.removeAttribute("aria-disabled");
      button.setAttribute("aria-expanded", "false");
      card.closest(".nw-event-facts").querySelector("[data-news-map-open]").setAttribute("aria-expanded", "false");
      button.focus();
      return;
    }
    const button = event.target instanceof Element ? event.target.closest(".nw-map-load") : null;
    if (!button || button.getAttribute("aria-disabled") === "true") return;
    const card = button.closest("[data-news-map-address]");
    if (!card || !root.contains(card)) return;
    const { newsMapAddress: address, newsMapLang: lang } = card.dataset;
    const copy = NEWS_COPY[lang] || NEWS_COPY.en;
    const status = card.querySelector(".nw-map-status");
    const stage = card.querySelector(".nw-map-stage");
    const placeLink = card.closest(".nw-event-facts").querySelector("[data-news-map-open]");
    button.setAttribute("aria-disabled", "true");
    status.hidden = false;
    status.textContent = copy.mapLoading;
    try {
      const urls = await locate(address, lang);
      if (!card.isConnected) return;
      const iframe = document.createElement("iframe");
      iframe.title = copy.mapTitle.replace("{place}", address);
      iframe.referrerPolicy = "no-referrer";
      iframe.loading = "lazy";
      iframe.src = urls.embed;
      iframe.addEventListener("error", () => {
        stage.hidden = true;
        status.textContent = copy.mapError;
        status.hidden = false;
        button.hidden = false;
        button.removeAttribute("aria-disabled");
        button.setAttribute("aria-expanded", "false");
        placeLink.setAttribute("aria-expanded", "false");
      }, { once: true });
      stage.querySelector(".nw-map-frame").replaceChildren(iframe);
      stage.hidden = false;
      button.setAttribute("aria-expanded", "true");
      placeLink.setAttribute("aria-expanded", "true");
      if ([button, placeLink].includes(document.activeElement)) stage.querySelector(".nw-map-close").focus();
      button.hidden = true;
      status.hidden = true;
      card.querySelector(".nw-map-link").href = urls.full;
    } catch {
      if (!card.isConnected) return;
      status.textContent = copy.mapError;
      button.removeAttribute("aria-disabled");
    }
  });
}
