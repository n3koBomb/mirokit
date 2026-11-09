// Observation only. Review browser violations before enforcing this policy.
const CSP_REPORT_ONLY = [
	"default-src 'self'",
	"script-src 'self' https://challenges.cloudflare.com https://cdn.jsdelivr.net",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
	"font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
	"img-src 'self' data: blob: https:",
	"media-src 'self' blob: https:",
	"frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com",
	"connect-src 'self' https://challenges.cloudflare.com https://cdn.jsdelivr.net",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'self'",
].join("; ");

export { CSP_REPORT_ONLY };
