// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEmailListParams, getEmailTagFilterOptions, getListPageRange } from "../app/lib/email-tag-filter.ts";

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

test("list page range is empty when totalCount is zero", () => {
	assert.deepEqual(getListPageRange(1, 25, 0), { start: 0, end: 0 });
});

test("list page range covers exactly one full page", () => {
	assert.deepEqual(getListPageRange(1, 25, 25), { start: 1, end: 25 });
});

test("list page range covers the single item on page two at totalCount 26", () => {
	assert.deepEqual(getListPageRange(2, 25, 26), { start: 26, end: 26 });
});

test("list page range caps a partial final page at totalCount", () => {
	assert.deepEqual(getListPageRange(3, 25, 63), { start: 51, end: 63 });
});

test("list page range starts at one on the first of multiple pages", () => {
	assert.deepEqual(getListPageRange(1, 25, 63), { start: 1, end: 25 });
});
