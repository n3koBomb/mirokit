const DRIVE_HOSTS = new Set(["drive.google.com", "drive.usercontent.google.com", "docs.google.com"]);

function allowedDriveUrl(value) {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password && !url.port &&
			(DRIVE_HOSTS.has(url.hostname) || url.hostname.endsWith(".googleusercontent.com"));
	} catch { return false; }
}

async function fetchDriveImage(sourceUrl, maxBytes) {
	let url = sourceUrl;
	const signal = AbortSignal.timeout(15_000);
	for (let hop = 0; hop <= 5; hop++) {
		if (!allowedDriveUrl(url)) throw new Error("Google Drive redirect destination is not allowed");
		const response = await fetch(url, { headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" }, redirect: "manual", signal });
		if ([301, 302, 303, 307, 308].includes(response.status)) {
			await response.body?.cancel();
			const location = response.headers.get("Location");
			if (!location) throw new Error("Google Drive redirect has no destination");
			url = new URL(location, url).href;
			continue;
		}
		if (!response.ok) { await response.body?.cancel(); throw new Error("Google Drive image is unavailable"); }
		const contentType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
		if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(contentType)) {
			await response.body?.cancel();
			throw new Error("Google Drive URL did not return a supported image");
		}
		if (Number(response.headers.get("content-length")) > maxBytes) {
			await response.body?.cancel();
			throw new Error("Image exceeds the 8 MB limit");
		}
		if (!response.body) throw new Error("Google Drive image is empty");
		const reader = response.body.getReader();
		const chunks = [];
		let size = 0;
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				size += value.byteLength;
				if (size > maxBytes) { await reader.cancel(); throw new Error("Image exceeds the 8 MB limit"); }
				chunks.push(value);
			}
		} finally { reader.releaseLock(); }
		if (!size) throw new Error("Google Drive image is empty");
		return { body: await new Blob(chunks).arrayBuffer(), contentType };
	}
	throw new Error("Too many Google Drive redirects");
}

export { fetchDriveImage };
