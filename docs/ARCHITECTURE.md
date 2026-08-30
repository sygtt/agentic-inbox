# Architecture

This document describes the current architecture of this fork of Cloudflare's `agentic-inbox`.

It is intended primarily as a map for maintainers and AI coding agents. Read it before making architectural, persistence, routing, authentication, or cross-cutting changes.

When the implementation changes, update this document in the same branch.

## High-level overview

Agentic Inbox is a Cloudflare Workers application that combines a React web UI, an HTTP API, email receive/send handlers, per-mailbox Durable Objects, R2 storage, Cloudflare Access, Workers AI, and the Cloudflare Agents SDK.

```text
                         Cloudflare Access
                               |
                               v
+-------------+        +--------------------+
| Browser     |------->| workers/app.ts     |
| React UI    |        | Hono entrypoint    |
+-------------+        +---------+----------+
                                |
             +------------------+------------------+
             |                  |                  |
             v                  v                  v
       /api/v1/*          /agents/*             /mcp*
       Hono API           EmailAgent DO         EmailMCP DO
             |                  |                  |
             v                  v                  |
       MailboxDO          Workers AI              |
       SQLite                   |                  |
             |                  +------------------+
             |
             +---------> R2
                         mailbox settings
                         attachment blobs

Cloudflare Email Routing
             |
             v
      Worker email handler
             |
             v
        receiveEmail()
             |
             +-------> MailboxDO
             +-------> R2 attachments
             +-------> EmailAgent auto-draft trigger

Outbound UI/API
             |
             v
       send_email binding
             |
             v
      Cloudflare Email Service
```

## Runtime entrypoint

The Worker entrypoint is `workers/app.ts`, configured by `wrangler.jsonc`.

`workers/app.ts` is responsible for the top-level request pipeline:

1. Validate Cloudflare Access JWTs outside local development.
2. Expose the MCP endpoint at `/mcp` and `/mcp/*`.
3. Mount the Hono API from `workers/index.ts`.
4. Route `/agents/*` to Cloudflare Agents SDK Durable Objects.
5. Fall back to React Router for UI/SSR requests.
6. Export the Cloudflare Email Worker `email()` handler for inbound mail.

Order matters. MCP and agent routes must be registered before the React Router catch-all.

## Authentication boundary

Production authentication is enforced in `workers/app.ts` using Cloudflare Access.

The Worker expects two production secrets:

- `POLICY_AUD`
- `TEAM_DOMAIN`

The `cf-access-jwt-assertion` header is validated with `jose` against the Access JWKS endpoint and configured audience.

Local development skips Access validation through `import.meta.env.DEV`.

### Authorization model

Cloudflare Access is the trust boundary for the entire application.

There is currently no per-mailbox authorization. Any identity allowed through the shared Access policy can access all mailboxes and the MCP server.

Do not assume mailbox isolation is an authorization boundary. Mailbox Durable Objects isolate storage and state, not user permissions.

## Cloudflare bindings

`wrangler.jsonc` defines the primary runtime bindings.

| Binding / variable | Purpose |
| --- | --- |
| `MAILBOX` | `MailboxDO` namespace, one logical Durable Object per mailbox ID |
| `EMAIL_AGENT` | `EmailAgent` namespace, normally addressed by mailbox ID |
| `EMAIL_MCP` | `EmailMCP` Durable Object binding for MCP access |
| `BUCKET` | R2 bucket used for mailbox settings and attachment blobs |
| `AI` | Workers AI binding |
| `EMAIL` | `send_email` binding used for outbound delivery |
| `DOMAINS` | Comma-separated domains exposed to the application |
| `EMAIL_ADDRESSES` | Optional allow-list restricting mailbox creation and inbound matching |
| `POLICY_AUD` | Cloudflare Access audience secret |
| `TEAM_DOMAIN` | Cloudflare Access team/JWKS URL secret |

Deployment-specific values should not be embedded into reusable application logic.

## HTTP API

The primary HTTP API is implemented in `workers/index.ts` under `/api/v1`.

Major API areas include:

- configuration
- mailbox CRUD
- email listing and retrieval
- sending
- drafts
- read/star updates
- delete/move
- thread retrieval, read, and move operations
- reply/forward
- folders
- search
- attachment download
- email tag and disposition management

Email tag endpoints are mailbox-scoped and inherit the existing Cloudflare
Access and `requireMailbox` checks:

- `GET /api/v1/mailboxes/:mailboxId/emails/:id/tags`
- `PUT /api/v1/mailboxes/:mailboxId/emails/:id/tags` with `{ tag, provenance }`
- `DELETE /api/v1/mailboxes/:mailboxId/emails/:id/tags/:tag`
- `PUT /api/v1/mailboxes/:mailboxId/emails/:id/disposition` with `{ value, provenance }`

Tags use a conservative lowercase `namespace:value` format. Generic tag
updates cannot bypass disposition replacement; disposition values are limited
to `action-required`, `review`, `auto-file`, and `hold`.

Routes scoped to `/api/v1/mailboxes/:mailboxId/*` use `requireMailbox` middleware to resolve and validate the mailbox before operating on its Durable Object.

The browser UI normally talks to this same-origin API.

## Mailbox identity and registry

A mailbox is identified by its lower-case email address.

Creating a mailbox performs two distinct operations:

1. Store mailbox settings in R2 at:

   ```text
   mailboxes/<email-address>.json
   ```

2. Resolve `MAILBOX.idFromName(email)` and initialize the corresponding `MailboxDO`.

The R2 settings object acts as the current mailbox registry. A mailbox can have a Durable Object identity even if no registry object exists, so application code explicitly checks R2 when deciding whether a mailbox exists.

Mailbox settings currently include values such as display/from name, forwarding settings, signatures, auto-reply settings, and optional per-mailbox agent system prompt.

## Mailbox storage

Each mailbox maps to its own `MailboxDO` using the mailbox address as the Durable Object name.

`MailboxDO` uses SQLite-backed Durable Object storage through Drizzle ORM.

Primary tables are:

### `folders`

Stores built-in and custom folders.

### `emails`

Stores message metadata and body content, including:

- sender
- recipient
- SMTP envelope recipient, when received through Email Routing
- cc / bcc
- subject
- received/saved timestamp
- read/starred state
- body
- thread metadata
- original Message-ID
- raw parsed headers

### `attachments`

Stores attachment metadata only.

Attachment bytes are stored separately in R2.

### `email_tags`

Stores zero or more namespaced tags per email. Each `(email_id, tag)` pair is
unique and stores a constrained provenance value: `rule`, `agent`, or `manual`.
The four `disposition:*` values are mutually exclusive and are replaced
atomically when a new disposition is set.

## Durable Object migrations

Mailbox schema migrations are defined in `workers/durableObject/migrations.ts`.

The migration runner keeps a `d1_migrations` compatibility table and applies missing migrations during `MailboxDO` construction.

Current migrations include initial tables, threading fields, Drafts folder, Message-ID/raw-header storage, sent-mail read state, cc/bcc columns, query indexes, the nullable SMTP envelope-recipient column, and the additive email-tags table.

Schema changes are production-sensitive. Existing Durable Objects may already contain real data, so prefer additive migrations and test migration from an existing schema.

## R2 layout

R2 currently has two important responsibilities.

### Mailbox settings

```text
mailboxes/<mailbox-id>.json
```

These files are also used to determine whether a mailbox is registered.

### Attachment blobs

```text
attachments/<email-id>/<attachment-id>/<filename>
```

Attachment metadata is stored in the mailbox SQLite database while the actual content lives in R2.

Deleting an email removes its attachment blobs. Deleting a mailbox currently removes the R2 mailbox settings object but does not yet delete the corresponding Durable Object data or all mailbox-owned blobs; the API contains a TODO for that behavior.

## Inbound email flow

Inbound mail enters through the Worker `email()` handler in `workers/app.ts`, which calls `receiveEmail()` in `workers/index.ts`.

Current flow:

1. Resolve the mailbox from the SMTP envelope recipient and the optional `CATCH_ALL_MAILBOX` setting.
2. Confirm the selected storage mailbox registry object exists in R2, or explicitly reject a routing policy failure with `setReject()`.
3. Reject invalid or oversized raw message streams.
4. Parse the message with `postal-mime`.
5. Extract visible `To`, `Cc`, and `Bcc` addresses from the parsed message.
6. Resolve the mailbox Durable Object.
7. Store attachment blobs in R2.
8. Compute threading information.
9. Store the email in the mailbox SQLite database, preserving the envelope recipient separately from visible headers.
10. Trigger the corresponding `EmailAgent` asynchronously to generate a draft reply.

### Recipient resolution and catch-all behavior

The SMTP envelope recipient is the source of truth for routing. Visible `To`, `Cc`, and `Bcc` headers remain message metadata and are not rewritten.

When `EMAIL_ADDRESSES` is configured, addresses in that list retain direct-mailbox behavior. Unknown or non-allow-listed recipients are routed to the registered `CATCH_ALL_MAILBOX` when it is configured. When catch-all is empty, unknown recipients are rejected so they are not silently stored in an unrelated mailbox.

A non-empty `EMAIL_ADDRESSES` value remains restrictive even if its entries are malformed; invalid configuration cannot disable the allow-list by normalization alone.

The mailbox creation API permits the configured catch-all address in addition to an explicit `EMAIL_ADDRESSES` allow-list, so a fresh environment can register the catch-all mailbox before receiving mail.

The config API exposes the catch-all mailbox to the home screen, which includes it in the mailbox picker and auto-creation flow. Search queries match `envelope_recipient` for both free-text and `to:` searches.

The home screen protects the configured catch-all mailbox from deletion. When only catch-all routing is configured, other explicitly created mailboxes remain manageable.

The original envelope recipient is stored in `emails.envelope_recipient`. The Durable Object and Agent scope is the storage mailbox, which may be the catch-all mailbox.

If the selected mailbox is not registered, or `CATCH_ALL_MAILBOX` is invalid or unregistered, the email handler explicitly rejects the message with `setReject()`. Genuine storage or processing failures are rethrown so Email Routing can retry them.

## Threading

Inbound threading uses standard email headers when available:

- `Message-ID`
- `In-Reply-To`
- `References`

The first reference, `In-Reply-To`, or the new internal message ID is used as the initial `thread_id`.

For messages without threading headers, the mailbox Durable Object can fall back to subject/sender-based conversation discovery.

Thread list queries contain additional subject-normalization fallback logic for legacy messages without explicit thread IDs. Thread-level read operations use the same fallback so a legacy subject-grouped conversation is handled as one conversation. Thread moves are scoped to the source folder, preserving Sent and Draft copies that share the same conversation.

## Outbound email flow

Outbound email is handled by the mailbox email POST API and `workers/email-sender.ts`.

Current behavior is important to understand:

1. Validate that the sender matches the selected mailbox.
2. Generate internal and outbound Message-IDs.
3. Check per-mailbox send rate limiting.
4. Store attachments.
5. Create a copy in the mailbox `Sent` folder.
6. Start Email Service delivery with `executionCtx.waitUntil()`.
7. Immediately return HTTP `202` with `status: "sent"`.

Because delivery is deferred, a successful API/UI response means the application accepted and queued the send attempt. It does **not** prove remote delivery succeeded.

Deferred delivery failures are currently logged with `console.error` after the API response has already been returned.

This distinction should be preserved in UI/observability work unless the send architecture is intentionally redesigned.

## AI agent architecture

Each mailbox has an `EmailAgent` Durable Object addressed by mailbox ID.

`EmailAgent` extends `AIChatAgent` from `@cloudflare/ai-chat` and uses Workers AI through `workers-ai-provider`.

The current default model is configured in code in `workers/agent/index.ts`.

The agent has tools for operations including:

- listing messages
- reading a message
- loading a full thread
- searching messages
- creating a new draft
- creating a reply draft
- marking messages read/unread
- moving messages
- discarding drafts

The default agent policy is draft-oriented. The agent does not receive a direct send tool in its normal tool set; sending remains an explicit operator/UI action.

### Auto-draft flow

After a new message is persisted, the inbound handler asynchronously POSTs to the matching `EmailAgent` at `/onNewEmail`.

The agent reads the relevant message/thread context and attempts to create a draft reply. Auto-draft failure is logged but does not roll back the already stored inbound message.

### Prompt safety

AI logic includes draft verification and prompt-injection-related helpers. AI output must still be considered untrusted and must not be used as an authentication, authorization, or deterministic routing signal.

## MCP

`EmailMCP` is exposed under `/mcp` and `/mcp/*`.

It is protected by the same top-level Cloudflare Access middleware as the rest of the production application.

Because there is no per-mailbox authorization, an MCP client that passes Access can potentially operate across mailboxes when given mailbox identifiers. Treat MCP credentials and Access policy scope accordingly.

MCP `get_email` and `get_thread` responses expose normalized readable text in
the `body` and `body_text` fields. When the stored representation is retained,
it is exposed as `body_html`; database persistence and browser/API body
rendering remain unchanged.

MCP email list, search, single-email, and thread responses retain the existing
`folder_id` as the current folder and add a `tags` array containing `{ tag,
provenance }` objects. The `set_email_disposition` tool accepts only
`action-required`, `review`, `auto-file`, or `hold`; it replaces the previous
disposition and records the new tag with `agent` provenance without taking any
other action.

Email list and search results derive their `snippet` from normalized readable
text, then truncate it to the list limit. Stored email bodies and pagination
semantics are unchanged.

## Frontend architecture

The frontend lives under `app/` and is built with:

- React 19
- React Router v7
- Tailwind CSS
- Zustand
- TanStack Query
- TipTap
- Cloudflare Kumo components

Important areas:

```text
app/components/   reusable UI and email-client components
app/hooks/        client hooks and UI state behavior
app/queries/      TanStack Query definitions
app/routes/       React Router route modules
app/services/     API-facing client services
app/types/        frontend types
app/root.tsx      root layout/providers
app/routes.ts     route configuration
```

The React application and API are served from the same Worker/origin.

At viewport widths below `md`, `app/routes/mailbox.tsx` supplies the mailbox
identity bar and safe-area-aware bottom navigation. The mobile layer under
`app/components/mobile/` renders real list rows, pointer gestures, quick/tag
sheets, and the narrow detail view while reusing the same TanStack Query and
Zustand state as the desktop split view. Threaded list requests support the
server-side `needs_reply` filter and thread-level read/move mutations. The
mobile folders route uses the existing folder API; search remains server-side
through `useSearchEmails`.

## Important files by responsibility

| Responsibility | Main files |
| --- | --- |
| Worker request entrypoint / auth / SSR | `workers/app.ts` |
| HTTP API and inbound-email orchestration | `workers/index.ts` |
| Mailbox persistence and querying | `workers/durableObject/index.ts` |
| Mailbox schema | `workers/db/schema.ts` |
| Mailbox migrations | `workers/durableObject/migrations.ts` |
| AI mailbox agent | `workers/agent/index.ts` |
| Outbound message construction/delivery | `workers/email-sender.ts` |
| Reply/forward endpoints | `workers/routes/reply-forward.ts` |
| Shared email helpers | `workers/lib/email-helpers.ts` |
| Agent tools | `workers/lib/tools.ts` |
| R2 attachment helpers | `workers/lib/attachments.ts` |
| Runtime bindings | `wrangler.jsonc` |
| Frontend | `app/` |
| Shared folder constants | `shared/folders.ts` |

## Architectural invariants

When modifying this repository, preserve these invariants unless the task explicitly changes them:

1. Production requests fail closed when Cloudflare Access is missing or invalid.
2. Mailbox identity is deterministic and lower-case.
3. Mailbox persisted state is isolated by Durable Object identity.
4. Attachment metadata and attachment bytes remain consistent across SQLite and R2.
5. Original email provenance must not be discarded for routing convenience.
6. AI decisions are not security decisions.
7. AI-created replies remain drafts until an explicit send action.
8. Runtime customization should remain as small as practical to ease upstream synchronization.

## Known architectural pressure points

These areas deserve extra care because they are likely customization or conflict hotspots:

- inbound recipient/mailbox resolution
- future catch-all behavior
- R2 mailbox registry semantics
- Durable Object migrations
- threading logic
- Cloudflare Access middleware
- outbound delivery status semantics
- AI model/tool configuration
- per-mailbox versus application-wide authorization

If upstream changes one of these areas, inspect the change before resolving merge conflicts.
