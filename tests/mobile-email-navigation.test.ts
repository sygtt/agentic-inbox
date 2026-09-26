import assert from "node:assert/strict";
import { test } from "node:test";
import {
	getMobileEmailNeighborIds,
	isMobileEmailDetailHistoryEntry,
	withMobileEmailDetailHistoryEntry,
} from "../app/lib/mobile-email-navigation.ts";

const emails = [{ id: "newest" }, { id: "middle" }, { id: "oldest" }];

test("finds neighboring emails in the currently loaded list order", () => {
	assert.deepEqual(getMobileEmailNeighborIds(emails, "middle"), {
		previousEmailId: "newest",
		nextEmailId: "oldest",
	});
});

test("disables navigation at either list edge and for an email outside the loaded list", () => {
	assert.deepEqual(getMobileEmailNeighborIds(emails, "newest"), {
		previousEmailId: null,
		nextEmailId: "middle",
	});
	assert.deepEqual(getMobileEmailNeighborIds(emails, "oldest"), {
		previousEmailId: "middle",
		nextEmailId: null,
	});
	assert.deepEqual(getMobileEmailNeighborIds(emails, "not-loaded"), {
		previousEmailId: null,
		nextEmailId: null,
	});
});

test("marks mobile detail history entries while preserving existing location state", () => {
	const state = withMobileEmailDetailHistoryEntry({ from: "inbox", keep: true });
	assert.equal(state.from, "inbox");
	assert.equal(state.keep, true);
	assert.equal(isMobileEmailDetailHistoryEntry(state), true);
	assert.equal(isMobileEmailDetailHistoryEntry(null), false);
	assert.equal(isMobileEmailDetailHistoryEntry({ agenticInboxMobileEmailDetailEntry: false }), false);
});
