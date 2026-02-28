# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in @openchart, please report it responsibly. **Do not open a public GitHub issue.**

Instead, use [GitHub's private vulnerability reporting](https://github.com/openchart/openchart/security/advisories/new) to submit your report. This keeps the details confidential until a fix is available.

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected package(s) and version(s)
- Impact assessment (if known)

### What to expect

- **Acknowledgment** within 48 hours
- **Status update** within 7 days with an assessment and estimated timeline
- **Fix or mitigation** published as a patch release, with credit to the reporter (unless you prefer anonymity)

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x     | Yes       |

## Scope

This policy covers the four published npm packages:

- `@openchart/core`
- `@openchart/engine`
- `@openchart/vanilla`
- `@openchart/react`

Vulnerabilities in dependencies (d3, etc.) should be reported upstream to the respective projects.
