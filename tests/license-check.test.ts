// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { CHANGE_NOTICE, checkRepository, UPSTREAM_LICENSE_SHA256 } from "../scripts/license-check.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const licenseBytes = readFileSync(path.join(repositoryRoot, "LICENSE"));
const upstreamBaseline = "1".repeat(64);

function csvField(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

function makeFixture(source = `// SPDX-License-Identifier: Apache-2.0\n// ${CHANGE_NOTICE}\n// Copyright Upstream\nexport const answer = 42;\n`) {
	const root = mkdtempSync(path.join(os.tmpdir(), "license-check-"));
	mkdirSync(path.join(root, "docs"), { recursive: true });
	writeFileSync(path.join(root, "LICENSE"), licenseBytes);
	writeFileSync(path.join(root, "source.ts"), source);
	writeFileSync(path.join(root, "package.json"), '{"license":"Apache-2.0"}\n');
	writeFileSync(path.join(root, "package.json.license"), "SPDX-License-Identifier: Apache-2.0\nApplies to: package.json\n");
	writeFileSync(path.join(root, "docs/LICENSING-PROVENANCE.csv.license"), "SPDX-License-Identifier: Apache-2.0\nApplies to: LICENSING-PROVENANCE.csv\n");
	const columns = ["path", "class", "upstream_sha256", "audited_sha256", "evidence", "upstream_notices", "preserved_notices"];
	const rows = [
		["LICENSE", "A", UPSTREAM_LICENSE_SHA256, UPSTREAM_LICENSE_SHA256, "Audited upstream Apache license.", "[]", "[]"],
		["package.json", "C", "", "", "Fork package metadata.", "[]", "[]"],
		["package.json.license", "C", "", "", "Sidecar for JSON package metadata.", "[]", "[]"],
		["docs/LICENSING-PROVENANCE.csv", "C", "", "", "Audit manifest fixture.", "[]", "[]"],
		["docs/LICENSING-PROVENANCE.csv.license", "C", "", "", "Sidecar for audit manifest fixture.", "[]", "[]"],
		["source.ts", "B", upstreamBaseline, "", "Modified upstream source fixture.", '["// Copyright Upstream"]', '["// Copyright Upstream"]'],
	];
	const manifest = [columns.join(","), ...rows.map((row) => row.map(csvField).join(","))].join("\n") + "\n";
	writeFileSync(path.join(root, "docs/LICENSING-PROVENANCE.csv"), manifest);
	try {
		execFileSync("git", ["init", "-q"], { cwd: root });
	} catch (error) {
		if ((error as NodeJS.ErrnoException & { status?: number }).status !== 0) throw error;
	}
	return root;
}

function withFixture(run: (root: string) => void, source?: string) {
	const root = makeFixture(source);
	try {
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("passes when the license, inventory, upstream notice, and fork notice are intact", () => {
	withFixture((root) => assert.deepEqual(checkRepository(root), []));
});

test("rejects corruption of the upstream Apache license", () => {
	withFixture((root) => {
		writeFileSync(path.join(root, "LICENSE"), Buffer.concat([licenseBytes, Buffer.from("changed\n")]));
		assert.ok(checkRepository(root).some((error) => error.includes("LICENSE: contents differ")));
	});
});

test("rejects project metadata that no longer declares Apache-2.0", () => {
	withFixture((root) => {
		writeFileSync(path.join(root, "package.json"), '{"license":"MIT"}\n');
		assert.ok(checkRepository(root).some((error) => error.includes('project license metadata must remain "Apache-2.0"')));
	});
});

test("rejects removal of an existing upstream copyright notice", () => {
	withFixture((root) => {
		writeFileSync(path.join(root, "source.ts"), `// SPDX-License-Identifier: Apache-2.0\n${CHANGE_NOTICE}\nexport const answer = 42;\n`);
		assert.ok(checkRepository(root).some((error) => error.includes("preserve upstream notice")));
	});
});

test("rejects removal of the fork modification notice", () => {
	withFixture((root) => {
		writeFileSync(path.join(root, "source.ts"), "// SPDX-License-Identifier: Apache-2.0\n// Copyright Upstream\nexport const answer = 42;\n");
		assert.ok(checkRepository(root).some((error) => error.includes("prominent fork modification notice")));
	});
});

test("does not accept license text found only in code instead of a file header", () => {
	withFixture((root) => {
		writeFileSync(
			path.join(root, "source.ts"),
			`export const example = "SPDX-License-Identifier: Apache-2.0 ${CHANGE_NOTICE} // Copyright Upstream";\n`,
		);
		assert.ok(checkRepository(root).some((error) => error.includes("add SPDX-License-Identifier")));
	});
});

test("rejects a tracked file omitted from the provenance manifest", () => {
	withFixture((root) => {
		writeFileSync(path.join(root, "new-file.ts"), "export const newFile = true;\n");
		assert.ok(checkRepository(root).some((error) => error.includes("new-file.ts: add a provenance classification")));
	});
});

test("rejects an unchanged upstream classification after file content changes", () => {
	withFixture((root) => {
		const manifestPath = path.join(root, "docs/LICENSING-PROVENANCE.csv");
		const manifest = readFileSync(manifestPath, "utf8").replace(
			'"source.ts","B",',
			'"source.ts","A",',
		);
		writeFileSync(manifestPath, manifest);
		assert.ok(checkRepository(root).some((error) => error.includes("differs from its pinned upstream bytes")));
	});
});

test("rejects Apache claims on unresolved third-party or generated files", () => {
	withFixture((root) => {
		writeFileSync(path.join(root, "reference.ts"), "// SPDX-License-Identifier: Apache-2.0\n// Imported prototype\n");
		const manifestPath = path.join(root, "docs/LICENSING-PROVENANCE.csv");
		const manifest = readFileSync(manifestPath, "utf8");
		const row = ["reference.ts", "F", "", "", "Owner-supplied prototype; license terms unknown.", "[]", "[]"].map(csvField).join(",");
		writeFileSync(manifestPath, manifest + row + "\n");
		assert.ok(checkRepository(root).some((error) => error.includes("must not claim Apache-2.0")));
	});
});
