# Security policy

WebAudit AI fetches untrusted web content, so security reports are taken seriously.

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private vulnerability reporting: the **Security** tab → **Report a vulnerability**. Include:

- affected version or commit
- steps to reproduce (a minimal, synthetic reproduction is ideal)
- impact as you understand it

You should receive an acknowledgement within 5 working days and a status update within 14 days. Fixes are released as soon as practical, and reporters are credited unless they prefer otherwise.

**Do not include** real credentials, personal data, or private/client website data in reports. Never test against websites you don't own or aren't authorised to test.

## In scope

- SSRF or private-network access, including via redirects, DNS rebinding, browser subresources, WebSockets or WebRTC
- Browser sandbox or guard-proxy bypass
- Cross-site attacks on a local instance: CSRF, DNS rebinding, clickjacking
- Form submission or other side effects on audited sites
- Leakage of secrets or personal data into stored findings, logs, reports or AI payloads
- Authentication bypass of the access token
- Prompt injection that changes findings or triggers actions beyond producing labelled AI text
- Script injection in the GitHub Action

## Out of scope

- Findings about third-party websites discovered _by_ WebAudit AI (report those to the site owner)
- Denial of service against a self-hosted instance you control
- Issues requiring a malicious local administrator or a modified build

## Supported versions

Only the latest release receives security fixes.

The threat model and controls are documented in [docs/security.md](docs/security.md).
