const ADMIN_ROUTES = [
	[/^\/(?:news|videos|partners|world-points)$/, ["GET", "POST"]],
	[/^\/interviews\/videos$/, ["GET", "POST"]],
	[/^\/interviews\/videos\/media$/, ["POST"]],
	[/^\/interviews\/videos\/[^/]+\/publish$/, ["POST"]],
	[/^\/interviews\/videos\/[^/]+$/, ["PUT", "DELETE"]],
	[/^\/interviews\/materials$/, ["GET", "POST"]],
	[/^\/interviews\/materials\/media$/, ["POST"]],
	[/^\/interviews\/materials\/[^/]+\/publish$/, ["POST"]],
	[/^\/interviews\/materials\/[^/]+$/, ["PUT", "DELETE"]],
	[/^\/projects$/, ["GET", "POST"]],
	[/^\/news\/availability$/, ["GET"]],
	[/^\/(?:media|videos\/media|partners\/media|projects\/media)$/, ["POST"]],
	[/^\/(?:news|videos|partners|world-points|projects)\/[^/]+\/publish$/, ["POST"]],
	[/^\/(?:news|videos|projects)\/[^/]+$/, ["PUT", "DELETE"]],
	[/^\/(?:partners|world-points)\/[^/]+$/, ["POST", "PUT", "DELETE"]],
	[/^\/gallery(?:\/quotes)?$/, ["GET", "POST"]],
	[/^\/gallery\/publish$/, ["POST"]],
	[/^\/gallery\/quotes\/[^/]+$/, ["DELETE"]],
	[/^\/gallery\/(?!quotes(?:\/|$)).+$/, ["PATCH", "DELETE"]],
];

function adminMethodResponse(request, pathname) {
	const relativePath = pathname.slice("/api/v1/admin".length).replace(/\/$/, "");
	const methods = ADMIN_ROUTES.find(([pattern]) => pattern.test(relativePath))?.[1];
	if (methods?.includes(request.method)) return null;
	return new Response(JSON.stringify({ success: false, message: methods ? "Method not allowed" : "Not found" }), {
		status: methods ? 405 : 404,
		headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...(methods ? { Allow: methods.join(", ") } : {}) },
	});
}

export { adminMethodResponse };
