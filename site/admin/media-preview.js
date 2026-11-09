function createAdminMediaPreview({ origin, isLocal, getLocalToken, showNotice }) {
	// Stored static image paths are relative to the public site, not /admin/.
	function resolveMediaUrl(value) {
		if (!value) return "";
		const url = new URL(value, `${origin}/`);
		const siteHosts = ["mirokit.com", "mirokit.ru", "ligamirokit.com", "ligamirokit.ru"];
		if (url.pathname.startsWith("/media/v1/") && (url.origin === origin || siteHosts.includes(url.hostname.replace(/^www\./, "")))) {
			return `${origin}/api/v1/admin/media/${url.pathname.slice("/media/v1/".length)}`;
		}
		return url.href;
	}

	function fetchAdminMedia(value) {
		const url = resolveMediaUrl(value);
		const headers = new Headers();
		// Never send the local token to an external media provider.
		if (isLocal && url.startsWith(`${origin}/api/v1/admin/media/`)) {
			headers.set("X-MiroKIT-Admin-Token", getLocalToken());
		}
		return fetch(url, { headers, cache: "no-store", credentials: "same-origin" });
	}

	const mediaPreviewState = new WeakMap();
	async function setMediaPreview(element, attribute, value) {
		const states = mediaPreviewState.get(element) || {};
		mediaPreviewState.set(element, states);
		if (states[attribute]?.blob) URL.revokeObjectURL(states[attribute].blob);
		const state = {};
		states[attribute] = state;
		element.removeAttribute(attribute);
		if (!value) return;
		try {
			let url = resolveMediaUrl(value);
			// Local <img>/<video> requests cannot attach a custom authentication header.
			if (isLocal && url.startsWith(`${origin}/api/v1/admin/media/`)) {
				const response = await fetchAdminMedia(value);
				if (!response.ok) throw new Error(`Medienvorschau nicht verfügbar (${response.status}).`);
				const blob = await response.blob();
				if (states[attribute] !== state || !element.isConnected) return;
				url = state.blob = URL.createObjectURL(blob);
			}
			if (states[attribute] === state) element.setAttribute(attribute, url);
		} catch (error) {
			if (states[attribute] === state && element.isConnected) showNotice(error.message, true);
		}
	}

	return { resolveMediaUrl, fetchAdminMedia, setMediaPreview };
}

export { createAdminMediaPreview };
