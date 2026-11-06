# Git and GitHub publication report

## Version 1.1.2 — 2026-11-05

The user approved the clip-wide motion blur version and explicitly requested publication. The repository was already public; visibility was preserved.

- Pushed the complete maintained source as `36221b57e48ebabdae4ea6b214293693f8339011` with the Conventional Commit `feat: add clip-wide Transform motion blur`.
- [GitHub Actions run 42134387871](https://github.com/zielisgabriel/z-motion-premiere/actions/runs/42134387871) passed on ubuntu-latest and windows-latest. Both jobs passed lint, coverage, production packaging and 12 browser flows. Windows also passed installer lifecycle, installer compilation and isolated EXE installation.
- Created and pushed the annotated `v1.1.2` tag on that exact tested source commit.
- Published [Z Motion 1.1.2 — Clip-wide motion blur](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.1.2) as the latest stable release, after verifying the draft's assets and tag.
- Attached the unchanged, user-approved `z-motion-1.1.2-setup.exe`, `z-motion-1.1.2-windows.zip` and version-specific SHA-256 checksums. All three uploaded sizes and GitHub SHA-256 digests matched local files. The 13 runtime payload files also matched the validated build, and the packaged host matched current source.
- The release notes document functionality, installation, automated validation and the agent's native-rendering verification limit. Local 1.1.0 and 1.1.1 builds were not published.

[v1-1-2-verification.json](releases/v1-1-2-verification.json) records the published release, asset hashes, source commit and successful remote jobs. This documentation update follows the tested source commit; the version tag remains on that tested commit. The initial publication record below is historical.

## Initial publication — 2026-11-03

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

Historical Git snapshots were recovered and compared byte for byte with their original package files. Local npm run check passed: ESLint, 38 tests, TypeScript and production CEP build. Remote publication and both CI jobs are now verified; see the final outcome below.

- v0.1.0: b9e8c5155c0a2b81376021cd705a848467446b5c; 22 package/metadata files verified.
- v1.0.0: 301283df049ffc5852278692dcf40b67f025329c; 29 package/metadata files verified.
- v1.0.1: ed00018fdbf35f62c82cdd1865bd3ba1eaac8d34; 30 package/metadata files verified.

## Verified publication

- Created [zielisgabriel/z-motion-premiere](https://github.com/zielisgabriel/z-motion-premiere) as a private repository with main as its default branch.
- Pushed the three recovered package commits, the maintained 1.0.2 source commit and four annotated version tags. No existing history was overwritten and no commits were backdated.
- Published [v0.1.0](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v0.1.0), [v1.0.0](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.0.0), [v1.0.1](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.0.1) and [v1.0.2](https://github.com/zielisgabriel/z-motion-premiere/releases/tag/v1.0.2). Version 0.1.0 is a prerelease; 1.0.2 is Latest.
- Each release contains its original setup EXE, original portable ZIP and version-specific SHA-256 checksums. All 12 uploaded asset sizes and GitHub SHA-256 digests matched their local originals before publication.
- The local source check passed ESLint, 38 tests, TypeScript and CEP production build.
- [GitHub Actions](https://github.com/zielisgabriel/z-motion-premiere/actions/runs/41578086137) passed both ubuntu-latest and windows-latest on source commit 77e05e61966167e6201f43ae585f73520686382d. Both jobs run coverage, build and seven browser tests; the Windows job also runs installation lifecycle checks, builds the installer and verifies isolated EXE installation.
- CI handles non-documentation main changes, pull requests and manual dispatch. Documentation-only main pushes and tag pushes do not trigger redundant builds.
- GitHub authentication uses the existing CLI keyring through a repository-local credential helper. No tokens were written into source or Git remotes.

[publication-verification.json](releases/publication-verification.json) records the remote run, release URLs and asset hashes. The source tag remains on the tested source commit; a later documentation commit records this final outcome. The working tree and origin/main are checked after that push.
