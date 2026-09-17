# Security policy

Security maintenance targets the current `master` branch. Older revisions have no
separate maintenance commitment. A local fix or a merged pull request does not
confirm that the deployed website has received it.

Report suspected vulnerabilities privately to **mirokit2025@gmail.com**, the
contact also listed in [security.txt](site/.well-known/security.txt). Include the
affected URL or revision, the impact, and minimal steps to reproduce with test
data. Do not include passwords, Access tokens, private media, or personal data.
Please avoid publishing exploit details or opening a public issue containing
sensitive evidence before the maintainers have investigated.

Maintainers should acknowledge the report, reproduce it in an isolated local
environment, assess affected data and versions, prepare a fix with regression
coverage, and coordinate any release and disclosure with the project manager.
There is no guaranteed response or resolution deadline.

Cloudflare deployment and changes to production Access, D1, R2, secrets, or
security settings require separate authorization. CI only checks code and builds
the Worker with `--dry-run`; it does not publish a Worker.

Implementation status and outstanding operational work are tracked in
[SECURITY_PLAN.md](SECURITY_PLAN.md). This policy is not a claim that the project
or its production configuration has undergone a complete security audit.
