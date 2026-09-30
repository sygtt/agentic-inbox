// SPDX-License-Identifier: Apache-2.0
import { isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const UPSTREAM_LICENSE_SHA256 =
	"e0a6e6c7d9f3521dc1a41fa8054c68483fd5e12f082dd48dc2b15e6e51dcd547";
export const CHANGE_NOTICE =
	"Modified in the sygtt/agentic-inbox fork; see Git history.";
const MANIFEST = "docs/LICENSING-PROVENANCE.csv";
const NO_COMMENT_FORMATS = new Set([".json", ".webmanifest", ".csv"]);
const BINARY_FORMATS = new Set([".png", ".ico", ".pdf"]);
const APPROVED_LOCKFILE_SIDECAR = [
	"SPDX-License-Identifier: Apache-2.0",
	CHANGE_NOTICE,
	"Generated file; do not edit headers in package-lock.json.",
	"Applies to: package-lock.json",
	"",
].join("\n");

function parseCsv(text) {
	const rows = [];
	let row = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];
		if (quoted) {
			if (char === '"' && text[i + 1] === '"') {
				field += '"';
				i += 1;
			} else if (char === '"') {
				quoted = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			quoted = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n") {
			row.push(field.replace(/\r$/, ""));
			if (row.some((value) => value !== "")) rows.push(row);
			row = [];
			field = "";
		} else {
			field += char;
		}
	}
	if (quoted) throw new Error("provenance CSV has an unterminated quoted field");
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	const [headers, ...records] = rows;
	if (!headers) throw new Error("provenance CSV is empty");
	return records.map((values) =>
		Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
	);
}

function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex");
}

function isBinaryFile(file, bytes) {
	return BINARY_FORMATS.has(path.extname(file).toLowerCase()) || bytes.includes(0) || !isUtf8(bytes);
}

function gitFiles(root) {
	let output;
	try {
		output = execFileSync(
			"git",
			["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
			{ cwd: root },
		);
	} catch (error) {
		// Some restricted runners report EPERM after a successful spawned Git
		// process. Accept its complete stdout only when Git exited with status 0.
		if (error?.status === 0 && error.stdout) output = Buffer.from(error.stdout);
		else throw error;
	}
	return output
		.toString("utf8")
		.split("\0")
		.filter(Boolean);
}

function read(root, file) {
	return readFileSync(path.join(root, file));
}

function leadingHeader(text, isSidecar = false) {
	if (isSidecar) return text.split(/\r?\n/).slice(0, 8).join("\n");
	const lines = [];
	for (const line of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
		if (!line.trim() || /^\s*(?:\/\/|#|\/\*|\*|<!--|-->)/.test(line)) {
			lines.push(line);
			continue;
		}
		break;
	}
	return lines.join("\n");
}

function report(errors) {
	return errors.length
		? `License check failed:\n${errors.map((error) => `- ${error}`).join("\n")}`
		: "License check passed.";
}

const THIRD_PARTY_EVIDENCE_FIELDS = ["source_url", "version", "terms", "scope"];
const UNRESOLVED_VALUE = /^(?:unknown|pending(?: review)?|review pending|tbd|todo|n\/?a|not applicable|not reviewed|unreviewed|unverified|undetermined|review required|placeholder|unresolved|<[^>]+>)[.!?]?$/i;
const UNRESOLVED_TERMS = /\b(?:license|terms|rights|provenance)\s+(?:are\s+)?(?:unknown|pending|unreviewed|unresolved)\b|\breview\s+(?:is\s+)?pending\b|\bnot reviewed\b/i;
const UNPINNED_VERSION = /^(?:head|main|master|latest|current|tip|branch|unknown|pending|tbd|todo|n\/?a)$/i;

function validateThirdPartyEvidence(file, evidence) {
	let value;
	try {
		value = JSON.parse(evidence);
	} catch {
		return [`${file}: class D evidence must be a JSON object with source_url, version, terms, and scope strings`];
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return [`${file}: class D evidence must be a JSON object with source_url, version, terms, and scope strings`];
	}
	const errors = [];
	for (const field of THIRD_PARTY_EVIDENCE_FIELDS) {
		const fieldValue = value[field];
		if (typeof fieldValue !== "string" || !fieldValue.trim()) {
			errors.push(`${file}: class D evidence field '${field}' must be a non-empty string`);
			continue;
		}
		if (field !== "source_url" && UNRESOLVED_VALUE.test(fieldValue.trim())) {
			errors.push(`${file}: class D evidence field '${field}' contains an unresolved placeholder`);
		}
	}
	if (typeof value.terms === "string" && UNRESOLVED_TERMS.test(value.terms)) {
		errors.push(`${file}: class D evidence field 'terms' contains unresolved license or review status`);
	}
	if (typeof value.source_url === "string" && value.source_url.trim()) {
		try {
			const url = new URL(value.source_url);
			if (!/^https?:$/.test(url.protocol) || !url.hostname) {
				errors.push(`${file}: class D source_url must be an HTTP(S) URL with a hostname`);
			}
		} catch {
			errors.push(`${file}: class D source_url must be an HTTP(S) URL with a hostname`);
		}
	}
	if (typeof value.version === "string" && UNPINNED_VERSION.test(value.version.trim())) {
		errors.push(`${file}: class D version must identify a pinned release or commit`);
	}
	return errors;
}

export function checkRepository(root) {
	const errors = [];
	let records;
	try {
		records = parseCsv(read(root, MANIFEST).toString("utf8"));
	} catch (error) {
		return [error instanceof Error ? error.message : String(error)];
	}
	const manifest = new Map();
	for (const record of records) {
		if (!record.path || manifest.has(record.path)) {
			errors.push(`provenance manifest has an empty or duplicate path: ${record.path || "(empty)"}`);
			continue;
		}
		manifest.set(record.path, record);
	}

	let files;
	try {
		files = gitFiles(root);
	} catch (error) {
		return [`could not list tracked and untracked repository files with Git: ${error?.stderr?.toString().trim() || error.message}`];
	}
	const fileSet = new Set(files);
	for (const file of files) {
		if (!manifest.has(file)) errors.push(`${file}: add a provenance classification`);
	}
	for (const file of manifest.keys()) {
		if (!fileSet.has(file)) errors.push(`${file}: remove the stale provenance entry`);
	}

	let licenseHash;
	try {
		licenseHash = sha256(read(root, "LICENSE"));
	} catch {
		errors.push("LICENSE: required Apache-2.0 license file is missing");
	}
	if (licenseHash && licenseHash !== UPSTREAM_LICENSE_SHA256) {
		errors.push("LICENSE: contents differ from the audited upstream Apache-2.0 license");
	}
	try {
		const packageJson = JSON.parse(read(root, "package.json").toString("utf8"));
		if (packageJson.license !== "Apache-2.0") {
			errors.push('package.json: project license metadata must remain "Apache-2.0"');
		}
	} catch {
		errors.push("package.json: could not read project license metadata");
	}

	for (const [file, record] of manifest) {
		if (!fileSet.has(file)) continue;
		const cls = record.class;
		if (!("ABCDEF".includes(cls) && cls.length === 1)) {
			errors.push(`${file}: class must be one of A, B, C, D, E, or F`);
			continue;
		}
		if (!record.evidence.trim()) errors.push(`${file}: record the provenance evidence`);
		let bytes;
		try {
			bytes = read(root, file);
		} catch {
			errors.push(`${file}: classified file cannot be read`);
			continue;
		}
		const content = bytes.toString("utf8");
		const digest = sha256(bytes);
		const sibling = `${file}.license`;
		const extension = path.extname(file).toLowerCase();
		const binary = isBinaryFile(file, bytes);
		const needsSidecar = NO_COMMENT_FORMATS.has(extension) || binary;
		const hasSidecar = fileSet.has(sibling);
		const isSidecar = file.endsWith(".license");
		const sidecarContent = hasSidecar ? read(root, sibling).toString("utf8") : "";
		const metadataContent = needsSidecar && hasSidecar ? sidecarContent : content;
		const metadataHeader = leadingHeader(metadataContent, isSidecar || (needsSidecar && hasSidecar));
		let originalNoticeSource = leadingHeader(content);
		if (needsSidecar || cls === "D") originalNoticeSource = content;
		if (binary && hasSidecar) originalNoticeSource = sidecarContent;

		if ((cls === "B" || cls === "C") && needsSidecar && !hasSidecar) {
			errors.push(`${file}: add a .license sidecar for this no-comment or binary format`);
		}
		if (cls === "A") {
			if (!record.upstream_sha256 || digest !== record.upstream_sha256) {
				errors.push(`${file}: differs from its pinned upstream bytes; reclassify as B and add a change notice`);
			}
		} else if (cls === "B") {
			if (!record.upstream_sha256 || digest === record.upstream_sha256) {
				errors.push(`${file}: B requires an upstream baseline hash and a fork change`);
			}
			if (!metadataHeader.includes("SPDX-License-Identifier: Apache-2.0")) {
				errors.push(`${file}: add SPDX-License-Identifier: Apache-2.0${needsSidecar ? ` to ${sibling}` : ""}`);
			}
			if (!metadataHeader.includes(CHANGE_NOTICE)) {
				errors.push(`${file}: add the prominent fork modification notice${needsSidecar ? ` to ${sibling}` : ""}`);
			}
			try {
				const original = JSON.parse(record.upstream_notices || "[]");
				for (const notice of original) {
					if (notice && !originalNoticeSource.includes(notice)) errors.push(`${file}: preserve upstream notice: ${notice}`);
				}
			} catch {
				errors.push(`${file}: upstream_notices must be a JSON array`);
			}
		}
		if (cls === "B" || cls === "C" || cls === "D") {
			try {
				const original = JSON.parse(record.preserved_notices || "[]");
				for (const notice of original) {
					if (notice && !originalNoticeSource.includes(notice)) errors.push(`${file}: preserve existing notice: ${notice}`);
				}
			} catch {
				errors.push(`${file}: preserved_notices must be a JSON array`);
			}
		}
		if (cls === "C") {
			if (!metadataHeader.includes("SPDX-License-Identifier: Apache-2.0")) {
				errors.push(`${file}: add SPDX-License-Identifier: Apache-2.0${needsSidecar ? ` to ${sibling}` : ""}`);
			}
		}
		if (cls === "D") {
			errors.push(...validateThirdPartyEvidence(file, record.evidence));
		}
		if (cls === "E" || cls === "F") {
			if (!record.audited_sha256 || digest !== record.audited_sha256) {
				errors.push(`${file}: generated/uncertain content changed; review provenance and update the audit`);
			}
			const approvedLockfileSidecar = cls === "E" && file === "package-lock.json" && sidecarContent === APPROVED_LOCKFILE_SIDECAR;
			const sidecarClaimsApache = /SPDX-License-Identifier:\s*Apache-2\.0/.test(sidecarContent);
			if (
				/SPDX-License-Identifier:\s*Apache-2\.0/.test(content) ||
				(sidecarClaimsApache && !approvedLockfileSidecar)
			) {
				errors.push(`${file}: class ${cls} must not claim Apache-2.0 in the source or sidecar until provenance is reviewed`);
			}
			if (cls === "E" && file === "package-lock.json") {
				if (!hasSidecar || !approvedLockfileSidecar) {
					errors.push(`${file}: generated-file sidecar differs from the approved package-lock exception`);
				}
			}
		}
	}
	return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const errors = checkRepository(process.cwd());
	console.log(report(errors));
	if (errors.length) process.exitCode = 1;
}
