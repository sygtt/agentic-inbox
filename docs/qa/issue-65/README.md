<!-- SPDX-License-Identifier: Apache-2.0 -->

# Issue #65 validation

## Implemented layout

The user's explicit instruction overrides Issue #65's older 1280px threshold:
opening an email keeps its list on the left and its reading pane on the right
from 768px, including iPad portrait widths. Only phone widths use a single pane.

| Viewport | Navigation | Selected list width | Approximate remaining detail width |
| --- | --- | --- | --- |
| 768px | 80px rail | 280px | 408px |
| 820px | 80px rail | 280px | 460px |
| 1024px | 232px drawer | 320px | 472px |
| 1280px | 232px drawer | 400px | 648px |
| 1440px | 232px drawer | 400px | 808px |
| 1536px | 232px drawer | 440px | 864px |

These widths follow the CSS rules, not browser measurements. Borders may
consume a pixel. With no selected message, the list fills the content area.

## Completed checks

- The existing 154 deterministic tests passed.
- Type checking and production compilation passed.
- Static peer review caught a clipped Move to folder menu caused by horizontal
  toolbar overflow. The final toolbar wraps controls instead, preserving the
  dropdown's placement.
- Shared mobile token aliases retain the previous literal colors, shapes,
  typography, and elevation values. Mobile component files and email sandbox
  rules were not changed.
- No backend, schema, API, binding, or dependency changes. No production deploy.

## Visual QA remains pending

No before/after screenshots are included because no application render was
successfully observed in a browser in this environment. The development server
was unreachable from the available browser; local Chromium installation failed
because its download did not contain a valid archive. The cloud browser then
rejected opening the disposable local React fixture under its URL security
policy. No policy workaround was attempted. This is an environment limitation,
not evidence that the application works visually.

Keep the PR in draft and keep the issue open until the following checks are
completed in an environment with a working local browser. Use synthetic mail
and redact any account identity before publishing screenshots.

1. Run `npm run dev`; seed or use a non-production mailbox with read/unread mail,
   stars, ordinary/disposition/error tags, long subjects/addresses, and a thread.
2. Compare the base commit `24652d4` with this branch at 1024px and 1440px using
   matched data; attach before/after screenshots to the PR.
3. Check 768, 820, 1024, 1280, 1440, and 1536px: select mail and confirm both
   panes remain visible; scroll each independently; verify selected border and
   unread dot/weight, row hover actions, keyboard focus, and wrapped toolbar.
4. Open Move to folder, Reply/Compose, tag filtering, pagination, and search;
   check empty, loading, list error, detail error, and multi-message thread states.
5. Check Agent/MCP overlay open/close at 768px and above; closing it must retain
   the selected message. Verify `/` focuses search and Escape closes detail while
   preserving existing compose and overlay safeguards.
6. Check 767px and 390px: phone rows/navigation, message opening and browser Back,
   previous/next, safe-area spacing, archive advancement, and compose persistence
   during resize. Confirm sandboxed email body rendering remains unchanged.
7. Confirm console/network behavior and then rerun the repository validation
   commands before marking the PR ready and changing its reference to `Closes #65`.

This implementation was assisted by Codex and GPT-6-Luna. No Gmail/Outlook
source, branded assets, proprietary fonts, or third-party prototype code were
imported. Human provenance/licensing review is still required before merge.
