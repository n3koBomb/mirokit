import { NEWS_COPY, newsMedia, newsSummary, newsText } from "/source/scripts/news-presentation.js";

// Uses already delivered article data. External destinations are never fetched or framed.
export function installArticleInteractions(root, items, lang) {
  const copy = NEWS_COPY[lang], events = new AbortController(), { signal } = events;
  const preview = document.createElement("aside");
  preview.className = "nw-link-preview";
  preview.id = "newsLinkPreview";
  preview.setAttribute("role", "dialog");
  preview.setAttribute("aria-label", copy.preview);
  preview.hidden = true;
  document.body.append(preview);
  let active = null, dismissed = null, showTimer, hideTimer, dialog;
  const eligible = (target) => target instanceof Element ? target.closest(".nw-reading p a, .nw-reading li a, .nw-reading figcaption a, .nw-lead a") : null;
  function hide() {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    active?.removeAttribute("aria-controls");
    active?.removeAttribute("aria-expanded");
    active = null;
    preview.hidden = true;
  }
  function dismiss(returnFocus = false) {
    const link = active;
    dismissed = link;
    hide();
    if (returnFocus) link?.focus({ preventScroll: true });
  }
  function position() {
    if (!active || preview.hidden) return;
    const rect = active.getBoundingClientRect(), box = preview.getBoundingClientRect();
    const top = rect.bottom + 8;
    preview.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
    preview.style.top = `${Math.max(12, top + box.height <= innerHeight - 12 ? top : rect.top - box.height - 8)}px`;
  }
  function show(link) {
    if (!link?.isConnected || dismissed === link) return;
    hide();
    const url = new URL(link.href);
    if (!["https:", "http:"].includes(url.protocol)) return;
    const slug = url.origin === location.origin && url.pathname.match(/^\/news\/([a-z0-9-]+)\/$/)?.[1];
    const item = slug && items.find((entry) => entry?.id === slug);
    const title = item ? newsText(item, "title", lang) : link.textContent.trim();
    const header = document.createElement("header"), label = document.createElement("span"), close = document.createElement("button");
    label.textContent = copy.preview;
    close.type = "button"; close.className = "nw-preview-close"; close.textContent = "×"; close.setAttribute("aria-label", copy.close);
    close.addEventListener("click", () => dismiss(true), { signal });
    header.append(label, close);
    const heading = document.createElement("strong");
    heading.className = "nw-preview-title"; heading.textContent = title;
    const target = document.createElement("span");
    target.className = "nw-preview-target"; target.textContent = url.host + (url.pathname === "/" ? "" : url.pathname);
    const open = document.createElement("a");
    open.className = "nw-preview-open"; open.href = link.href; open.textContent = copy.openLink;
    if (link.target) { open.target = link.target; open.rel = "noopener noreferrer"; }
    preview.replaceChildren(header, heading, target);
    if (item) {
      const imageUrl = newsMedia(item.image);
      if (imageUrl) {
        const image = document.createElement("img");
        image.className = "nw-preview-image"; image.src = imageUrl; image.alt = newsText(item, "alt", lang);
        image.addEventListener("load", position, { once: true });
        image.addEventListener("error", () => { image.remove(); position(); }, { once: true });
        preview.append(image);
      }
      const text = document.createElement("p");
      text.textContent = newsSummary(item, lang).teaser;
      preview.append(text);
    }
    preview.append(open);
    active = link;
    link.setAttribute("aria-controls", preview.id); link.setAttribute("aria-expanded", "true");
    preview.hidden = false;
    position();
  }
  function scheduleHide() {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!preview.matches(":hover") && !preview.contains(document.activeElement) && document.activeElement !== active) hide();
    }, 220);
  }
  root.addEventListener("pointerover", (event) => {
    if (event.pointerType === "touch") return;
    const link = eligible(event.target);
    if (!link || link.contains(event.relatedTarget)) return;
    dismissed = null;
    clearTimeout(showTimer); clearTimeout(hideTimer);
    showTimer = setTimeout(() => show(link), 350);
  }, { signal });
  root.addEventListener("pointerout", (event) => {
    const link = eligible(event.target);
    if (link && !link.contains(event.relatedTarget)) { dismissed = null; scheduleHide(); }
  }, { signal });
  root.addEventListener("focusin", (event) => { const link = eligible(event.target); if (link && link !== active) show(link); }, { signal });
  root.addEventListener("focusout", (event) => {
    if (event.target === dismissed) dismissed = null;
    scheduleHide();
  }, { signal });
  preview.addEventListener("pointerenter", () => { clearTimeout(hideTimer); }, { signal });
  preview.addEventListener("pointerleave", scheduleHide, { signal });
  preview.addEventListener("focusout", scheduleHide, { signal });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !preview.hidden) {
      event.preventDefault(); event.stopPropagation();
      dismiss(preview.contains(document.activeElement));
    }
    if (event.key !== "Tab" || preview.hidden) return;
    const controls = [...preview.querySelectorAll("button, a")];
    if (!event.shiftKey && document.activeElement === active) {
      event.preventDefault(); controls[0].focus();
    } else if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault(); dismiss(true);
    } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
      const links = [...root.querySelectorAll("a, button:not([disabled]), summary")];
      const next = links.slice(links.indexOf(active) + 1).find((element) => element.getClientRects().length);
      if (next) { event.preventDefault(); hide(); next.focus(); }
    }
  }, { signal, capture: true });
  document.addEventListener("pointerdown", (event) => {
    if (!preview.contains(event.target) && !active?.contains(event.target)) hide();
  }, { signal });
  window.addEventListener("scroll", () => {
    if (!active) return;
    const rect = active.getBoundingClientRect();
    if ((rect.bottom < 0 || rect.top > innerHeight) && document.activeElement !== active && !preview.contains(document.activeElement)) hide();
    else position();
  }, { passive: true, signal });
  window.addEventListener("resize", position, { signal });
  root.addEventListener("click", (event) => {
    const link = event.target instanceof Element ? event.target.closest(".nw-image-open") : null;
    if (!link || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const source = link.querySelector("img:not([hidden])");
    if (!source) return;
    event.preventDefault(); hide();
    dialog?.remove();
    dialog = document.createElement("dialog"); dialog.className = "nw-image-dialog";
    dialog.setAttribute("aria-label", source.alt || copy.enlargeImage);
    const close = document.createElement("button"), image = document.createElement("img");
    close.type = "button"; close.textContent = `${copy.close} ×`;
    close.addEventListener("click", () => dialog.close(), { signal });
    image.src = link.href; image.alt = source.alt;
    dialog.append(close, image);
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    }, { signal });
    dialog.addEventListener("close", () => link.focus({ preventScroll: true }), { signal });
    document.body.append(dialog); dialog.showModal();
  }, { signal });
  return () => { hide(); events.abort(); preview.remove(); dialog?.close(); dialog?.remove(); };
}
