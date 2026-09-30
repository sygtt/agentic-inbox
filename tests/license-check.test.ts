// SPDX-License-Identifier: Apache-2.0
import { createHash } from "node:crypto";
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

function sha256(bytes: Buffer): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function addRecord(
	root: string,
	{ path: file, cls, evidence, audited = "", preserved = "[]" }: {
		path: string;
		cls: string;
		evidence: string;
		audited?: string;
		preserved?: string;
	},
) {
	const manifestPath = path.join(root, "docs/LICENSING-PROVENANCE.csv");
	const row = [file, cls, "", audited, evidence, "[]", preserved].map(csvField).join(",");
	writeFileSync(manifestPath, `${readFileSync(manifestPath, "utf8")}${row}\n`);
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
		writeFileSync(path.join(root, "source.ts"), `// SPDX-License-Identifier: Apache-2.0\n// ${CHANGE_NOTICE}\nexport const answer = 42;\n`);
		assert.ok(checkRepository(root).some((error) => error.includes("preserve upstream notice")));
	});
});

test("rejects removal of the fork modification notice", () => {
	withFixture((root) => {
		writeFileSync(path.join(root, "source.ts"), "// SPDX-License-Identifier: Apache-2.0\n// Copyright Upstream\nexport const answer = 42;\n");
		assert.ok(checkRepository(root).some((error) => error.includes("prominent fork modification notice")));
	});
});

test("a sidecar cannot replace notices from an existing text source file", () => {
	withFixture((root) => {
		writeFileSync(
			path.join(root, "source.ts.license"),
			`SPDX-License-Identifier: Apache-2.0\n${CHANGE_NOTICE}\n// Copyright Upstream\n`,
		);
		addRecord(root, { path: "source.ts.license", cls: "C", evidence: "Sidecar associated with a source file." });
		writeFileSync(path.join(root, "source.ts"), `// SPDX-License-Identifier: Apache-2.0\n// ${CHANGE_NOTICE}\nexport const answer = 42;\n`);
		assert.ok(checkRepository(root).some((error) => error.includes("source.ts: preserve upstream notice")));
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

test("requires and accepts sidecars for binary fork-created assets", () => {
	withFixture((root) => {
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
		const unknownBinary = Buffer.from([0x00, 0xff, 0x01]);
		writeFileSync(path.join(root, "logo.png"), png);
		writeFileSync(path.join(root, "logo.png.license"), "SPDX-License-Identifier: Apache-2.0\nOriginal notice: Imported icon source\nApplies to: logo.png\n");
		writeFileSync(path.join(root, "asset.dat"), unknownBinary);
		writeFileSync(path.join(root, "asset.dat.license"), "SPDX-License-Identifier: Apache-2.0\nApplies to: asset.dat\n");
		addRecord(root, { path: "logo.png", cls: "C", evidence: "Fork-created PNG asset.", preserved: JSON.stringify(["Original notice: Imported icon source"]) });
		addRecord(root, { path: "logo.png.license", cls: "C", evidence: "Sidecar for PNG asset." });
		addRecord(root, { path: "asset.dat", cls: "C", evidence: "Fork-created binary asset." });
		addRecord(root, { path: "asset.dat.license", cls: "C", evidence: "Sidecar for binary asset." });
		assert.deepEqual(checkRepository(root), []);
	});
});

test("rejects binary fork-created assets without a sidecar", () => {
	withFixture((root) => {
		writeFileSync(path.join(root, "orphan.ico"), Buffer.from([0x00, 0xff, 0x01]));
		addRecord(root, { path: "orphan.ico", cls: "C", evidence: "Fork-created icon asset." });
		assert.ok(checkRepository(root).some((error) => error.includes("orphan.ico: add a .license sidecar")));
	});
});

test("rejects deletion of third-party notices recorded for class D", () => {
	withFixture((root) => {
		const thirdPartyLicense = "Copyright Example Project\nMIT License\nPermission is hereby granted...\n";
		writeFileSync(path.join(root, "third-party-license.txt"), thirdPartyLicense);
		addRecord(root, {
			path: "third-party-license.txt",
			cls: "D",
			evidence: "Third-party MIT license terms recorded with the source.",
			preserved: JSON.stringify(["Copyright Example Project"]),
		});
		assert.deepEqual(checkRepository(root), []);
		writeFileSync(path.join(root, "third-party-license.txt"), "MIT License\nPermission is hereby granted...\n");
		assert.ok(checkRepository(root).some((error) => error.includes("third-party-license.txt: preserve existing notice")));
	});
});

test("rejects Apache claims in class F JSON and binary sidecars", () => {
	withFixture((root) => {
		const prototype = Buffer.from('{"prototype":true}\n');
		const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
		writeFileSync(path.join(root, "prototype.json"), prototype);
		writeFileSync(path.join(root, "prototype.json.license"), "SPDX-License-Identifier: Apache-2.0\nApplies to: prototype.json\n");
		writeFileSync(path.join(root, "prototype.png"), image);
		writeFileSync(path.join(root, "prototype.png.license"), "SPDX-License-Identifier: Apache-2.0\nApplies to: prototype.png\n");
		addRecord(root, { path: "prototype.json", cls: "F", evidence: "Prototype license rights are unknown.", audited: sha256(prototype) });
		addRecord(root, { path: "prototype.json.license", cls: "C", evidence: "Metadata sidecar for unresolved prototype." });
		addRecord(root, { path: "prototype.png", cls: "F", evidence: "Prototype image license rights are unknown.", audited: sha256(image) });
		addRecord(root, { path: "prototype.png.license", cls: "C", evidence: "Metadata sidecar for unresolved prototype image." });
		const errors = checkRepository(root);
		assert.ok(errors.some((error) => error.includes("prototype.json: class F must not claim Apache-2.0")));
		assert.ok(errors.some((error) => error.includes("prototype.png: class F must not claim Apache-2.0")));
	});
});

test("allows only the exact generated package-lock sidecar exception for class E", () => {
	withFixture((root) => {
		const lockfile = Buffer.from('{"lockfileVersion":3}\n');
		const binary = Buffer.from([0x00, 0xff, 0x01]);
		const lockSidecar = [
			"SPDX-License-Identifier: Apache-2.0",
			CHANGE_NOTICE,
			"Generated file; do not edit headers in package-lock.json.",
			"Applies to: package-lock.json",
			"",
		].join("\n");
		writeFileSync(path.join(root, "package-lock.json"), lockfile);
		writeFileSync(path.join(root, "package-lock.json.license"), lockSidecar);
		writeFileSync(path.join(root, "generated.bin"), binary);
		writeFileSync(path.join(root, "generated.bin.license"), "SPDX-License-Identifier: Apache-2.0\nApplies to: generated.bin\n");
		addRecord(root, { path: "package-lock.json", cls: "E", evidence: "Generated npm lockfile exception.", audited: sha256(lockfile) });
		addRecord(root, { path: "package-lock.json.license", cls: "C", evidence: "Approved lockfile metadata sidecar." });
		addRecord(root, { path: "generated.bin", cls: "E", evidence: "Generated binary artifact requiring review.", audited: sha256(binary) });
		addRecord(root, { path: "generated.bin.license", cls: "C", evidence: "Sidecar for generated binary artifact." });
		const errors = checkRepository(root);
		assert.ok(errors.some((error) => error.includes("generated.bin: class E must not claim Apache-2.0")));
		assert.ok(!errors.some((error) => error.includes("package-lock.json:")));
	});
});
