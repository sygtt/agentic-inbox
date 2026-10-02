<!-- SPDX-License-Identifier: Apache-2.0 -->

# Main-first branch migration

This runbook records issue #53 and the historical cutover steps. PR #60 merged
on 2026-10-01 (JST; 2026-09-30 UTC) as `8e0007277d9b30b30a22b923943396c37f2df6fb`.
The pre-migration fork tip is an ancestor of `main`; main-first is active now.
The merge does not establish the external Cloudflare build/deployment settings,
which remain unverified. The preparation and approval instructions below apply
to that historical migration, not to choosing the base for new work.

## Recovery from a PR merged into develop

PR #61 was created from the pre-migration fork tip and merged into `develop`.
Recover its changes on a focused branch from current `origin/main`, retaining
the new main-first documentation. Review and validate the recovery PR against
`main`; do not reset shared refs or merge the entire legacy branch blindly.
A revert branch alone does not revert `develop`: check the actual branch tip.
Before resuming any older work, read the current `origin/main` agent rules and
verify that the PR base is explicitly `main`.

## Preparation snapshot (2026-09-30)

- There were no open PRs. The old `main` is an ancestor of `develop`, which
  contains 200 additional fork commits; the migration PR preserves that history.
- Both archive refs listed below were created and their exact SHAs verified.
- GitHub already defaults to `main` and permits merge commits. Branch metadata
  reports `main` and `develop` unprotected, and the repository ruleset list is
  empty. The integration cannot read detailed branch-protection settings;
  review them in GitHub before cutover if protection is configured later.
- The repository has no production deployment workflow. Cloudflare's external
  build/deployment settings have not been verified or changed.

## 1. Review and merge the migration PR

The migration PR carries the existing `develop` history to `main` and updates
the workflow documentation and CI. Before the owner merges it:

- Confirm it targets `main`, includes the expected licensing CI, and its body
  contains `Closes #53` so GitHub closes the issue on merge.
- Select GitHub's merge-commit method. Do not squash or rebase this migration;
  the merge commit preserves the existing fork commits and their history.
- The owner must verify which branch Cloudflare builds or deploys from and
  adjust it deliberately before merging if necessary. Those external settings
  are not visible from this repository; do not assume they target `main` or
  trigger a deployment as part of this code change.
- Pause any automatic production deployment that would be triggered by the
  cutover unless that release is explicitly authorized. Changing the code's
  canonical branch does not authorize production deployment.

Before that merge, neither `main` is advanced by the migration nor `develop` is
deleted. Do not merge, deploy, or retire a branch autonomously.

## 2. Verify after the approved merge

Fetch the updated remote and verify that the new `main` contains the exact
pre-migration `develop` tip:

```bash
git fetch origin --prune
git merge-base --is-ancestor 2afbd223ef3a212c7719282de2e1daa2fc9bae38 origin/main
```

Also confirm the migration PR's validation checks passed, the License compliance
workflow succeeds on the new `main` push, and GitHub closed issue #53 through
the PR's closing keyword. If any check fails, stop and investigate before changing
branch pointers or deployment configuration.

## 3. Use main-first workflow; retain old refs

After verification, create new feature, fix, documentation, and maintenance
branches from `origin/main`; target their PRs at `main`. Review upstream
updates on `sync/upstream-YYYY-MM` branches and PRs rather than making this
fork's `main` track `upstream/main`. See [Development](DEVELOPMENT.md) for the
normal workflow.

Keep these remote archive refs intact:

- `legacy/upstream-main` preserves the previous upstream-tracking tip
  `c3f1c90b7c700b778e5e196f1d78fd8ba6b68200`.
- `legacy/develop-before-main-first` preserves the pre-migration fork tip
  `2afbd223ef3a212c7719282de2e1daa2fc9bae38`.

Do not delete `develop` as part of this migration. Its retirement requires a
separate owner decision after the new workflow and external build settings are
confirmed. Historical topic branch refs also remain available; some are not
ancestors of `develop`. In the branch audit, 25 of 32 prior topic tips were
ancestors of `develop`; the other seven remain intact because of earlier squash
or stacked merges, or because their changes were already present through other
history. Do not infer that a non-ancestor tip is disposable or delete these
refs as part of this migration.

Before proposing retirement, verify that no PR or build setting still targets
`develop`, and run `git merge-base --is-ancestor origin/develop origin/main`
after a fresh fetch. This checks for new `develop` commits since the snapshot;
do not delete it if they have not reached `main`.

## Rollback

The old `develop` branch and both archive refs preserve recovery points. If the
post-merge history or build checks are wrong, stop and have the owner choose a
corrective merge or configuration change. Do not force-push, reset shared
branches, delete archive refs, or deploy as an automatic rollback.
