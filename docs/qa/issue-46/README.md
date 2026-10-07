<!-- SPDX-License-Identifier: Apache-2.0 -->

# Issue #46 QA evidence

These contact sheets record local QA of the existing application using synthetic mail only. Each panel's account header is covered by a solid redaction. They were captured from real Chromium renders and composed into contact sheets with Pillow; no third-party prototype was copied or used as the render source.

## Contact sheets

- [Inbox before/after and detail after](comparison.png): Chromium captures at 390px width. The viewport height and synthetic fixture counts differ between BEFORE and AFTER because of QA mutations; this is not a matched-data comparison.
- [Loading, empty, error, and pagination states](states.png): 360px width, with the list API deliberately mocked for loading, empty, HTTP 500, and pagination. Pagination was exercised 1 → 2 → 3 → 2, including disabled bounds.

The rendered UI includes existing dependency output (including Kumo UI and Phosphor icons). Rights to redistribute those rendered dependency elements in screenshots require human review; neither the dependencies nor their output are presumed covered by this repository's Apache-2.0 license. No Magic Patterns or other third-party prototype assets are included.

## Recorded QA checks

The following results are recorded from the local QA run and were not independently rerun in this documentation-only pass:

- Widths: 360px, 390px, and 430px; desktop checks at 768px, 1280px, and 1440px.
- Primary controls are 48px; the 24px safe-area spacing was checked.
- Star click does not navigate; Back/Next work; archive and tag add/remove/disposition were confirmed by API readback.
- Reply editor mounts, but no message was sent. The email iframe remains sandboxed and its body remains white under both light and dark OS settings.
- The application uses a fixed LIGHT theme; dark mode is not a feature of this change. The compact reply toolbar is intentional.

## Review dispositions

- **P2-B — DO NOT FIX:** the composer is a sibling of the detail body, not its descendant; detail-body-scoped CSS does not affect it. The compact reply toolbar is intentional.
- **P2-D — DEFER:** the single-message iframe retains its fixed `60dvh` height while threaded messages retain `autoSize`. Unifying the scroll model is outside visual scope; no follow-up issue is warranted for this pass.
- **P3 — DO NOT FIX:** sticky touch hover/swipe tint is cosmetic; existing gesture handlers are preserved. The unread ring on the selected row is subtle and cosmetic. The separate search-star role suggestion is non-blocking because an accessible label/name already exists.
- **FIXED:** misleading `aria-pressed` on add-only search-operator chips and the star control's negative vertical margins.
- Issue #64 draft semantics are explicitly excluded.

The visual work preserves the existing backend, desktop behavior, and production configuration; this evidence does not imply changes to them. Before closing the work, rerun `npm test`, `npm run typecheck`, and `npm run build` against the final application diff. Screenshot evidence is not a substitute for those gates; `npm run license:check` is run after the inventory refresh.
