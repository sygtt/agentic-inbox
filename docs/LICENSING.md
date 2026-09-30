<!-- SPDX-License-Identifier: Apache-2.0 -->
# Licensing and provenance

## Project license

This fork retains the upstream Apache License 2.0 in the root `LICENSE` file.
Its bytes match both the original import (`c3f1c90`) and the audited upstream
`cloudflare/agentic-inbox` `main` snapshot (`48039bb6785af34e592c2966f87cde2b255c4c80`).
The upstream tree contains no separate `NOTICE` or `COPYING` file. The package
metadata also declares `Apache-2.0`.

Apache 2.0 section 4 requires redistributions to include the license, mark
modified files with a prominent change notice, preserve applicable upstream
copyright, patent, trademark, and attribution notices, and reproduce any
upstream `NOTICE` file if one exists. This repository preserves existing file
notices and uses SPDX identifiers and concise fork-change notices as described
below. ASF source-header policy is not a general Apache-licensed-project
requirement and is not applied here.

## Provenance audit

[`LICENSING-PROVENANCE.csv`](LICENSING-PROVENANCE.csv) inventories every
tracked path using the following classifications:

| Class | Meaning |
| --- | --- |
| A | Unchanged file in audited upstream `main`. |
| B | Upstream file changed in this fork. |
| C | Fork-created file, supported by this repository's Git history. |
| D | Identified third-party work with known provenance and license. |
| E | Generated or derived artifact; inspect its source rather than treating it as independent authorship. |
| F | Provenance or applicable terms remain uncertain; human review is required. |

For class D only, the CSV `evidence` cell must be a JSON object with four
non-empty string fields: `source_url`, `version`, `terms`, and `scope`. The URL
must be HTTP(S) with a hostname, and `version` must identify a pinned release
or commit rather than a moving branch or placeholder. `terms` records the
applicable reviewed license or terms; `scope` says which file or portion was
copied or adapted. For example:

```json
{"source_url":"https://github.com/acme/library","version":"v1.2.3","terms":"MIT License (SPDX: MIT); upstream license reviewed.","scope":"Adapted parser logic in app/lib/parser.ts."}
```

This structured evidence is an audit prompt, not a legal guarantee. If any
required detail is unresolved, classify the material as F until it is reviewed.
Evidence cells for all other classes remain descriptive prose.

The audit compared the complete tree at upstream `main`
(`48039bb6785af34e592c2966f87cde2b255c4c80`) with the original import
(`c3f1c90`) and reviewed fork Git history. Those source trees differ only in
`wrangler.jsonc`, where the current fork value is the B-class change. The CSV
uses actual upstream `main` SHA-256 values as its pinned baseline. The
baseline is checked locally without fetching from the network. Git history
establishes when files entered this fork, but does not alone establish who
authored copied text, the terms of an external design asset, or the origin of
a binary image. `.gitattributes` enforces LF checkout for text so these exact
source hashes remain stable with `core.autocrlf=true`; known binary assets keep
their original bytes.

The 25 files under `docs/references/magic-patterns-mobile-ui/` are retained as
an owner-supplied Magic Patterns prototype, imported by commit `3835566` as a
visual reference for mobile UI work. The repository record identifies that
purpose and source, but does not record the prototype output's license or
redistribution rights. They are class F, excluded from any claim that the
project-wide Apache license resolves their terms, and require human review of
those rights before reuse or redistribution is relied upon. The listed npm
packages in that reference's `package.json` are a separate dependency review,
not evidence of the source files' license.

The PWA PNG icons are class E as generated/derived assets: Git history records
their addition in commits `9a285f8` and `d61731c`, but no source artwork or
generation process is tracked. Their source-art review remains open; do not
infer their copyright or license from the project's `LICENSE`. `package-lock.json`
is also class E generated dependency metadata. The root application dependency
tree includes licenses other than Apache-2.0 (including MIT, Apache-2.0, ISC,
LGPL, MPL, and CC-BY declarations), so review actual npm packages and their
notices separately, with particular attention to bundled production output
and build tooling. These findings are a metadata scan, not a complete legal
review of every package. `demo_app.png` is inherited from upstream and is
class A. The full inventory records other identified generated or uncertain
files and the evidence available for each.

Existing `Copyright (c) 2026 Cloudflare, Inc.` headers appear on many source
files, including some introduced in this fork. The audit preserves them; a
header's presence is not treated as proof that Cloudflare authored every
subsequent change. New and modified fork source files carry an SPDX identifier
and a fork-change marker where applicable, without removing or replacing
existing notices or asserting an unverified individual copyright holder.

## File notice convention

New fork-authored source files use `SPDX-License-Identifier: Apache-2.0` in a
native comment and do not add a guessed copyright owner. Modified upstream
source files retain all original notices and add both that SPDX identifier
and `Modified in the sygtt/agentic-inbox fork; see Git history.` For formats
that do not permit comments (for example JSON and binary files), a sibling
`.license` sidecar records the applicable identifier and change status. The
sidecar is an explicit metadata association; it does not alter the data file.
The checker requires B/C files in JSON-like formats and binary assets such as
PNG, ICO, and PDF to use sidecars, and also recognizes binary bytes in other
extensions. For text sources, recorded upstream or third-party notices must
remain in the source itself even if a sidecar exists. For binary sources,
provenance notices may be recorded in the sidecar. E/F assets remain outside
Apache claims unless their provenance is reviewed.

Generated files should be regenerated from their recorded source rather than
hand-edited to add headers. Files with uncertain provenance are explicitly
classified and excluded from automatic Apache assertions in source bytes and
sidecars until a human reviews them. The generated package lock has one exact
sidecar exception documenting the repository-level license and its fork change;
other generated and uncertain artifacts cannot assert Apache-2.0 in a sidecar.
Do not resolve an unknown classification by adding an SPDX line.

## Dependency review

The root application dependencies are declared in `package.json` and resolved
in the generated lockfile. Those files describe dependencies; they do not
replace review of the licenses and notices shipped by each dependency. Review
third-party npm package licenses and transitive notices separately when
redistributing built or bundled output. The retained Magic Patterns reference
has its own dependency list and is not installed by the application.

## Review and maintenance

Run `npm run license:check` after changing tracked files or licensing metadata;
run `npm run license:test` to exercise failure cases. When a file is added,
record its class and evidence. For A/B paths, retain the pinned upstream hash
and exact upstream header notice lines. Reclassify an edited A file as B and
add the fork notice; do not update the baseline hash to hide the change. For
C paths, record Git/source evidence and add SPDX. For D paths, use the JSON
evidence schema above and preserve third-party notices. For E/F paths, record
the reviewed content hash and rationale, and keep them out of unverified Apache
claims. The check uses only Node.js and Git, requires inventory coverage for
every tracked path, checks required
identifiers/notices and root license integrity, and validates explicit
generated/uncertain exceptions. Its checks are guardrails, not a legal
conclusion or a substitute for human review.

Any developer or AI agent adding or copying code, assets, prompts, or design
references must record the source and applicable terms before reuse. AI
assistance does not establish authorship or license. A human reviewer must
verify provenance, preserve third-party notices, classify uncertain material
as F, and approve the licensing decision before merging. See `AGENTS.md` for
the mandatory checklist.

## Audit sources

- [Apache License 2.0, sections 4 and 6](https://www.apache.org/licenses/LICENSE-2.0)
- [ASF source header policy](https://www.apache.org/legal/src-headers.html) (ASF-specific; not imposed on this project)
- [ASF generative tooling guidance](https://www.apache.org/legal/generative-tooling.html) (used as human-review guidance, not as this project's license policy)
