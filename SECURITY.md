# Security Policy

ALOHA Assistant is a personal AI assistant. Security work must protect both the software and the private data/infrastructure reachable through a deployed instance.

## Reporting a vulnerability

Do not put exploit details, credentials, personal data, production logs, private infrastructure identifiers, or other sensitive evidence in a public GitHub issue, pull request, discussion, commit message, or comment.

Prefer GitHub private vulnerability reporting when it is enabled for this repository. If no private reporting channel is available, contact the maintainer through a private channel advertised by the project before sharing sensitive technical details.

A safe initial report should describe the affected component, impact, reproduction prerequisites and a minimal synthetic reproduction without including real secrets or user data.

## Repository disclosure boundary

The public repository may contain portable source code, public contracts, public product documentation and synthetic examples. It must not contain:

- real user conversations, memories, emails, contacts, calendars, files, media, location or other personal data;
- production/staging datasets, database dumps, traces, request captures or logs containing real data;
- API keys, OAuth secrets/tokens, cookies, JWTs, private keys, passwords, webhook secrets or signed private URLs;
- non-public live infrastructure identifiers/topology such as Cloudflare account/zone/resource/tunnel identifiers, private hosts/origin IPs, deployment-only routes or internal service metadata;
- private connector output or private documentation copied from another system.

Use synthetic test data and placeholders. Keep runtime secrets and live private deployment configuration outside source control.

## If a disclosure is found

1. Stop copying or quoting the exposed value.
2. Revoke/rotate any affected credential immediately.
3. Assume committed content remains available in Git history even after a normal deletion commit.
4. Clean the repository history before making or keeping the repository public when sensitive content entered Git history.
5. Review CI logs, artifacts, PR/issue text and external caches for secondary disclosure.
6. Document the remediation without repeating the sensitive value.

## Public-release gate

Before changing repository visibility to public, review both the current tree and Git history for secrets, personal data and private infrastructure details. A clean current checkout alone is not sufficient.

See `AGENTS.md` for the mandatory rules followed by coding agents and contributors working in this repository.
