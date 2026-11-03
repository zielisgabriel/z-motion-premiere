# Git and GitHub publication report

Date: 2026-11-03. Repository: [zielisgabriel/z-motion-premiere](https://github.com/zielisgabriel/z-motion-premiere). Product version: 1.0.2. Initial visibility: private.

## Requested work

Initialize Git with English Conventional Commits, create a GitHub repository and publish each previously generated version as a release. The authenticated account is zielisgabriel. GitHub CLI is installed at its full Program Files path; the current terminal PATH does not include it.

## Prepared result

- Preserve original assets for 0.1.0, 1.0.0, 1.0.1 and 1.0.2, with separate checksums and English release notes.
- Recover the three historical packaged snapshots as commits and annotated tags, then import the complete maintained 1.0.2 source. Missing historical TypeScript trees are explicitly disclosed.
- Use a private repository and local credential helper configuration without embedding tokens.
- Exclude local agent settings, environment files, dependencies, builds and installation sandboxes.
- Restrict push CI to main while retaining pull requests and manual dispatch.
- Record actual remote publication and CI outcomes below after verification.

## Runtime status carried forward

The user confirmed Position works in 1.0.1. Scale readback precision was corrected and tested in 1.0.2, but native Scale application/playback remains pending. Creating releases does not certify that native behavior.

## Publication status

Historical Git snapshots were recovered and compared byte for byte with their original package files. Local npm run check passed: ESLint, 38 tests, TypeScript and production CEP build. Remote publication and remote CI remain pending.

- v0.1.0: b9e8c5155c0a2b81376021cd705a848467446b5c; 22 package/metadata files verified.
- v1.0.0: 301283df049ffc5852278692dcf40b67f025329c; 29 package/metadata files verified.
- v1.0.1: ed00018fdbf35f62c82cdd1865bd3ba1eaac8d34; 30 package/metadata files verified.
