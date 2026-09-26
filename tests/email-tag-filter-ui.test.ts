import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEmailListParams, getEmailTagFilterOptions } from "../app/lib/email-tag-filter.ts";

test("tag filter options include dispositions and arbitrary tags but not hold", () => {
	assert.deepEqual(getEmailTagFilterOptions([
		"service:github",
		"disposition:review",
		"disposition:hold",
		"project:lab",
	]), [
		{ tag: "disposition:action-required", label: "Action required" },
		{ tag: "disposition:review", label: "Review" },
		{ tag: "disposition:auto-file", label: "Auto-file" },
		{ tag: "project:lab", label: "project:lab" },
		{ tag: "service:github", label: "service:github" },
	]);
});

test("list request params apply and clear a tag filter without losing folder context", () => {
	assert.deepEqual(buildEmailListParams({ folder: "archive", page: 2, limit: 25, needsReply: false }), {
		folder: "archive", page: "2", limit: "25",
	});
	assert.deepEqual(buildEmailListParams({ folder: "archive", page: 2, limit: 25, needsReply: false, tag: "service:github" }), {
		folder: "archive", page: "2", limit: "25", tag: "service:github",
	});
	assert.deepEqual(buildEmailListParams({ folder: "archive", page: 1, limit: 25, needsReply: false }), {
		folder: "archive", page: "1", limit: "25",
	});
});
