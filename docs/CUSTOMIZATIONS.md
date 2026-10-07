<!-- SPDX-License-Identifier: Apache-2.0 -->
# Customizations

This document records intentional differences between this fork and upstream `cloudflare/agentic-inbox`.

Its purpose is to preserve *why* local behavior exists so future maintainers and AI coding agents do not accidentally remove it during refactors or upstream synchronization.

Read this file before changing code that differs from upstream.

Update it whenever a fork-specific customization is added, removed, or materially changed.

## Status legend

Use one of these labels for each customization:

- **Active**: implemented and intentionally retained.
- **Planned**: agreed requirement, not yet implemented.
- **Candidate for upstream replacement**: upstream now has similar behavior and local code should be reviewed for removal.
- **Retired**: no longer implemented, retained here only when the historical reason is still useful.

## What belongs here

Record a change here when it intentionally changes runtime behavior, architecture, development policy, or deployment assumptions relative to upstream.

Do not use this file as a changelog for every commit.

A useful entry should include:

- status
- motivation
- expected behavior
- main affected areas
- configuration involved
- persistence/migration implications
- upstream synchronization risk
- removal/replacement conditions

---

# Active customizations

## Structured email tags with provenance

**Status:** Active

### Why

External agents and deterministic processing need structured email metadata
without conflating tags with folders or adding rule evaluation to the mailbox.

### Behavior

- Emails can have multiple namespaced tags with `rule`, `agent`, or `manual` provenance.
- The three `disposition:*` workflow values are mutually exclusive and replaced atomically.
- Mailbox-scoped HTTP endpoints support reading, upserting, removing tags, and setting disposition.
- Desktop and mobile email lists support exact tag filtering. The Durable Object applies it before pagination, and threaded rows match when a message in that folder's conversation has the selected tag.
- Available tag names refresh every thirty seconds and during manual list refreshes so synthetic `triage:error` options track background triage changes.
- Search supports `tag:namespace:value` and combines it with the other search operators.
- MCP email reads expose `folder_id` and structured tag provenance, and the
  `set_email_disposition` tool records one of the three agent triage outcomes.
- Tag input is constrained to lowercase `namespace:value` strings with conservative length limits.
- Folder behavior, authentication, and email body storage remain unchanged.

### Main affected areas

- `workers/db/schema.ts`
- `workers/durableObject/migrations.ts`
- `workers/durableObject/index.ts`
- `workers/lib/email-tag-filter.ts`
- `workers/index.ts`
- `workers/lib/email-tags.ts`
- `workers/lib/mcp-email.ts`
- `workers/mcp/index.ts`

### Configuration involved

None.

### Persistence / migration implications

Migration `10_add_email_tags` adds the `email_tags` table with a foreign key
to `emails`; existing emails remain valid with no tags. Deleting an email
cascades to its tag assignments.

### Upstream synchronization risk

Medium. Upstream changes to MailboxDO schema, migrations, mailbox-scoped email
routes, or MCP tool response mapping may conflict with this metadata model.

### Removal / replacement condition

Remove the local model when upstream provides equivalent namespaced tags,
provenance, and disposition replacement semantics.

## Email content normalization for list and agent text

**Status:** Active

### Why

Email list snippets and agent-facing plain text should remain readable when
stored content contains HTML markup, while text-only messages must retain
ordinary angle brackets and URLs.

### Behavior

- HTML tags, comments, scripts, styles, and templates are removed before list snippets are truncated.
- Whitespace and HTML entities are normalized for readable text.
- Text-only content is preserved when it contains email addresses or URLs in angle brackets.
- The original database body and browser/API rendering semantics are unchanged.

### Main affected areas

- `workers/lib/email-content.ts`
- `workers/lib/email-helpers.ts`
- `workers/durableObject/index.ts`
- `workers/agent/index.ts`
- `workers/lib/ai.ts`

### Configuration involved

None.

### Persistence / migration implications

None. Snippets are derived at read time; no normalized-body column or schema
migration is added.

### Upstream synchronization risk

Medium. Upstream changes to mailbox list projections or plain-text email
helpers may conflict with this shared normalizer.

### Removal / replacement condition

Remove the local normalizer when upstream provides equivalent safe handling for
HTML and text-only content across list, agent, and reply paths.

## Mobile PWA inbox helpers

**Status:** Active

### Why

Issues #3, #17, #44, and #45 add a deliberately small mobile workflow for checking incoming mail,
copying verification codes, deleting messages from the list, and opening links
without introducing a separate mobile client or new persistence.

### Behavior

- Full email detail deterministically extracts up to 20 4–8 digit candidates and uses the existing inbound Jev result to select a candidate ID or `none`. The worker stores the selected ID with its exact server-derived value and whether the bounded candidate set covers the full message; the UI uses that mapping for display and copy, including when its HTML normalization differs from the worker's. Pending, unavailable, failed, malformed, or legacy analysis falls back to the contextual regex detector. A `none` result hides the action only when the candidate set is complete; if body or candidate limits make it incomplete, the detector checks the full message. Mobile list rows continue to use the existing snippet-only contextual fallback.
- Plain-text `http`/`https` URLs are converted to links after escaping the input.
- Existing HTML mail continues through the sandboxed DOMPurify iframe path.
- Email deletion is available as a touch-friendly list action and uses the shared undoable Trash behavior: regular messages skip the pre-delete confirmation and the success toast offers `キャンセル` to move the message back to its own folder, while permanent Trash deletion keeps its confirmation.
- The web app declares a Japanese standalone manifest with raster install icons derived from the repository's favicon.
- No service worker or offline mailbox support is added.
- At phone widths, the mailbox uses a safe-area-aware bottom navigation for Inbox, Folders, Search, and Settings while retaining the desktop sidebar at `md` and above; the split view starts at `xl` (1280px) and above, with a single-pane layout at `md`–`lg`.
- Mobile inbox and search rows use real email data, server-side search, deterministic `needs_reply`/draft/OTP signals, and pointer gestures for archive/read actions. Long press exposes only real quick actions.
- Mobile detail reuses the existing thread, body, attachment, reply, move, star, delete, and structured tag/disposition flows; it does not add mock summaries, Snoozed, Mute, or Pin state.
- Opening a message records its ID in the URL so browser Back returns to the same loaded list and preserves its local filters and scroll position. Previous/next controls follow the loaded list order without adding history entries; opening another message marks it read and resets detail scrolling to the top. Opening or refreshing a URL-selected unread message marks it read after its email and thread data load, using the thread-aware read mutation. A successful archive advances only when the archived message is still selected at completion: the current viewport determines whether mobile advances to the next lower message or desktop closes the detail. A failed archive leaves the detail open. Async moves, deletions, and draft sends close detail only while their original email remains selected.
- Entering the mobile layout preserves an existing desktop message selection in the URL. While a compose is active, URL selection does not replace the compose form, preserving unsaved fields across viewport changes. Closing a compose after resizing to mobile restores its underlying selected email in the URL. Browser Back during a compose restores the marked mobile detail history entry and keeps compose fields intact. Closing detail through a tag filter, successful compose send, or deleting its selected row also clears the URL selection. Stale or invalid `?email=` selections show an error state with a Back to list action.
- Mobile inbox and search rows label the three supported dispositions in Japanese, put system triage errors ahead of disposition and other tags, and cap tag badges at three with a `+N` overflow count. Draft and Needs reply signals remain visible.
- Mobile folder management reads counts and custom folders from the existing folder API; non-empty custom folders cannot be deleted because folder deletion cascades to contained mail. Tag editing lazily reads the selected message's structured tags to avoid list-wide N+1 requests.

### Main affected areas

- `app/lib/verification-code.ts`
- `app/lib/email-body.ts`
- `app/components/VerificationCodeAction.tsx`
- `app/components/EmailIframe.tsx`
- `app/routes/email-list.tsx`
- `app/routes/folders.tsx`
- `app/routes/search-results.tsx`
- `app/components/mobile/`
- `app/lib/mobile-gestures.ts`
- `app/root.tsx`
- `public/manifest.webmanifest`

### Configuration involved

None.

### Persistence / migration implications

None. OTP extraction and URL linkification are view-layer behavior, and
deletion reuses the existing email API and semantics.

### Upstream synchronization risk

Medium. The shared mailbox shell, list/detail routes, and email APIs may change
upstream. The mobile layer is intentionally isolated under
`app/components/mobile/`, but route and mutation integration still needs review
when synchronizing upstream.

### Removal / replacement condition

Remove local helpers if upstream provides equivalent safe mobile behavior.

## Mobile Material 3 visual layer (#46)

**Status:** Active

### Why

Give existing mobile email workflows a consistent, touch-friendly Material 3
visual treatment without replacing their behavior.

### Behavior

- Applies only at viewport widths `<= 767px`.
- Uses shared Material 3 tokens in `app/index.css` and restyles existing screens
  with the existing Kumo components/styles, Phosphor icons, and Tailwind, using
  a fixed light color scheme; no dark-mode feature is added.
- Existing mailbox routes and action handlers are preserved. The `EmailIframe`
  component and sandboxed email rendering are unchanged; the surrounding mobile
  email container height is controlled by CSS.
- No configuration, persistence, or migration changes.

### Files modified in this branch

- `app/index.css`
- `app/components/mobile/{MobileBottomNav,MobileBottomSheet,MobileEmailDetail,MobileEmailRow,MobileQuickActions,MobileTagSheet}.tsx`
- `app/routes/{email-list,mailbox,search-results}.tsx`

### Upstream synchronization risk

Medium. Shared routes and the global stylesheet can conflict; keep the visual
rules scoped to the mobile breakpoint.

### Removal / replacement condition

Reduce or remove this layer if upstream provides an equivalent mobile visual
treatment while preserving these routes and actions.

## Trash-first deletion and 30-day retention

**Status:** Active

### Why

Normal deletion should be recoverable while preserving the existing mailbox
storage model and attachment provenance.

### Behavior

- UI deletion moves regular messages to Trash and retains SQLite metadata and R2 attachments.
- Regular UI deletion skips the pre-delete confirmation and adds a `キャンセル` action to the success toast; selecting it moves the message from Trash back to its original folder.
- Permanent deletion is guarded to Trash and still requires confirmation; draft discard remains permanent and keeps its confirmation because neither action is recoverable.
- `emails.trashed_at` records the first move into Trash, is cleared on restore, and is not reset by a redundant Trash move.
- A daily Cron Trigger purges current Trash messages after 30 days and removes their R2 attachment objects.
- MCP and Agent workflows expose `trash_email`; permanent deletion is explicit and guarded.

### Main affected areas

- `workers/db/schema.ts`
- `workers/durableObject/migrations.ts`
- `workers/durableObject/index.ts`
- `workers/app.ts`
- `workers/lib/attachments.ts`
- `workers/lib/trash.ts`
- `workers/lib/tools.ts`
- `workers/mcp/index.ts`
- `app/components/`

### Configuration involved

The daily schedule is declared in `wrangler.jsonc`. No secret or personal
configuration is required.

### Persistence / migration implications

Migration `11_add_trashed_at` adds a nullable column and gives existing Trash
rows a fresh 30-day grace period. Non-Trash rows remain `NULL`.

### Upstream synchronization risk

Medium. Upstream changes to MailboxDO migrations, delete/move routes, attachment
cleanup, or MCP tools may conflict with this customization.

### Removal / replacement condition

Remove the local behavior when upstream provides equivalent recoverable deletion
and retention semantics.

## MCP plain-text email body contract

**Status:** Active

### Why

MCP consumers should receive semantic email content without having to guess
whether `body` or `body_text` is safe to process.

### Behavior

MCP `get_email` and `get_thread` responses expose normalized readable text in
`body` and `body_text`. The stored representation remains available only in
the explicitly named `body_html` field.

### Main affected areas

- `workers/lib/mcp-email.ts`
- `workers/mcp/index.ts`

### Configuration involved

None.

### Persistence / migration implications

None. Database body storage and browser/API rendering are unchanged.

### Upstream synchronization risk

Medium. Changes to upstream MCP tool response mapping may conflict with this
adapter; preserve the plain-text-first contract when resolving conflicts.

### Removal / replacement condition

Remove this adapter when upstream exposes the same plain-text-first MCP
contract with an explicitly named HTML field.

## AI-oriented repository governance

**Status:** Active

### Why

This fork is intended to be maintained heavily with AI coding agents such as Codex and ChatGPT while remaining safe to publish publicly and easy to synchronize with upstream.

Without explicit repository-level guidance, an AI agent may make unnecessarily broad changes, expose deployment-specific values, weaken production protections for convenience, or remove unusual but intentional fork behavior.

### Behavior

The fork includes an `AGENTS.md` that defines mandatory development rules, including:

- branch strategy
- investigate-plan-implement-verify workflow
- public-repository security requirements
- production deployment boundaries
- email handling invariants
- authentication safety
- migration discipline
- upstream synchronization policy
- documentation maintenance expectations

The supporting documentation is split into:

```text
AGENTS.md

docs/
├── ARCHITECTURE.md
├── DEVELOPMENT.md
└── CUSTOMIZATIONS.md
```

### Main affected areas

Documentation and development process only.

No runtime behavior is intentionally changed by this customization.

### Configuration involved

None.

### Persistence / migration implications

None.

### Upstream synchronization risk

Low.

Upstream may eventually add its own `AGENTS.md` or equivalent agent instructions. If that happens, compare the two carefully rather than blindly replacing either file.

Fork-specific production-safety and branch rules should remain documented even if upstream adds generic agent guidance.

### Removal / replacement condition

May be simplified if upstream later provides equivalent AI-agent guidance, but fork-specific policy must remain available somewhere explicit.

---

## Fork branch model

**Status:** Code-history migration completed through PR #60 on 2026-10-01 (JST; 2026-09-30 UTC). Main-first is active; external Cloudflare build settings remain unverified.

### Why

The previous workflow used `main` to follow upstream and `develop` for fork
work, even though GitHub already used `main` as the default branch. This split
made pull request targets, issue closure, and deployment assumptions harder to
reason about. The fork now keeps its complete history on canonical
`main`, while reviewing upstream changes through separate sync branches.

### Behavior

The active workflow is:

```text
upstream/main --reviewed sync branch/PR--> main
                                            ^
                                            |
                         feat/* fix/* docs/* chore/*
```

- `main` is the canonical fork branch and PR target; do not push work directly to it.
- Feature and maintenance branches start from the latest `origin/main`.
- Upstream changes are inspected and integrated through a `sync/upstream-YYYY-MM` branch and PR. Do not make `main` track or fast-forward to `upstream/main`.
- Keep the existing `develop` branch until the owner separately confirms it is safe to retire. The migration does not delete it or its archive refs.
- Pull requests that fully implement an issue use a native GitHub closing keyword such as `Closes #123`, because they target the default branch.

### Main affected areas

Git workflow, issue closure, and deployment branch selection.

### Configuration involved

GitHub's default branch is already `main`. The Cloudflare build and deployment
branch settings are external to this repository and must be checked by the
owner before the migration PR is merged. This documentation does not assert
that those settings currently target `main`.

### Persistence / migration implications

The migration PR preserves existing fork commits by merging with a merge
commit, not by squashing or rebasing. The existing `develop` and archived
branch refs remain available for rollback and are retired only in a separate,
owner-approved step.

### Upstream synchronization risk

Moderate during the transition. Review upstream diffs and customization notes
before integrating changes; do not blindly merge an upstream branch.

### Removal / replacement condition

Revise this model only through an explicit decision, updating `AGENTS.md` and
`docs/DEVELOPMENT.md` at the same time.

---

## Deployment-specific domain value in `wrangler.jsonc`

**Status:** Active, cleanup candidate

### Why

The initial Cloudflare deployment process wrote the production domain into this fork's committed `wrangler.jsonc`.

Upstream uses a generic example domain, while this fork currently contains a deployment-specific value.

### Behavior

`DOMAINS` in the committed Wrangler configuration points at the real deployment rather than a generic example.

### Main affected areas

- `wrangler.jsonc`
- deployment configuration
- `/api/v1/config`
- mailbox/domain-related UI behavior

### Configuration involved

`DOMAINS`

### Persistence / migration implications

None.

### Security note

A domain name is not itself a secret, but this repository is public and reusable application source should avoid unnecessary coupling to personal deployment values.

Do not copy this pattern for new secrets, addresses, account IDs, internal hosts, or other deployment-specific data.

### Upstream synchronization risk

Low but recurring. Upstream changes to `wrangler.jsonc` may conflict with the local deployment-specific value.

### Removal / replacement condition

Prefer moving production-specific configuration out of committed reusable source when a clean Cloudflare deployment mechanism is chosen.

Do **not** perform that cleanup incidentally during unrelated feature work because it can affect the deployed application configuration.

## Desktop mail-client layout (Gmail-informed information design)

**Status:** Active

### Why

Issue #52。「設定画面付き Web アプリ」感を減らし PC で scan → triage → read を短くする。Gmail の情報設計・密度・導線を参考にし、ロゴ/固有アイコン/ブランド表現は模倣しない。mobile は #46 の領域なので触らない。

### Behavior

- 全幅 top bar（search が主役、`/` で focus、gear 無し）と、Settings を常設して active 表示する左 nav rail を使う。`/` は detail の sandboxed iframe 内に focus がある場合も bridge 経由で伝播する（無修飾 `/` のみ、編集中フィールドは対象外）。
- 並置は `xl`（1280px）以上で、`md`〜`lg` は single-pane（detail が list を置換し、toolbar に Back）。list 幅は `xl` で 448px、`2xl` で 480px。
- agent panel は layout 幅を消費しない右 overlay で、初期 closed。
- 一覧行は 2 行・実測 45px。sender のみ truncate し、tag chip は最大 2 + `+N`。hover/focus で Archive/Read/Delete を overlay 表示する。行からの Archive 成功時、アーカイブ対象メールが完了時点でも選択中なら detail も閉じる。
- pagination は上部 compact pager に集約（desktop 下部バー削除、mobile は維持）。detail toolbar に Archive を配線し、Escape で close。detail toolbar の Archive は一覧行と同じ規則で folder 依存（Archive/Trash では Inbox へ戻す）。
- 新規 store・route・URL param・依存関係は追加していない。

### Main affected areas

- `app/routes/{mailbox,email-list,search-results}.tsx`
- `app/components/{Header,Sidebar,MailboxSplitView,EmailListRow,EmailPanel}.tsx`
- `app/components/EmailIframe.tsx`
- `app/components/email-panel/{EmailPanelToolbar,EmailPanelHeader,SingleMessageView}.tsx`
- `app/hooks/useUIStore.ts`
- `app/lib/email-panel-navigation.ts`
- `app/lib/mobile-email-tags.ts`

### Configuration involved

None.

### Persistence / migration implications

None（表示層のみ。schema・migration・API 不変）。

### Upstream synchronization risk

**High**。upstream が desktop shell / list row / detail toolbar を変えると同じ行で衝突。`EmailListRow.tsx` は fork-created で残るが `email-list.tsx` の desktop 分岐は共有。sync 時の既定方針 = 「mobile tree と backend は upstream に合わせ、desktop の密度・breakpoint・overlay 挙動は fork を維持」。

### Removal / replacement condition

upstream が同等の desktop 情報設計（全幅 search / xl reading pane / 行 hover action）を提供したら本 entry を縮小または Retired にし、`EmailListRow.tsx` の upstream 行への統合を検討する。

---

# Recently implemented customizations

## Catch-all mailbox aggregation

**Status:** Active

### Why

The intended email workflow uses arbitrary service-specific recipient addresses without requiring a mailbox to be created for every alias.

Examples should be thought of generically as:

```text
service-a@example.com
service-b@example.com
random-alias@example.com
```

Unknown recipient addresses should remain useful for compartmentalization and leak/source identification while still being readable from a single mailbox.

### Desired behavior

Introduce a configurable catch-all mailbox:

```text
CATCH_ALL_MAILBOX=all@example.com
```

Routing rules should behave as follows:

1. If the SMTP envelope recipient corresponds to an explicitly configured mailbox, deliver to that mailbox normally.
2. If the recipient does not correspond to an explicit mailbox and catch-all is enabled, store the message in the configured catch-all mailbox.
3. Preserve the **original SMTP envelope recipient** separately from the storage mailbox identity.
4. Preserve the visible `To`, `Cc`, and other parsed headers unchanged.
5. Do not automatically create a new mailbox for every unknown alias.
6. If catch-all is disabled, reject unknown recipients rather than silently routing them to an unrelated mailbox.

Conceptually:

```text
SMTP envelope recipient: shop@example.com
                          |
                          v
                 mailbox exists?
                 /             \
               yes              no
               |                |
               v                v
        shop@example.com   catch-all enabled?
                           /             \
                         yes              no
                         |                |
                         v                v
                  all@example.com    defined reject/
                  storage mailbox     ignore behavior
                         |
                         v
                  preserve original:
                  shop@example.com
```

### Critical design requirement: envelope recipient

The implementation resolves mailboxes using the Cloudflare Email Worker event's SMTP envelope recipient, while retaining the visible recipient headers as message metadata.

This is required because the SMTP envelope recipient may differ from visible `To` headers, especially with:

- aliases
- Bcc deliveries
- forwarding
- mailing systems that rewrite visible headers

Do not implement catch-all by taking `parsedEmail.to[0]` and replacing it with the catch-all address.

### Original recipient storage

The catch-all mailbox must retain enough information to answer:

> Which address was this message actually delivered to?

Do not destroy this information by rewriting the existing `recipient` field to the catch-all mailbox address.

The implementation adds a dedicated nullable `emails.envelope_recipient` column through an additive Durable Object migration.

### Main affected areas

Likely areas include:

- `workers/app.ts` email event typing/forwarding
- `workers/index.ts` inbound `receiveEmail()` routing
- mailbox resolution helpers, preferably isolated from orchestration
- `workers/db/schema.ts` if envelope recipient is persisted separately
- `workers/durableObject/migrations.ts` if schema changes
- `workers/durableObject/index.ts` data interfaces/queries if schema changes
- configuration (`CATCH_ALL_MAILBOX` or equivalent)
- config API and mailbox-picker auto-creation
- UI display/filtering and catch-all mailbox deletion protection
- search predicates for original envelope recipients
- tests for recipient resolution

The implementation should minimize the number of upstream files modified where practical.

### Configuration involved

Configuration concept:

```text
CATCH_ALL_MAILBOX
```

The production catch-all address is configured in `wrangler.jsonc`; generic examples should continue to use `all@example.com`.

Committed examples should use `all@example.com`.

### Persistence / migration implications

Yes. Migration `9_add_envelope_recipient` adds the nullable column and preserves existing mailbox data.

Existing messages retain `NULL` because their SMTP envelope recipient was not previously available to the application.

### Validation performed and required

At minimum cover:

- explicit existing mailbox delivery
- unknown alias -> catch-all delivery
- preservation of original envelope recipient
- visible `To` differing from envelope recipient
- Bcc-style delivery where the envelope recipient is not visible in `To`
- catch-all mailbox missing or misconfigured
- catch-all disabled
- invalid/out-of-domain recipient
- malformed message
- attachment handling remains correct
- auto-triage trigger targets the storage mailbox intentionally

The focused routing tests run with the repository's `npm test` script. Also run:

```bash
npm run typecheck
npm run build
```

### AI-agent interaction question

When an unknown alias is stored in the catch-all mailbox, the `EmailAgent` associated with the **storage mailbox** is triggered.

That is probably desirable, but the implementation must make the distinction explicit:

```text
routing identity     = original envelope recipient
storage/agent scope  = catch-all mailbox
```

The original recipient should still be available to agent tools if future triage or classification needs it.

### Outbound/reply implications

Catch-all receiving does not automatically imply arbitrary-From sending.

The storage mailbox identity and original recipient alias may not both be valid outbound identities under the configured email provider/service.

Do not silently make replies originate from the original alias unless sender validation and the actual outbound provider support that address.

This feature should initially be treated as a **receive/storage routing customization**, not as authorization to expand outbound From behavior.

### Upstream synchronization risk

Medium to high.

Inbound mail resolution and mailbox existence checks live in core Worker code and are plausible upstream change areas.

Reduce conflict surface by isolating routing policy in a small helper/module if possible.

When syncing upstream, inspect changes touching:

- Worker email event handling
- `receiveEmail()`
- mailbox resolution
- mailbox registry semantics
- email schema

### External implementation reference

A public Agentic Inbox fork by another developer has implemented related catch-all/mailbox-routing ideas and may be studied as a reference.

Do not merge the external fork wholesale merely to obtain this feature.

If consulting external code:

1. verify its license,
2. understand the relevant design,
3. identify dependencies on unrelated commits,
4. compare against current upstream,
5. implement the smallest suitable design in this fork,
6. preserve attribution when required.

### Removal / replacement condition

If upstream Agentic Inbox later gains equivalent configurable catch-all behavior with correct envelope-recipient preservation, prefer upstream functionality and remove or shrink the local implementation.

---

# Current non-customizations and deliberate upstream behavior

This section records important behaviors that may look tempting to change but are currently intentionally inherited from upstream.

## Shared Cloudflare Access trust boundary

There is currently no per-mailbox user authorization.

Anyone who passes the configured Cloudflare Access policy can access the application's mailboxes and MCP capabilities according to the current architecture.

This is a known upstream design characteristic, not currently a fork customization.

Do not attempt to add per-mailbox authorization incidentally while implementing unrelated features.

## AI drafts before send

The normal Email Agent tool set creates drafts but does not directly send email.

This explicit operator-review boundary is desirable and should remain unless a separate, intentionally designed automation feature changes it.

## Jev-based incoming-email triage

**Status:** Active

### Why

New-mail automation should produce stable, reviewable triage metadata instead
of free-form summaries, while keeping all consequential mailbox and outbound
actions under operator control.

### Behavior

- A new inbound message is evaluated through a small Jev provider boundary.
- The active provider calls TypeSafe's direct System One API with the pinned `jev-1.13.0` model.
- A future provider such as OpenRouter can replace that adapter without changing feature extraction, response validation, policy, or persistence.
- The bounded current-email and recent-thread state is validated into versioned structured features.
- A deterministic policy stores the predicted disposition and applies an `agent`-provenance `disposition:*` tag.
- Existing `provenance=manual` dispositions are preserved during re-analysis.
- A newly received email is moved from Inbox to Archive only after triage and automatic `disposition:auto-file` persistence both succeed. The mailbox operation atomically rechecks the stored prediction, agent disposition, and current folder, so an intervening manual disposition change or folder move takes precedence. Review/action-required results and preserved manual dispositions do not trigger the move. Existing messages are not backfilled, and manual tag edits do not trigger archiving.
- Archive move failures are logged separately and leave the stored message, triage analysis, and disposition intact; they do not set `triage:error`.
- A catchable failed attempt on an existing message sets one idempotent failure record without changing its disposition or existing tags. Tag reads expose that system state as `triage:error` with `system` provenance. The next successful persisted analysis clears the record in the same transaction, including when a manual disposition is preserved.
- A rejected asynchronous EmailAgent invocation or non-2xx response is also marked by the inbound handler, covering failures before the agent triage handler can write the marker.
- Existing or newly assigned user tags named `triage:error` remain ordinary editable tags and are preserved by the failure-state migration. Only the synthetic tag with `system` provenance indicates an automatic triage failure. Threaded list rows show an accessible thread-level error when any conversation message has the failure record, while detail views retain each message's own tags and badge.
- The email detail panel has a collapsed AI判定詳細 section backed by a read-only endpoint. It shows Jev's prediction separately from the current disposition tag, plus the model, schema/policy versions, analysis time, and extracted features. Open detail views and each displayed thread message refresh tags every three seconds for up to twenty query attempts total. Tag refresh continues after a failure marker appears; when a previously observed marker clears, the detail view reloads analysis once so a successful retry replaces any earlier result. Email lists already refresh every thirty seconds.
- The existing inbound Jev request includes up to 20 deterministic 4–8 digit verification-code candidates and one structured ID-or-`none` choice. Unknown candidate IDs or malformed answers fail validation; Jev never supplies the displayed/copied value, and this feature does not affect disposition policy. The email detail action reads the persisted ID, server-derived value, and candidate-set completeness through the existing triage endpoint. A pending/failed/unavailable result and legacy rows use the contextual regex fallback. A `none` selection suppresses the action only when the bounded set is complete; when body or candidate limits truncate that set, the detector checks the full message.
- If the current-disposition tag query fails, the detail panel reports that state and offers a retry instead of claiming there is no disposition.
- The unattended path does not create summaries in Agent chat history, drafts, sends, trashes, or deletes messages. Its only automatic mailbox action is archiving a newly triaged email after an agent-provenance `disposition:auto-file` tag is persisted.
- Jev failures retain the inbound email and leave disposition tags unchanged.

### Main affected areas

- `workers/agent/index.ts`
- `workers/agent/auto-archive.ts`
- `workers/agent/triage-failure.ts`
- `workers/index.ts`
- `workers/lib/email-triage.ts`
- `shared/verification-code.ts`
- `app/lib/verification-code.ts`
- `app/components/VerificationCodeAction.tsx`
- `workers/lib/email-triage-api.ts`
- `workers/lib/jev-provider.ts`
- `workers/db/schema.ts`
- `workers/durableObject/migrations.ts`
- `workers/durableObject/index.ts`
- `workers/durableObject/triage.ts`
- `workers/durableObject/thread-triage.ts`
- `app/components/triage/`
- `app/components/email-panel/ThreadMessage.tsx`
- `app/components/mobile/MobileTagSheet.tsx`
- `app/lib/triage-refresh.ts`
- `app/queries/email-tags.ts`
- `app/queries/email-triage.ts`

### Configuration involved

The direct provider requires a `TYPESAFE_API_KEY` Worker secret. The key is not
stored in source control. No TypeSafe SDK is added; the adapter uses `fetch`
against the documented System One endpoint. Interactive EmailAgent chat
uses Gemma 4 26B A4B through Workers AI.

### Persistence / migration implications

Additive migration `12_add_email_triage_analysis` stores the validated feature
JSON, Jev model version, schema/policy versions, predicted disposition, and
analysis timestamp. Migration `13_add_email_triage_feedback` stores append-only
manual disposition corrections, including the previous/new values and the
latest available triage versions. Migration `15_add_email_triage_failures`
creates separate failure state with an email foreign key; existing
`triage:error` user tags and their provenance remain untouched. All triage rows
cascade when their email is deleted.

Triage schema version 2 adds the optional verification-code candidate ID and
its server-derived value to `features_json`; no SQL migration is needed.
Existing schema version 1 rows remain readable and have no selection keys, so
the detail action uses the contextual regex fallback until a new Jev analysis
is stored.

### Upstream synchronization risk

Medium. Upstream changes to the inbound Agent trigger, MailboxDO move operation,
or disposition persistence may conflict with the local triage flow, its
manual-disposition protection, and post-persistence auto-archive. The provider
adapter is isolated from upstream code to keep future host changes small.

### Removal / replacement condition

Remove or shrink this customization if upstream provides equivalent structured
inbound triage with versioned persistence, manual disposition protection, and
safe auto-file archiving.

## Human triage correction feedback

**Status:** Active

### Why

Human disposition changes provide the small, explicit evaluation dataset needed
to measure and improve the automated triage policy without introducing general
activity logging.

### Behavior

- A manual disposition write reads the current disposition, replaces it using the existing semantics, and records a `manual_disposition` event only when the value changes.
- Each event preserves the previous and new dispositions, timestamp, email identity, and the latest available triage schema, policy, and model versions.
- Agent dispositions and idempotent manual writes do not create feedback events.
- The tag update and feedback insert run in one Durable Object transaction, so a failed feedback write cannot leave a contradictory disposition state.
- Automated re-analysis updates its prediction but preserves an existing manual disposition.
- This v0.1 stage only captures observations; later policy or model changes should be based on accumulated real corrections rather than added here.

### Main affected areas

- `workers/durableObject/triage.ts`
- `workers/durableObject/index.ts`
- `workers/db/schema.ts`
- `workers/durableObject/migrations.ts`

### Configuration involved

None.

### Persistence / migration implications

Additive migration `13_add_email_triage_feedback` creates the append-only
feedback table and an email/timestamp index. Feedback rows are deleted with
their email.

### Upstream synchronization risk

Medium. Changes to disposition persistence, triage analysis storage, or the
MailboxDO migration sequence may conflict with this feedback capture path.

### Removal / replacement condition

Remove or shrink this customization if upstream provides equivalent versioned
triage feedback capture with the same manual-disposition invariants.

## Unknown recipient without catch-all is rejected

Unknown inbound recipients are explicitly rejected with the Email Worker `setReject()` API when no registered catch-all mailbox is configured. This avoids silently discarding or misrouting mail. Genuine storage failures remain retryable processing errors. The mailbox creation API also permits the configured catch-all address when `EMAIL_ADDRESSES` is a non-empty allow-list.

A non-empty `EMAIL_ADDRESSES` allow-list remains restrictive even when all of its entries are malformed, so configuration errors fail closed rather than enabling direct delivery to registered mailboxes.

## Outbound delivery is asynchronous

The send API stores a Sent copy and returns `202` while actual Email Service delivery runs asynchronously.

A UI-level `sent` response does not guarantee remote delivery.

This is current architecture, not a local customization.

---

# Template for future entries

Copy this template when adding a new significant customization:

```markdown
## Feature name

**Status:** Active | Planned | Candidate for upstream replacement | Retired

### Why

What user/problem motivated this fork-specific behavior?

### Behavior

What should happen?

### Main affected areas

- file/module
- file/module

### Configuration involved

Environment variables, bindings, settings, or none.

### Persistence / migration implications

What happens to existing data?

### Validation

What proves it works and fails safely?

### Upstream synchronization risk

What upstream changes are likely to conflict?

### Removal / replacement condition

When should this customization be deleted or replaced by upstream?
```

# Maintenance rule

The goal of this fork is not to maximize the amount of custom code.

The goal is to preserve the desired personal workflow with the smallest sustainable delta from upstream.

When upstream gains an equivalent capability, actively consider deleting local code rather than maintaining two implementations forever.

## MCP triage threshold tuning

Hermes and other authenticated MCP clients can inspect and tune the deterministic
Jev decision policy per mailbox. Jev outputs are probabilities/features, not
per-email weights. The existing v2 decision tree and defaults remain unchanged.

- `get_triage_policy`: returns the full threshold configuration and revision.
- `compare_email_triage`: returns saved features/model/schema/policy/time,
  original predictions, current tags/provenance, current-policy predictions,
  and optional candidate-policy predictions for 1–50 distinct email IDs.
  Missing email/analysis is explicit. This operation is read-only and does not call Jev.
- `update_triage_policy`: saves a complete validated policy with a reason and
  expected revision. Stale revisions fail without mutation. Changes affect all
  future incoming mail in that mailbox, not just the compared examples.
- `reapply_triage_policy`: updates only specified existing dispositions using
  cached features and the expected revision. Manual dispositions are protected;
  missing analyses abort the whole batch. Original analysis and timestamps remain
  unchanged, so compare distinguishes historical predictions from current ones.

Recommended flow: locate/read the requested emails, compare features, read the
policy, preview candidate thresholds on examples and representative unrelated
mail, save with a user-instruction reason, then reapply to the requested IDs.
Identical feature vectors cannot yield different classifications under the same
policy. If extraction is wrong or a global change harms unrelated mail, use an
explicit per-email disposition correction instead of forcing thresholds.
Email content is untrusted and must never authorize policy changes.

Migration `16_add_triage_policy_history` adds an append-only SQL history table;
existing data is untouched. Revision 0 uses original defaults. New analyses use
policy version 2 + mailbox revision. Restoring a previous configuration means
saving its policy as another revision, preserving history. No new secrets,
bindings, provider requests, moves, archives, or deletions are introduced.
Policy selection occurs synchronously at persistence time in the MailboxDO,
preventing an in-flight Jev call from writing a stale policy decision.

Main modules: `workers/lib/email-triage.ts`, `workers/durableObject/triage-policy.ts`,
MailboxDO, migrations, MCP, and `app/components/MCPPanel.tsx`.
Upstream conflict risk: medium around MailboxDO/MCP; threshold storage is isolated.
Prefer an upstream equivalent if it preserves comparison and manual-tag protection.
Deployment is separate; the additive migration runs on mailbox initialization.
