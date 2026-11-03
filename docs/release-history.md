# Release history and provenance

Published on 2026-11-03 for [zielisgabriel/z-motion-premiere](https://github.com/zielisgabriel/z-motion-premiere), initially private. The workspace had no Git repository before this task. Git author identity comes from the user's existing Git configuration. Commits use Conventional Commits in English: type(scope): imperative description.

## Version snapshots

| Tag | Snapshot | Provenance |
| --- | --- | --- |
| v0.1.0 | Toolkit prototype, prerelease | Original preserved ZIP, compiled CEP runtime and installer scripts |
| v1.0.0 | Curve-only editor | Original preserved ZIP, compiled CEP runtime and installer scripts |
| v1.0.1 | Native Position write compatibility | Original preserved ZIP, compiled CEP runtime and installer scripts |
| v1.0.2 | Current maintained source with Scale precision handling | Complete current source, tests, installer source and CI |

Historical snapshots are recovered as separate commits with their original files unchanged, plus .gitattributes and release-snapshot.md recovery metadata. They use binary-preserving Git attributes to keep payload integrity inventories valid. The older TypeScript source trees were not retained and are not reconstructed from compiled JavaScript. Commit/tag dates record recovery, not original development.

The current source replaces the packaged tree on main. Earlier runtime files remain accessible through their tags and release ZIPs. The automatic GitHub source archives for historical tags contain packaged runtime snapshots; use the explicitly named Windows assets for installation.

## Original assets

Each release attaches the original EXE, original portable ZIP and a version-specific SHA-256 file. Existing binaries are not rebuilt or overwritten during publication. [release-manifest.json](releases/release-manifest.json) records filenames, byte lengths, hashes and the source type for all four versions.

## Verification and CI

Historical ZIP manifest versions are checked against their versioned filenames. Recovered Git blobs are compared with their original package files. The maintained source uses the existing local checks and GitHub Actions on source/configuration changes pushed to main, pull requests and manual dispatch. Documentation-only main pushes are excluded. Tag pushes do not trigger duplicate jobs or try to build missing historical source trees. Publication and actual CI results are recorded in [git-and-release-report.md](git-and-release-report.md).

Generated output, local installation sandboxes, dependencies, local agent settings and environment credentials are excluded from the main source commit. Third-party font/runtime license notices remain included with the original bundles. No project license is invented or added during publication.
