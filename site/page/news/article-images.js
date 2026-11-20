// Display-only bounds: original files and full-resolution image links stay intact.
const prepared = new WeakSet();

export function transparentImageBounds(pixels, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] <= 12) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) return null;
  // Two sampled pixels protect antialiasing and fine strokes at the edges.
  left = Math.max(0, left - 2); top = Math.max(0, top - 2);
  right = Math.min(width, right + 3); bottom = Math.min(height, bottom + 3);
  if (left < width * .04 && top < height * .04 && right > width * .96 && bottom > height * .96) return null;
  return { left, top, width: right - left, height: bottom - top };
}

function prepareImage(image) {
  if (!image.naturalWidth || image.hidden) return;
  const media = image.closest(".nw-media"), link = image.closest(".nw-image-open");
  if (!media?.classList.contains("nw-image--graphic") || !link) return;
  // No additional fetch or cross-origin mode: inaccessible pixels keep the normal layout.
  try {
    const factor = Math.min(1, 256 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * factor));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const bounds = transparentImageBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    if (!bounds) return;
    media.classList.add("nw-image-trimmed");
    const visibleWidth = image.naturalWidth * bounds.width / canvas.width;
    link.style.width = `min(100%, ${visibleWidth}px)`;
    media.style.aspectRatio = `${bounds.width} / ${bounds.height}`;
    media.style.setProperty("--news-crop-width", `${100 * canvas.width / bounds.width}%`);
    media.style.setProperty("--news-crop-left", `${-100 * bounds.left / bounds.width}%`);
    media.style.setProperty("--news-crop-top", `${-100 * bounds.top / bounds.height}%`);
  } catch {
    // Cross-origin images remain complete, with the usual size rules and enlargement.
  }
}

export function installArticleImages(root) {
  root.querySelectorAll(".nw-article-image img, .nw-reading .nw-body-image img").forEach((image) => {
    if (prepared.has(image)) return;
    prepared.add(image);
    image.addEventListener("load", () => prepareImage(image), { once: true });
    if (image.complete) prepareImage(image);
  });
}
