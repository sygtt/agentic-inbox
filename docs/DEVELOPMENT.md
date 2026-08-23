# Development

This document describes the recommended local development workflow for this fork of Cloudflare's `agentic-inbox`.

It complements `AGENTS.md`. The rules in `AGENTS.md` take priority when there is any conflict.

## Branch model

Use the branch structure defined in `AGENTS.md`:

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

- `main` tracks upstream as closely as practical.
- `develop` is the integration and production-deployment branch for this fork.
- Feature and maintenance work should normally start from `develop`.

For documentation-only work, use a `docs/*` branch.

## Git remotes

A typical local setup is:

```bash
git remote -v
```

with:

```text
origin    <your fork>
upstream  https://github.com/cloudflare/agentic-inbox.git
```

If `upstream` is missing:

```bash
git remote add upstream https://github.com/cloudflare/agentic-inbox.git
```

Do not rewrite upstream history.

## Updating from upstream

A conservative synchronization flow is:

```bash
git fetch upstream
git switch main
git merge --ff-only upstream/main
git push origin main

git switch develop
git merge main
```

If `main` cannot fast-forward cleanly, inspect why before changing history.

Resolve fork-specific conflicts in `develop`, not by turning `main` into a long-lived customization branch.

Before resolving a conflict involving known local behavior, read `docs/CUSTOMIZATIONS.md`.

## Creating a work branch

Start from an up-to-date `develop`:

```bash
git switch develop
git pull --ff-only origin develop
git switch -c feat/example-feature
```

Use the prefix appropriate to the work:

```text
feat/
fix/
refactor/
docs/
chore/
```

Keep one branch focused on one logical change.

## Prerequisites

The repository is a Node/npm project using Vite, React Router, Wrangler, and the Cloudflare Vite plugin.

Install:

- Git
- Node.js
- npm

The repository currently does not declare an `engines` field that pins an exact Node.js version. Prefer a maintained Node.js version compatible with the current dependency set and Cloudflare tooling rather than silently changing runtime versions as part of unrelated work.

## Install dependencies

```bash
npm install
```

The project uses `package-lock.json`. Avoid regenerating the lockfile unless dependencies actually change.

## Main npm commands

Current scripts include:

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
npm run cf-typegen
npm run deploy
```

### `npm run dev`

Starts the React Router development server through Vite with the Cloudflare Vite plugin.

The plugin is configured in `vite.config.ts` with a Cloudflare SSR environment, so Worker bindings and server-side code can run in the Cloudflare-compatible development environment.

### `npm run build`

Builds the React Router application.

### `npm run preview`

Builds first, then serves the built Vite application for preview.

### `npm run typecheck`

Runs Cloudflare type generation, React Router type generation, and TypeScript project checking.

This is part of the minimum validation required by `AGENTS.md`.

### `npm run deploy`

Builds and deploys with Wrangler.

**Do not run this as part of normal implementation or verification unless production deployment was explicitly requested.**

## Local environment variables

The repository contains `.dev.vars.example` with placeholders for Cloudflare Access values:

```text
POLICY_AUD=your-access-policy-audience-tag
TEAM_DOMAIN=https://your-team.cloudflareaccess.com
```

If a local task needs the file, copy it rather than editing the example with real credentials:

```bash
cp .dev.vars.example .dev.vars
```

Do not commit `.dev.vars`.

### Cloudflare Access in local development

`workers/app.ts` intentionally skips Access JWT validation when `import.meta.env.DEV` is true.

Therefore local UI/API development normally does not require working production Access credentials.

Do not weaken the production Access middleware to make local development easier.

## Wrangler configuration

`wrangler.jsonc` is the central Cloudflare binding configuration.

It defines:

- Worker entrypoint
- Durable Object bindings
- Durable Object class migrations
- R2 binding
- Workers AI binding
- `send_email` binding
- application variables

Before changing it, determine whether the requested setting is:

1. reusable application configuration, or
2. deployment-specific/private configuration.

Prefer keeping production-specific values out of committed reusable logic.

### Existing deployment-specific divergence

This fork currently contains a deployment-specific `DOMAINS` value in `wrangler.jsonc` instead of the generic upstream example value.

Treat this as existing configuration debt, not as a pattern to follow for new personal values.

Future configuration work should prefer a maintainable way to keep public source generic while supplying production values through the deployment environment where practical.

Do not change that behavior incidentally while working on unrelated features.

## Cloudflare resources used by development

The application is built around several bindings:

```text
MAILBOX      -> MailboxDO
EMAIL_AGENT  -> EmailAgent
EMAIL_MCP    -> EmailMCP
BUCKET       -> R2
AI           -> Workers AI
EMAIL        -> send_email
```

When debugging a feature, first identify which binding participates in the failing path.

### Durable Objects

`MailboxDO` uses SQLite-backed Durable Object storage.

Do not assume a local fresh database accurately represents production upgrade behavior. Any schema change must also be reasoned about as a migration from an existing deployment.

### R2

R2 stores:

- mailbox settings/registry objects
- attachment bytes

Changes to R2 key layout should be treated as persistence migrations even if no SQL schema changes.

### Workers AI

The email agent uses the Workers AI binding directly. No separate OpenAI/Anthropic-style API token is required by the current default architecture.

Model availability and pricing can change independently of this repository. Do not change models casually as part of unrelated work.

### Email sending

The application uses a `send_email` binding named `EMAIL`.

The API currently records the Sent copy before deferred delivery completes, so a local or UI success state is not proof of final remote delivery.

When debugging send behavior, inspect Worker logs as well as the recipient mailbox.

## Local testing strategy

The repository currently has no general `npm test` script in `package.json`.

Do not invent a passing test result.

For every change, at minimum run:

```bash
npm run typecheck
npm run build
```

Then add focused verification appropriate to the changed subsystem.

## UI changes

For frontend work:

1. run `npm run dev`,
2. exercise the relevant route manually,
3. check loading state,
4. check normal state,
5. check empty state,
6. check error behavior,
7. check browser console/network errors.

Avoid changing backend behavior merely to make a UI mock easier.

## API changes

For API work:

- inspect the request schema and middleware,
- verify successful requests,
- verify malformed requests,
- verify missing mailbox behavior,
- verify status codes,
- verify that persisted state matches the response.

Remember that mailbox-scoped routes use mailbox resolution middleware.

## Email routing changes

Inbound email routing is production-sensitive.

The current implementation does not provide a dedicated repository-level integration harness that fully reproduces Cloudflare Email Routing delivery.

For routing changes:

1. isolate routing/resolution logic into testable deterministic functions where practical,
2. test known mailbox behavior,
3. test unknown recipient behavior,
4. test Bcc/alias/envelope-recipient cases relevant to the change,
5. test malformed input,
6. test failure behavior,
7. only perform a live Email Routing test when explicitly authorized.

Do not use real personal message contents as committed fixtures.

Use synthetic examples such as:

```text
sender@example.net
alias@example.com
all@example.com
```

## Catch-all development notes

The planned catch-all feature is especially sensitive to the distinction between:

- SMTP envelope recipient, and
- visible `To` / `Cc` headers.

Before implementing catch-all routing, re-read the inbound flow in `docs/ARCHITECTURE.md` and the requirement in `docs/CUSTOMIZATIONS.md`.

The desired design should preserve the original envelope recipient even if the storage mailbox is different.

Do not simply replace `recipient` metadata with the catch-all mailbox address.

## Database/migration development

Before changing `workers/db/schema.ts`:

1. inspect `workers/durableObject/migrations.ts`,
2. decide whether a new migration is required,
3. preserve old data,
4. prefer additive changes,
5. test the migration path conceptually and, where possible, against an existing local database state.

Updating only the Drizzle schema is not sufficient for an already deployed Durable Object.

## AI-agent development

The agent implementation lives primarily in `workers/agent/index.ts` and tool helpers under `workers/lib/`.

When changing AI behavior:

- keep deterministic security/routing logic outside the model,
- preserve the explicit draft-before-send boundary,
- inspect the full tool set,
- define fallback behavior,
- consider prompt injection and untrusted email content,
- avoid sending unnecessary message contents to additional providers.

If changing the model, system prompt, or tool capabilities, document the behavioral reason in `docs/CUSTOMIZATIONS.md` when it is fork-specific.

## Debugging order

For a confusing bug, trace the system in this order instead of editing randomly:

```text
request/email event
        |
        v
workers/app.ts
        |
        +--> authentication / route selection
        |
        v
workers/index.ts or agent/MCP handler
        |
        v
MailboxDO / EmailAgent / R2 / Email Service
        |
        v
frontend query/state/rendering
```

Ask:

1. Did the request/event reach the Worker?
2. Did authentication pass?
3. Which route/handler received it?
4. Which mailbox ID was resolved?
5. Was R2 state present?
6. Was the expected Durable Object addressed?
7. Was data actually persisted?
8. Did an asynchronous `waitUntil()` task fail after the response?
9. Is the frontend rendering stale cached data?

This usually narrows failures faster than speculative edits.

## Validation before commit

At minimum:

```bash
npm run typecheck
npm run build
git status
git diff
```

Review the diff for:

- secrets
- personal identifiers
- real email contents
- production domains or infrastructure values introduced unnecessarily
- unrelated formatting
- accidental lockfile changes
- generated files

## Commit style

Keep commits small and descriptive.

Examples:

```text
feat: add catch-all mailbox resolution
fix: preserve envelope recipient metadata
docs: document inbound email architecture
test: cover unknown recipient fallback
```

Do not mix broad refactoring with a behavior change unless the refactor is strictly necessary.

## Pull requests

Target normal fork development PRs at `develop`.

A useful PR description should state:

- problem
- behavior before
- behavior after
- important design decisions
- files/areas changed
- migration/configuration impact
- validation performed
- upstream conflict risk

Do not deploy merely because a PR was merged.

## Production deployment checklist

Only use this section when deployment was explicitly requested.

Before deploying:

1. confirm the intended branch/commit,
2. run `npm run typecheck`,
3. run `npm run build`,
4. inspect `git diff` / working tree,
5. review schema and Durable Object migrations,
6. review `wrangler.jsonc` and bindings,
7. confirm required Worker secrets exist,
8. confirm Cloudflare Access still protects the Worker,
9. confirm Email Routing targets the intended Worker,
10. confirm any send-email plan/binding assumptions,
11. deploy,
12. check Worker logs,
13. perform a controlled smoke test.

Production deployment is a separate operation from code completion.

## Keeping these docs useful

Update this file when any of the following changes:

- npm commands
- required local tooling
- environment setup
- Cloudflare development setup
- testing strategy
- branch workflow
- deployment procedure

Do not let this document become a historical log. Historical rationale for fork-specific features belongs in `docs/CUSTOMIZATIONS.md`.
