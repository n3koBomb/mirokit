const SITE_HOSTS = new Map([
	["mirokit.com", "mirokit.com"],
	["www.mirokit.com", "mirokit.com"],
	["ligamirokit.com", "mirokit.com"],
	["www.ligamirokit.com", "mirokit.com"],
	["mirokit.ru", "mirokit.ru"],
	["www.mirokit.ru", "mirokit.ru"],
	["ligamirokit.ru", "mirokit.ru"],
	["www.ligamirokit.ru", "mirokit.ru"],
]);

function getCanonicalSiteHostname(hostname) {
	return SITE_HOSTS.get(String(hostname || "").trim().toLowerCase().replace(/\.$/, "")) || null;
}

export { SITE_HOSTS, getCanonicalSiteHostname };
