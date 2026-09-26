import assert from "node:assert/strict";
import { test } from "node:test";
import { getMobileEmailTagBadges } from "../app/lib/mobile-email-tags.ts";
import type { EmailTag } from "../app/types/index.ts";

const tag = (value: string, provenance = "manual"): EmailTag => ({
	tag: value,
	provenance,
});

test("translates supported disposition tags into concise Japanese labels", () => {
	assert.deepEqual(
		getMobileEmailTagBadges([
			tag("disposition:action-required"),
			tag("disposition:review"),
			tag("disposition:auto-file"),
		]),
		[
			{ kind: "disposition", tag: "disposition:action-required", label: "要対応" },
			{ kind: "disposition", tag: "disposition:review", label: "要確認" },
			{ kind: "disposition", tag: "disposition:auto-file", label: "自動整理" },
		],
	);
});

test("prioritizes the synthetic triage error and dispositions over other tags", () => {
	assert.deepEqual(
		getMobileEmailTagBadges([
			tag("service:calendar", "agent"),
			tag("disposition:review", "agent"),
			tag("triage:error", "system"),
			tag("project:summer"),
		]),
		[
			{ kind: "triage-error" },
			{ kind: "disposition", tag: "disposition:review", label: "要確認" },
			{ kind: "overflow", count: 2 },
		],
	);
});

test("uses a thread-level error and keeps manually entered triage:error as a raw tag", () => {
	assert.deepEqual(getMobileEmailTagBadges([tag("triage:error")], true), [
		{ kind: "triage-error" },
		{ kind: "tag", tag: "triage:error", label: "triage:error" },
	]);
});
