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
- The four `disposition:*` workflow values are mutually exclusive and replaced atomically.
- Mailbox-scoped HTTP endpoints support reading, upserting, removing tags, and setting disposition.
- MCP email reads expose `folder_id` and structured tag provenance, and the
  `set_email_disposition` tool records one of the four agent triage outcomes.
- Tag input is constrained to lowercase `namespace:value` strings with conservative length limits.
- Folder behavior, authentication, and email body storage remain unchanged.

### Main affected areas

- `workers/db/schema.ts`
- `workers/durableObject/migrations.ts`
- `workers/durableObject/index.ts`
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

Issues #3 and #17 add a deliberately small mobile workflow for checking incoming mail,
copying verification codes, deleting messages from the list, and opening links
without introducing a separate mobile client or new persistence.

### Behavior

- Contextual 4–8 digit verification codes are shown with a Clipboard API copy action.
- Plain-text `http`/`https` URLs are converted to links after escaping the input.
- Existing HTML mail continues through the sandboxed DOMPurify iframe path.
- Email deletion is available as a touch-friendly list action and uses the existing confirmation/API flow.
- The web app declares a standalone manifest using the repository's generic favicon.
- No service worker or offline mailbox support is added.
- At phone widths, the mailbox uses a safe-area-aware bottom navigation for Inbox, Folders, Search, and Settings while retaining the desktop sidebar and split view at `md` and above.
- Mobile inbox and search rows use real email data, server-side search, deterministic `needs_reply`/draft/OTP signals, and pointer gestures for archive/read actions. Long press exposes only real quick actions.
- Mobile detail reuses the existing thread, body, attachment, reply, move, star, delete, and structured tag/disposition flows; it does not add mock summaries, Snoozed, Mute, or Pin state.
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

## Trash-first deletion and 30-day retention

**Status:** Active

### Why

Normal deletion should be recoverable while preserving the existing mailbox
storage model and attachment provenance.

### Behavior

- UI deletion moves regular messages to Trash and retains SQLite metadata and R2 attachments.
- Permanent deletion is guarded to Trash; draft discard remains permanent.
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

**Status:** Active

### Why

The fork needs to consume upstream updates while also carrying production customizations.

Using `main` for both purposes would make upstream synchronization and production history harder to reason about.

### Behavior

The intended branch flow is:

```text
upstream/main
      |
      v
    main
      |
      v
   develop
      |
      +--> feat/*
      +--> fix/*
      +--> refactor/*
      +--> docs/*
      +--> chore/*
```

- `main` should remain close to upstream.
- `develop` is the fork integration branch and intended production-deployment branch.
- normal work occurs on focused branches from `develop`.

### Main affected areas

Git workflow and deployment process.

### Configuration involved

Cloudflare/GitHub deployment settings may need to target `develop` rather than `main` when branch-based deployment is used.

### Persistence / migration implications

None directly.

### Upstream synchronization risk

Low, provided `main` remains clean and runtime customizations stay on `develop`.

### Removal / replacement condition

Only change this model deliberately and update `AGENTS.md` and `docs/DEVELOPMENT.md` at the same time.

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
- auto-summary trigger targets the storage mailbox intentionally

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

## Automatic incoming-email summaries

**Status:** Active

### Why

New-mail automation should provide triage context without creating outbound
content or changing mailbox state without operator intent.

### Behavior

- A new inbound message triggers a summary in the storage mailbox's Agent chat history.
- The unattended agent receives only `get_email` and `get_thread` read tools.
- It does not create reply drafts, send mail, move messages, or delete messages.
- Prompt-injection detection blocks the summary attempt while retaining the inbound message.

### Main affected areas

- `workers/agent/index.ts`
- `workers/lib/ai.ts`

### Configuration involved

None. The summary prompt is fixed and does not use the interactive mailbox
system prompt, so mailbox-specific instructions cannot expand unattended
capabilities.

### Persistence / migration implications

None. Summaries are stored in the existing Agent chat history; email and mailbox
schemas are unchanged.

### Upstream synchronization risk

Medium. Upstream changes to the inbound Agent trigger or agent tool construction
may reintroduce automatic draft creation or broaden the unattended tool set.

### Removal / replacement condition

Remove this customization if upstream provides an equivalent operator-safe
incoming-email summarization flow.

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
