# AGENTS.md

## Purpose

This repository is a personal fork of Cloudflare's `agentic-inbox`.

The goals of this fork are:

1. Stay reasonably close to the upstream `cloudflare/agentic-inbox`.
2. Add personal-use features while keeping upstream synchronization manageable.
3. Use AI coding agents such as Codex and ChatGPT as primary development assistants.
4. Keep the repository safe to publish publicly.
5. Prefer small, understandable, reversible changes over large speculative rewrites.
6. Preserve the reasoning behind local customizations so future agents can understand why they exist.

This repository may be deployed to a real Cloudflare production environment and may process real email.

Treat changes involving email routing, authentication, persisted data, Cloudflare configuration, and deployment as production-sensitive.

---

# 1. Repository Documentation Structure

This repository uses the following documentation structure:

```text
AGENTS.md
├─ mandatory rules for AI agents
├─ branch and Git workflow
├─ security rules
├─ validation requirements
└─ upstream synchronization policy

docs/
├─ ARCHITECTURE.md
│  └─ architecture and data-flow reference for AI agents
├─ DEVELOPMENT.md
│  └─ local development, testing, and environment setup
└─ CUSTOMIZATIONS.md
   └─ local changes from upstream and the reasons they exist
```

These documents have different responsibilities.

## `AGENTS.md`

This file contains mandatory rules that AI agents must follow.

It should remain relatively stable and should not become a detailed architecture manual.

Do not move temporary implementation details into this file unless they represent a long-term rule.

## `docs/ARCHITECTURE.md`

This file describes how Agentic Inbox currently works.

It should document topics such as:

* request flow
* email receive flow
* mailbox resolution
* Worker entrypoints
* APIs/routes
* Durable Objects
* SQLite/database usage
* R2 storage
* Workers AI
* Agents SDK
* Cloudflare Access
* important module ownership

Before making architectural or cross-cutting changes, read this file.

If implementation changes make the architecture documentation incorrect, update it as part of the same change.

## `docs/DEVELOPMENT.md`

This file describes how to work on the repository locally.

It should contain:

* required tools
* installation steps
* local environment setup
* local Cloudflare bindings
* development commands
* testing commands
* preview procedures
* debugging notes
* safe local alternatives to production services

Before changing development tooling or setup, read this file.

If development requirements change, update it.

## `docs/CUSTOMIZATIONS.md`

This file records intentional differences between this fork and upstream.

Each significant customization should describe:

* feature name
* motivation
* expected behavior
* affected modules
* configuration involved
* migration implications
* upstream conflict risk
* whether upstream now provides an equivalent feature

Example:

```markdown
## Catch-all mailbox routing

### Why

Allow arbitrary service-specific recipient addresses while collecting
unknown recipients in one configurable mailbox.

### Behavior

Explicitly configured mailboxes keep normal routing.

Unknown recipients are stored in the configured catch-all mailbox while
preserving the original SMTP envelope recipient.

### Main affected areas

- email routing
- mailbox resolution
- configuration

### Upstream synchronization risk

Changes to upstream mailbox resolution may conflict with this customization.
```

Before modifying existing custom behavior, read this file.

When adding, removing, or significantly changing a customization, update this file in the same branch.

The purpose is to prevent future agents from deleting intentional behavior simply because it appears unusual.

---

# 2. Mandatory AI Agent Rules

Before making any change:

1. Read this `AGENTS.md`.
2. Read any relevant documentation under `docs/`.
3. Inspect the current implementation.
4. Understand the existing data flow.
5. Identify the smallest coherent change.
6. Consider public-repository safety.
7. Consider upstream compatibility.
8. Consider production impact.

Do not assume architecture or behavior from memory.

Always inspect the current code.

Do not silently expand the requested scope.

Do not deploy automatically after implementation.

---

# 3. Branch Strategy

Use the following branch model:

```text
upstream/main
      ↓
    main
      ↓
   develop
      ↓
 feat/*
 fix/*
 refactor/*
 docs/*
 chore/*
```

## `main`

`main` exists primarily to track the upstream `cloudflare/agentic-inbox`.

Do not add personal features directly to `main`.

Keep the difference between `main` and `upstream/main` as small as practical.

The preferred update flow is:

```text
upstream/main
      ↓
    main
      ↓
   develop
```

Resolve customization conflicts in `develop`, not by unnecessarily modifying upstream history.

## `develop`

`develop` is the integration branch for this fork.

It is also the branch intended for production deployment.

Stable customizations are merged into `develop`.

Do not implement non-trivial features directly on `develop`.

## Feature branches

Create feature branches from `develop`.

Use prefixes such as:

```text
feat/<name>
fix/<name>
refactor/<name>
docs/<name>
chore/<name>
```

Examples:

```text
feat/catch-all-mailbox
feat/mailbox-rules
fix/email-routing
refactor/mailbox-resolver
docs/update-architecture
```

Keep each branch focused on one logical change.

---

# 4. AI Development Workflow

Use four phases for non-trivial work.

## Phase 1: Investigate

Inspect the current implementation.

Identify:

* current behavior
* responsible modules
* relevant callers
* relevant consumers
* state ownership
* persistence boundaries
* Cloudflare bindings involved
* potential upstream conflicts
* relevant existing customization documentation

Do not begin with trial-and-error edits.

For non-trivial tasks, summarize findings before implementation.

## Phase 2: Plan

Create a short implementation plan.

Include:

* files likely to change
* files likely to be added
* data/schema impact
* configuration impact
* expected behavior
* failure behavior
* testing strategy
* upstream compatibility considerations

Prefer plans that can be implemented incrementally.

## Phase 3: Implement

Make the smallest complete change that satisfies the requirement.

Preserve existing project conventions.

Do not:

* perform unrelated refactors
* mass rename symbols
* reformat unrelated files
* change unrelated dependencies
* redesign working systems without a requirement
* silently add extra features

If implementation reveals a larger architectural problem, stop and report it before substantially expanding scope.

## Phase 4: Verify

Compilation is necessary but not sufficient.

At minimum run:

```bash
npm run typecheck
npm run build
```

Run relevant tests when available.

Verify both:

* expected success behavior
* expected fallback/error behavior

Do not claim a feature works merely because it builds.

---

# 5. Development Philosophy

## Prefer minimal patches

Prefer the smallest coherent patch.

This repository must remain reasonably easy to synchronize with upstream.

When several implementations are possible, prefer the one that:

1. modifies fewer upstream files,
2. introduces fewer schema changes,
3. preserves existing interfaces,
4. isolates local behavior where practical,
5. is easy to remove if upstream gains equivalent functionality.

Avoid customization for customization's sake.

## Understand before editing

Before changing a subsystem, determine:

* who owns the behavior,
* where data enters,
* where data is transformed,
* where data is persisted,
* where configuration comes from,
* what consumes the result.

Then modify it.

## Preserve reasons, not only code

A local customization that has no documented reason becomes technical debt very quickly.

Significant intentional differences from upstream must be recorded in:

```text
docs/CUSTOMIZATIONS.md
```

---

# 6. Public Repository Security

Assume every committed file becomes public immediately.

Never commit:

* Cloudflare API tokens
* private API keys
* passwords
* SMTP credentials
* OAuth secrets
* authentication cookies
* Access JWTs
* real private email contents
* production credentials
* `.dev.vars`
* local environment files containing secrets

Before committing, inspect the diff for accidental disclosure.

## Personal configuration

Avoid committing personal deployment values unless there is a strong reason.

Prefer placeholders such as:

```text
example.com
user@example.com
all@example.com
<ACCOUNT_ID>
<API_TOKEN>
<TEAM_DOMAIN>
<POLICY_AUD>
```

Do not hard-code personal production configuration when an environment variable, Worker binding, Secret, or configuration file can provide it.

This includes values such as:

* production domains
* personal mailbox addresses
* account identifiers
* infrastructure hostnames
* private IP addresses

A domain name is not necessarily a secret, but there is usually no reason to bind reusable application logic to a personal deployment value.

---

# 7. Configuration Rules

Prefer configurable behavior over hard-coded personal behavior.

Examples of appropriate configuration concepts include:

```text
DOMAINS
CATCH_ALL_MAILBOX
DEFAULT_MAILBOX
```

Committed examples should normally use generic values:

```text
example.com
all@example.com
me@example.com
```

Production values belong in Cloudflare configuration.

Do not introduce a new environment variable unnecessarily when existing configuration already represents the same concept.

---

# 8. Cloudflare Production Safety

This project uses services such as:

* Cloudflare Workers
* Durable Objects
* SQLite-backed storage
* R2
* Workers AI
* Email Routing
* Cloudflare Access
* Email Sending

Treat mutations to production resources as separate from code development.

Do not execute commands such as:

```bash
npm run deploy
wrangler deploy
wrangler delete
wrangler secret delete
```

unless the user explicitly requests production modification.

Implementation completion does not imply deployment permission.

Never automatically deploy after committing or merging code.

---

# 9. Email Handling Rules

Email is untrusted external input.

When modifying email handling:

1. preserve the original sender,
2. preserve the original recipient,
3. preserve the SMTP envelope recipient,
4. preserve useful debugging metadata,
5. avoid routing loops,
6. handle malformed messages safely,
7. avoid silently discarding mail,
8. do not trust user-controlled mail headers for authorization.

The SMTP envelope recipient and the visible `To` header are not equivalent.

Do not treat them as interchangeable.

## Catch-all behavior

If catch-all routing is implemented:

* explicitly configured mailboxes should retain their intended behavior,
* unknown addresses may be routed to a configurable catch-all mailbox,
* the original envelope recipient must still be preserved,
* catch-all routing must not rewrite away provenance information.

Define behavior for:

* explicit mailbox
* unknown mailbox
* catch-all mailbox
* invalid domain
* malformed recipient
* duplicate delivery
* storage failure
* routing failure

---

# 10. Authentication and Cloudflare Access

Authentication failures must fail closed.

Do not weaken production authentication to simplify development.

Never:

* disable JWT validation in production,
* trust unsigned identity claims,
* expose mailbox APIs without intended authentication,
* commit Access credentials,
* silently fall back to unauthenticated access.

Development authentication bypasses, if needed, must be:

* explicit,
* isolated,
* documented,
* impossible to enable accidentally in production.

---

# 11. Database and Durable Object Safety

Assume production data already exists.

Never assume a clean or empty database.

Before modifying persisted structures:

1. inspect current schema,
2. inspect existing migrations,
3. determine migration requirements,
4. determine backward compatibility,
5. consider rollback behavior.

Prefer additive migrations.

Avoid destructive schema changes unless explicitly approved.

Do not casually:

* delete fields,
* rename persisted columns,
* change identifiers,
* change mailbox identity semantics.

If persistence behavior changes, document it in `docs/ARCHITECTURE.md` and, when it represents fork-specific behavior, `docs/CUSTOMIZATIONS.md`.

---

# 12. AI Feature Safety

Treat AI-generated output as untrusted.

AI features may assist with:

* classification
* summarization
* search
* drafting
* triage

Do not use model output directly for security decisions.

Prefer deterministic logic for:

* authentication
* authorization
* recipient resolution
* persistence identity
* destructive decisions

AI must not automatically perform consequential external actions without an explicitly designed approval model.

Examples include:

* sending email
* deleting email
* forwarding email
* changing accounts
* modifying external resources

When adding AI behavior:

1. define fallback behavior,
2. minimize unnecessary data exposure,
3. document provider/model assumptions,
4. separate deterministic behavior from probabilistic behavior where practical.

---

# 13. Dependencies

Before adding a dependency:

1. check whether an existing dependency already provides the capability,
2. evaluate maintenance status,
3. keep dependency surface small,
4. explain why it is needed.

Do not upgrade unrelated dependencies as part of feature work.

Do not regenerate lockfiles unnecessarily.

---

# 14. Testing and Validation

Validation should be proportional to risk.

## Minimum validation

Run:

```bash
npm run typecheck
npm run build
```

## Email routing changes

Prefer tests covering:

* known mailbox routing
* unknown recipient routing
* catch-all routing
* original-recipient preservation
* malformed recipient
* incorrect domain
* fallback behavior
* routing failures

## UI changes

Verify:

* loading state
* normal state
* empty state
* error state

## Schema changes

Test migration from existing data.

Do not validate only against a fresh empty database.

## Authentication changes

Verify both:

* valid authenticated request
* invalid or missing credentials

---

# 15. Git Practices

Never commit directly to `main`.

Avoid direct feature development on `develop`.

Do not force-push shared branches unless explicitly requested.

Before committing:

```bash
git status
git diff
```

Inspect specifically for:

* secrets
* personal information
* unrelated modifications
* generated noise
* accidental formatting changes

Keep commits logically scoped.

Recommended commit style:

```text
feat: add catch-all mailbox routing
fix: preserve envelope recipient
refactor: isolate mailbox resolver
docs: document local customization
test: cover catch-all fallback
```

---

# 16. Upstream Synchronization

The purpose of `main` is to make upstream synchronization predictable.

When upstream changes are available:

1. fetch upstream,
2. inspect upstream changes,
3. update `main` from `upstream/main`,
4. merge or rebase the updated `main` into `develop`,
5. resolve conflicts based on understanding, not convenience,
6. run relevant validation,
7. inspect `main..develop`.

Do not blindly resolve conflicts with either:

```text
ours
```

or:

```text
theirs
```

Understand what upstream changed first.

If upstream introduces equivalent functionality to a local customization:

1. compare both implementations,
2. prefer upstream behavior where reasonable,
3. remove or simplify duplicate local code,
4. update `docs/CUSTOMIZATIONS.md`.

The goal is not to preserve local code forever.

The goal is to preserve desired behavior with the smallest sustainable fork.

---

# 17. Using External Implementations

Other public forks, pull requests, blog posts, and repositories may be used as references.

Before adopting external code:

1. inspect the license,
2. understand the implementation,
3. identify dependencies on surrounding commits,
4. compare it to the current upstream version,
5. adapt it to this repository rather than blindly copying it,
6. preserve attribution when required.

Do not merge or cherry-pick a large external branch merely because it contains one useful feature.

Prefer extracting:

* the design idea,
* the relevant algorithm,
* or the smallest coherent commit set.

External code is reference material, not authority.

---

# 18. Documentation Maintenance

Documentation is part of the implementation.

When changing architecture:

```text
docs/ARCHITECTURE.md
```

must remain accurate.

When changing local development procedures:

```text
docs/DEVELOPMENT.md
```

must remain accurate.

When adding, removing, or substantially changing fork-specific behavior:

```text
docs/CUSTOMIZATIONS.md
```

must be updated.

Do not document private production infrastructure unnecessarily.

Documentation must also be safe for public release.

Use example values instead of real private configuration.

---

# 19. Definition of Done

A task is complete only when:

* requested behavior is implemented,
* scope has not expanded unnecessarily,
* relevant documentation remains accurate,
* fork-specific behavior is recorded when necessary,
* secrets and personal information are absent from the diff,
* relevant tests pass,
* `npm run typecheck` passes,
* `npm run build` passes,
* production deployment has not occurred unless explicitly requested,
* migration requirements are documented,
* manual configuration steps are documented,
* upstream compatibility implications are understood.

At completion, report:

1. what changed,
2. why it changed,
3. files changed,
4. tests and validation performed,
5. remaining risks,
6. upstream compatibility concerns,
7. required migration steps,
8. required manual deployment or configuration steps.

---

# 20. Current Fork Priorities

This fork should focus on personal email workflow improvements while remaining recognizably based on upstream Agentic Inbox.

Good customization areas include:

* catch-all mailbox routing
* mailbox organization
* email classification
* filtering and search
* safe AI-assisted triage
* improved observability
* integration-friendly APIs

Avoid turning this fork into an unrelated general-purpose mail server.

When a feature can reasonably live outside Agentic Inbox, consider whether an external integration is more maintainable than modifying core upstream behavior.

The upstream Agentic Inbox architecture remains the foundation.

---

# Core Principle

AI agents are encouraged to move quickly, but not blindly.

Optimize for:

```text
understandability
+ small changes
+ public safety
+ production safety
+ upstream compatibility
+ documented intent
```

The objective is not merely to make the current task work.

The objective is to keep this fork understandable and maintainable for both humans and future AI agents.
