/**
 * MIRoKIT world map
 * Real Natural Earth country geometry rendered on Canvas with D3 Geo.
 * Replace your previous initWorldCanvas() implementation with this file.
 */
async function initWorldCanvas() {
  const canvas = document.getElementById("worldCanvas");
  const shell = canvas?.closest(".world-map-shell");
  const fallback = shell?.querySelector(".world-map-fallback");

  if (!canvas || !shell || canvas.dataset.worldMapInitialized === "true") return;
  canvas.dataset.worldMapInitialized = "true";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (fallback) fallback.hidden = true;

  const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

  // One data source drives the map, country cards, city statuses and labels.
  // Add a point here and the country feed updates automatically.
  const points = [
    { label: "Düsseldorf", cityKey: "world_city_dusseldorf", country: "Germany", countryKey: "world_country_germany", flag: "🇩🇪", 
      // flagColors: ["#111111", "#d21f2b", "#f4c430"], 
      lon: 6.77, lat: 51.23, hq: true, status: "hq", hqLabelKey: "world_status_hq" },
    { label: "Moscow", cityKey: "world_city_moscow", country: "Russia", countryKey: "world_country_russia", flag: "🇷🇺", lon: 37.62, lat: 55.75, status: "done" },
    { label: "Saint Petersburg", cityKey: "world_city_saint_petersburg", country: "Russia", countryKey: "world_country_russia", flag: "🇷🇺", lon: 30.31, lat: 59.94, status: "done" },
    { label: "Tunis", cityKey: "world_city_tunis", country: "Tunisia", countryKey: "world_country_tunisia", flag: "🇹🇳", lon: 10.18, lat: 36.8, status: "done" },
    { label: "Berlin", cityKey: "world_city_berlin", country: "Germany", countryKey: "world_country_germany", flag: "🇩🇪", lon: 13.4, lat: 52.52, status: "planned" },
    { label: "Warsaw", cityKey: "world_city_warsaw", country: "Poland", countryKey: "world_country_poland", flag: "🇵🇱", lon: 21.01, lat: 52.23, status: "planned" },
    { label: "Prague", cityKey: "world_city_prague", country: "Czechia", countryKey: "world_country_czechia", flag: "🇨🇿", lon: 14.44, lat: 50.08, status: "planned" },
    { label: "Almaty", cityKey: "world_city_almaty", country: "Kazakhstan", countryKey: "world_country_kazakhstan", flag: "🇰🇿", lon: 76.95, lat: 43.24, status: "planned" },
    { label: "Istanbul", cityKey: "world_city_istanbul", country: "Türkiye", countryKey: "world_country_turkiye", flag: "🇹🇷", lon: 28.98, lat: 41.01, status: "planned" },
    { label: "Paris", cityKey: "world_city_paris", country: "France", countryKey: "world_country_france", flag: "🇫🇷", lon: 2.35, lat: 48.86, status: "planned" },
    { label: "Madrid", cityKey: "world_city_madrid", country: "Spain", countryKey: "world_country_spain", flag: "🇪🇸", lon: -3.70, lat: 40.42, status: "planned" },
    { label: "Helsinki", cityKey: "world_city_helsinki", country: "Finland", countryKey: "world_country_finland", flag: "🇫🇮", lon: 24.94, lat: 60.17, status: "planned" },
    { label: "Tokyo", cityKey: "world_city_tokyo", country: "Japan", countryKey: "world_country_japan", flag: "🇯🇵", lon: 139.69, lat: 35.69, status: "planned" },
    { label: "Bishkek", cityKey: "world_city_bishkek", country: "Kyrgyzstan", countryKey: "world_country_kyrgyzstan", flag: "🇰🇬", lon: 74.57, lat: 42.87, status: "planned" },
    { label: "Minsk", cityKey: "world_city_minsk", country: "Belarus", countryKey: "world_country_belarus", flag: "🇧🇾", lon: 27.56, lat: 53.90, status: "planned" },
    { label: "Tashkent", cityKey: "world_city_tashkent", country: "Uzbekistan", countryKey: "world_country_uzbekistan", flag: "🇺🇿", lon: 69.24, lat: 41.30, status: "planned" },
    { label: "Ashgabat", cityKey: "world_city_ashgabat", country: "Turkmenistan", countryKey: "world_country_turkmenistan", flag: "🇹🇲", lon: 58.38, lat: 37.96, status: "planned" },
  ];

  const countryFeed = document.getElementById("worldCountryFeed");
  const countryCount = document.getElementById("worldCountryCount");

  function getDictionary() {
    return T[currentLang] || T.ru;
  }

  function translate(key, fallback) {
    return getDictionary()[key] || fallback;
  }

  function createTextElement(tagName, className, value) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = value;
    return element;
  }

  function getPointCity(point) {
    return translate(point.cityKey, point.label);
  }

  function getPointCountry(point) {
    return translate(point.countryKey, point.country);
  }

  function getStatusLabel(status) {
    if (status === "hq") return translate("world_status_hq", "Headquarters");
    if (status === "planned") return translate("world_status_planned", "Planned");
    return translate("world_status_done", "Event held");
  }

  function renderCountryFeed() {
    if (!countryFeed) return;

    const countries = [...points.reduce((groups, point) => {
      const key = point.countryKey || point.country;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(point);
      return groups;
    }, new Map()).entries()];

    countries.sort(([, firstPoints], [, secondPoints]) => {
      const firstPriority = firstPoints.some((point) => point.hq) ? 0 : firstPoints.some((point) => point.status === "done") ? 1 : 2;
      const secondPriority = secondPoints.some((point) => point.hq) ? 0 : secondPoints.some((point) => point.status === "done") ? 1 : 2;
      return firstPriority - secondPriority || getPointCountry(firstPoints[0]).localeCompare(getPointCountry(secondPoints[0]));
    });

    countryFeed.replaceChildren(...countries.map(([, countryPoints]) => {
      const card = document.createElement("article");
      card.className = "world-country-card";

      card.append(createTextElement("span", "world-country-flag", countryPoints[0].flag));

      const main = document.createElement("div");
      main.className = "world-country-main";

      const topLine = document.createElement("div");
      topLine.className = "world-country-topline";
      topLine.append(createTextElement("strong", "world-country-name", getPointCountry(countryPoints[0])));

      const countryStatus = countryPoints.some((point) => point.hq)
        ? "hq"
        : countryPoints.some((point) => point.status === "planned") && !countryPoints.some((point) => point.status === "done")
          ? "planned"
          : "done";
      const statusElement = createTextElement("span", `world-country-status is-${countryStatus}`, getStatusLabel(countryStatus));
      topLine.append(statusElement);
      main.append(topLine);

      const cityList = document.createElement("ul");
      cityList.className = "world-city-list";
      countryPoints.forEach((point) => {
        const row = document.createElement("li");
        row.className = "world-city-row";
        row.append(createTextElement("span", "world-city-name", getPointCity(point)));
        row.append(createTextElement("span", `world-city-status${point.status === "planned" ? " is-planned" : ""}`, getStatusLabel(point.status)));
        cityList.append(row);
      });
      main.append(cityList);

      const doneCount = countryPoints.filter((point) => point.status === "done").length;
      const plannedCount = countryPoints.filter((point) => point.status === "planned").length;
      const summary = [
        `${countryPoints.length} ${translate("world_cities_label", "cities")}`,
        doneCount ? `${doneCount} ${translate("world_done_short", "held")}` : "",
        plannedCount ? `${plannedCount} ${translate("world_planned_short", "planned")}` : "",
      ].filter(Boolean).join(" · ");
      main.append(createTextElement("small", "world-country-meta", summary));

      card.append(main);
      return card;
    }));

    if (countryCount) countryCount.textContent = String(countries.length).padStart(2, "0");
  }

  renderCountryFeed();
  document.addEventListener("mirokit:languagechange", renderCountryFeed);

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let resizeFrame = 0;
  let animationFrame = 0;
  let startedAt = performance.now();
  let currentWidth = 0;
  let currentHeight = 0;
  let currentRatio = 0;
  let hoveredPoint = null;
  let projectedPoints = [];
  let lastFrameAt = performance.now();

  const labelProgress = new Map(points.map((point) => [point, 0]));
  const LABEL_HIT_RADIUS = 15;
  const MAX_ZOOM = 1.8;
  const ZOOM_IN_RESPONSE = 250;
  const ZOOM_OUT_DURATION = 1000;

  let pointerInside = false;
  let zoomScale = 1;
  let zoomFocus = { x: 0, y: 0 };
  let zoomFocusInitialized = false;
  let zoomOutStartedAt = 0;
  let zoomOutStartScale = 1;

  try {
    const [d3Geo, topojson, world] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/d3-geo@3.1.1/+esm"),
      import("https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm"),
      fetch(WORLD_URL, { cache: "force-cache" }).then((response) => {
        if (!response.ok) {
          throw new Error(`World map request failed: ${response.status}`);
        }
        return response.json();
      }),
    ]);

    const land = topojson.feature(world, world.objects.land);
    const countries = topojson.feature(world, world.objects.countries);
    const countryBorders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
    const graticule = d3Geo.geoGraticule10();
    const sphere = { type: "Sphere" };

    // Germany, numeric ISO 3166-1 code 276, receives a subtle HQ highlight.
    const hqCountry = countries.features.find((feature) => String(feature.id) === "276");

    function roundedRect(x, y, width, height, radius) {
      const r = Math.min(radius, width / 2, height / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + width - r, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + r);
      ctx.lineTo(x + width, y + height - r);
      ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
      ctx.lineTo(x + r, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawRoundedLabel(text, centerX, dotTopY, logicalWidth, options = {}) {
      const compact = Boolean(options.compact);
      const progress = Math.min(1, Math.max(0, options.progress ?? 1));
      const paddingX = compact ? 8 : 10;
      const labelHeight = compact ? 21 : 24;
      const fontSize = compact ? 10 : 11;

      if (progress <= 0.001) return;

      ctx.save();
      ctx.font = `800 ${fontSize}px Montserrat, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const labelWidth = Math.ceil(ctx.measureText(text).width + paddingX * 2);
      const centeredX = centerX - labelWidth / 2;
      const safeX = Math.min(Math.max(centeredX, 8), Math.max(8, logicalWidth - labelWidth - 8));
      const safeY = Math.max(dotTopY - labelHeight - (compact ? 10 : 12), 8);

      // Subtle "from the void" effect: opacity + a tiny lift and scale.
      const eased = 1 - Math.pow(1 - progress, 3);
      const scale = 0.94 + eased * 0.06;
      const lift = (1 - eased) * 5;
      const boxCenterX = safeX + labelWidth / 2;
      const boxCenterY = safeY + labelHeight / 2 + lift;

      ctx.globalAlpha = eased;
      ctx.translate(boxCenterX, boxCenterY);
      ctx.scale(scale, scale);

      ctx.shadowColor = "rgba(1, 51, 123, 0.12)";
      ctx.shadowBlur = 13;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.strokeStyle = "rgba(1, 51, 123, 0.17)";
      ctx.lineWidth = 1;
      roundedRect(-labelWidth / 2, -labelHeight / 2, labelWidth, labelHeight, labelHeight / 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.stroke();

      ctx.fillStyle = "#01337b";
      ctx.fillText(text, 0, 0.5);
      ctx.restore();
    }

    function getHoverLabel(point) {
      const city = getPointCity(point);
      const country = getPointCountry(point);
      return point.hq ? `${city} · ${translate(point.hqLabelKey, getStatusLabel("hq"))}` : `${city} · ${country}`;
    }

    function smoothStep(value) {
      const t = Math.min(1, Math.max(0, value));
      return t * t * (3 - 2 * t);
    }

    function updateZoom(timestamp, frameDelta, width, height) {
      if (!zoomFocusInitialized) {
        zoomFocus = { x: width / 2, y: height / 2 };
        zoomFocusInitialized = true;
      }

      zoomFocus.x = Math.min(width, Math.max(0, zoomFocus.x));
      zoomFocus.y = Math.min(height, Math.max(0, zoomFocus.y));

      if (reducedMotionQuery.matches) {
        zoomScale = pointerInside ? MAX_ZOOM : 1;
        return;
      }

      if (pointerInside) {
        const response = 1 - Math.exp(-frameDelta / ZOOM_IN_RESPONSE);
        zoomScale += (MAX_ZOOM - zoomScale) * response;

        if (Math.abs(MAX_ZOOM - zoomScale) < 0.0005) {
          zoomScale = MAX_ZOOM;
        }
        return;
      }

      if (zoomScale <= 1.0001) {
        zoomScale = 1;
        return;
      }

      const progress = Math.min(1, Math.max(0, (timestamp - zoomOutStartedAt) / ZOOM_OUT_DURATION));
      const eased = smoothStep(progress);
      zoomScale = 1 + (zoomOutStartScale - 1) * (1 - eased);

      if (progress >= 1) {
        zoomScale = 1;
      }
    }

    function toZoomedPosition(position) {
      return [zoomFocus.x + (position[0] - zoomFocus.x) * zoomScale, zoomFocus.y + (position[1] - zoomFocus.y) * zoomScale];
    }

    function makeGreatCircleRoute(from, to, steps = 48) {
      const interpolate = d3Geo.geoInterpolate([from.lon, from.lat], [to.lon, to.lat]);

      return {
        type: "LineString",
        coordinates: Array.from({ length: steps + 1 }, (_, index) => interpolate(index / steps)),
      };
    }

    function drawHeadquartersFlag(position, point, compact) {
      const poleX = position[0] - 19;
      const poleTop = position[1] - 20;
      const flagWidth = compact ? 12 : 16;
      const flagHeight = compact ? 9 : 12;

      ctx.save();
      ctx.strokeStyle = "#01337b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(poleX + 19, poleTop - 1);
      ctx.lineTo(poleX + 19, poleTop + 20);
      ctx.stroke();

      ctx.shadowColor = "rgba(1, 51, 123, 0.20)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      point.flagColors.forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(poleX + 2, poleTop + index * (flagHeight / 3), flagWidth, flagHeight / 3 + 0.5);
      });
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "rgba(1, 51, 123, 0.18)";
      ctx.lineWidth = 1;
      ctx.strokeRect(poleX + 2, poleTop, flagWidth, flagHeight);
      ctx.restore();
    }

    function drawMap(timestamp = performance.now()) {
      if (!canvas.isConnected) return;

      const rect = shell.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(320, Math.round(rect.width));
      const height = Math.max(260, Math.round(rect.height));
      const compact = width < 620;
      const padding = compact ? 12 : 18;
      const frameDelta = Math.min(64, Math.max(0, timestamp - lastFrameAt));
      lastFrameAt = timestamp;
      const pulse = reducedMotionQuery.matches ? 0.35 : (Math.sin((timestamp - startedAt) / 650) + 1) / 2;

      updateZoom(timestamp, frameDelta, width, height);

      if (currentWidth !== width || currentHeight !== height || currentRatio !== ratio) {
        currentWidth = width;
        currentHeight = height;
        currentRatio = ratio;
        canvas.width = Math.round(width * ratio);
        canvas.height = Math.round(height * ratio);
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      const projection = d3Geo.geoNaturalEarth1().fitExtent(
        [
          [padding, padding],
          [width - padding, height - padding],
        ],
        sphere,
      );
      const path = d3Geo.geoPath(projection, ctx);

      const background = ctx.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "rgba(255, 255, 255, 0.58)");
      background.addColorStop(0.55, "rgba(21, 101, 255, 0.09)");
      background.addColorStop(1, "rgba(232, 23, 43, 0.07)");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      // Zoom all geographical content around the current mouse position.
      // Labels are drawn after restore(), so their text remains crisp and
      // does not become 10% larger.
      ctx.save();
      ctx.translate(zoomFocus.x, zoomFocus.y);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-zoomFocus.x, -zoomFocus.y);

      // Ocean / map silhouette.
      ctx.beginPath();
      path(sphere);
      ctx.fillStyle = "rgba(236, 245, 255, 0.90)";
      ctx.fill();
      ctx.strokeStyle = "rgba(1, 51, 123, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Latitude and longitude grid.
      ctx.beginPath();
      path(graticule);
      ctx.strokeStyle = "rgba(1, 51, 123, 0.075)";
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Real Natural Earth land geometry.
      ctx.beginPath();
      path(land);
      ctx.fillStyle = "rgba(1, 51, 123, 0.13)";
      ctx.fill();
      ctx.strokeStyle = "rgba(1, 51, 123, 0.24)";
      ctx.lineWidth = compact ? 0.7 : 0.9;
      ctx.stroke();

      // Subtle HQ-country highlight.
      if (hqCountry) {
        ctx.beginPath();
        path(hqCountry);
        ctx.fillStyle = "rgba(255, 206, 0, 0.38)";
        ctx.fill();
        ctx.strokeStyle = "rgba(1, 51, 123, 0.40)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Country borders.
      ctx.beginPath();
      path(countryBorders);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
      ctx.lineWidth = compact ? 0.45 : 0.65;
      ctx.stroke();

      const hq = points.find((point) => point.hq);
      if (!hq) return;

      // Great-circle routes from headquarters.
      points
        .filter((point) => !point.hq)
        .forEach((point) => {
          const route = makeGreatCircleRoute(hq, point);
          const planned = point.status === "planned";

          ctx.save();
          ctx.beginPath();
          path(route);
          ctx.strokeStyle = planned ? "rgba(232, 23, 43, 0.46)" : "rgba(21, 101, 255, 0.40)";
          ctx.lineWidth = planned ? 1.35 : 1.8;
          ctx.setLineDash(planned ? [5, 6] : []);
          ctx.shadowColor = planned ? "rgba(232, 23, 43, 0.12)" : "rgba(21, 101, 255, 0.15)";
          ctx.shadowBlur = 5;
          ctx.stroke();
          ctx.restore();
        });

      projectedPoints = [];

      points.forEach((point) => {
        const position = projection([point.lon, point.lat]);
        if (!position) return;

        const planned = point.status === "planned";
        const color = planned ? "#e8172b" : "#1565ff";
        const mainColor = "#e8af00";
        const halo = planned ? "rgba(232, 23, 43, 0.18)" : "rgba(21, 101, 255, 0.18)";
        const radius = point.hq ? 7 : compact ? 4.4 : 5.3;

        const zoomedPosition = toZoomedPosition(position);
        projectedPoints.push({
          point,
          position: zoomedPosition,
          radius: radius * zoomScale,
        });

        ctx.beginPath();
        ctx.arc(position[0], position[1], radius + 7 + pulse * 4, 0, Math.PI * 2);
        ctx.fillStyle = halo;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(position[0], position[1], radius, 0, Math.PI * 2);
        ctx.fillStyle = point.hq ? mainColor : color;
        ctx.fill();
        ctx.lineWidth = point.hq ? 3 : 2.4;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();

        if (point?.hq && point.flagColors) { drawHeadquartersFlag(position, point, compact); } else return;
      });

      ctx.restore();

      let labelsAnimating = false;

      points.forEach((point) => {
        const target = point === hoveredPoint ? 1 : 0;
        const current = labelProgress.get(point) ?? 0;
        let next = target;

        if (!reducedMotionQuery.matches) {
          const response = 1 - Math.exp(-frameDelta / 72);
          next = current + (target - current) * response;

          if (Math.abs(target - next) < 0.01) {
            next = target;
          } else {
            labelsAnimating = true;
          }
        }

        labelProgress.set(point, next);

        if (next <= 0.001) return;

        const projected = projectedPoints.find((entry) => entry.point === point);
        if (!projected) return;

        drawRoundedLabel(getHoverLabel(point), projected.position[0], projected.position[1] - projected.radius, width, { compact, progress: next });
      });

      if (!reducedMotionQuery.matches || labelsAnimating) {
        animationFrame = requestAnimationFrame(drawMap);
      }
    }

    function getPointerPosition(event) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;

      return {
        x: (event.clientX - rect.left) * (currentWidth / rect.width),
        y: (event.clientY - rect.top) * (currentHeight / rect.height),
      };
    }

    function findPointAt(x, y) {
      let match = null;
      let closestDistance = Infinity;

      projectedPoints.forEach((entry) => {
        const dx = x - entry.position[0];
        const dy = y - entry.position[1];
        const distance = Math.hypot(dx, dy);
        const hitRadius = Math.max(LABEL_HIT_RADIUS, entry.radius + (entry.point.hq ? 11 : 9));

        if (distance <= hitRadius && distance < closestDistance) {
          match = entry.point;
          closestDistance = distance;
        }
      });

      return match;
    }

    function setHoveredPoint(point) {
      if (hoveredPoint === point) return;

      hoveredPoint = point;
      canvas.style.cursor = point ? "pointer" : "default";

      // Reduced-motion mode has no permanent animation loop, so redraw manually.
      if (reducedMotionQuery.matches) {
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(drawMap);
      }
    }

    function requestInteractiveRedraw() {
      if (!reducedMotionQuery.matches) return;
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(drawMap);
    }

    function handlePointerMove(event) {
      const pointer = getPointerPosition(event);
      if (!pointer) return;

      pointerInside = true;
      zoomFocus = { x: pointer.x, y: pointer.y };
      setHoveredPoint(findPointAt(pointer.x, pointer.y));
      requestInteractiveRedraw();
    }

    function handlePointerLeave() {
      pointerInside = false;
      zoomOutStartedAt = performance.now();
      zoomOutStartScale = zoomScale;
      setHoveredPoint(null);
      requestInteractiveRedraw();
    }

    canvas.addEventListener("pointermove", handlePointerMove, { passive: true });
    canvas.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    canvas.addEventListener("pointercancel", handlePointerLeave, { passive: true });

    function scheduleResize() {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        startedAt = performance.now();
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(drawMap);
      });
    }

    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(scheduleResize) : null;

    if (resizeObserver) {
      resizeObserver.observe(shell);
    } else {
      window.addEventListener("resize", scheduleResize, { passive: true });
    }

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", scheduleResize);
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(scheduleResize);
    }

    animationFrame = requestAnimationFrame(drawMap);
  } catch (error) {
    console.error("MIRoKIT world map could not be initialized:", error);

    if (fallback) fallback.hidden = false;

    const rect = shell.getBoundingClientRect();
    const width = Math.max(320, Math.round(rect.width));
    const height = Math.max(260, Math.round(rect.height));
    const ratio = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#01337b";
    ctx.font = "800 14px Montserrat, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Карта временно недоступна", width / 2, height / 2);
  }
}

initWorldCanvas();
