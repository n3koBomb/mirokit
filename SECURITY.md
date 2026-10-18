# Security policy

Security maintenance targets the current `master` branch; older revisions have no separate maintenance commitment. A local fix or merged pull request does not confirm a production release. Implementation status is tracked in [SECURITY_PLAN.md](SECURITY_PLAN.md), with the local review dated 18 October 2026 in [the repository audit](docs/repository-audit.md).

## Private reporting

Report suspected vulnerabilities to **mirokit2025@gmail.com**, also listed in [security.txt](site/.well-known/security.txt). Provide the affected revision or URL, expected and observed behavior, likely impact, and minimal reproduction using test data. Do not include credentials, Access assertions, unpublished media or personal data. Avoid public issues containing sensitive evidence until maintainers can investigate.

Maintainers should acknowledge the report, reproduce it in isolation, assess affected data and versions, prepare a fix with appropriate regression checks, and coordinate release and disclosure with the project manager. There is no promised response or resolution deadline. `security.txt` currently expires on **29 August 2027**; keep its contact, canonical URL and expiry current.

## Implemented boundaries

- Production admin pages and APIs require a valid Cloudflare Access JWT and an allowed email. The development token is accepted only on `localhost` and `127.0.0.1`.
- `/media/v1/` checks publication before returning bytes or `304`. Pending, draft and archived objects are not public merely because their keys are known.
- `/api/v1/admin/media/` authenticates previews; local requests attach the token as a header, never as a URL parameter.
- Conventional media uses D1 references or Gallery metadata; Online Projects videos/PDFs use a published R2 JSON record. JSON manifests are not downloadable through the media handler.
- Contact handling includes origin checks, field validation, Turnstile, honeypot and a rate limiter that rejects requests when unavailable.
- Status details and bot/privacy-signal groups are admin-only. Public totals count requests, not identified people. DNT/GPC requests are excluded from normal visits but retained in separate admin aggregates.

These are implemented controls, not a claim of exhaustive security assurance. The open defects and missing regression cases in the audit remain actionable.

## Operational limitations

Public static files, third-party media, previously downloaded copies and directly public R2 endpoints fall outside revocation through the Worker. Keep the R2 bucket private and verify alternate delivery routes. Gallery batch publication/reordering spans multiple objects and can partially succeed. Review the stored state before retrying.

The CSP is report-only; it does not block violations. No central CSP report collector, comprehensive admin audit trail, automated backup/restore workflow or extra admin rate limiter is implemented.

CI performs local checks and bundling only. Production Access, D1/R2 bindings, mail permissions, secrets, routing, lifecycle rules and TLS settings require separate operational verification and authorization. Never infer account state from a checked-in configuration.

Third-party notices and restricted project/media rights remain applicable; see [LICENSE.md](LICENSE.md) and the [asset guide](site/public/assets/README.md).
