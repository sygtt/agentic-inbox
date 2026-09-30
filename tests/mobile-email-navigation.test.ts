import assert from "node:assert/strict";
import { test } from "node:test";
import {
	getMobileEmailPanelCloseAction,
	getMobileEmailNeighborIds,
	getMobileEmailSelectionAction,
	isMobileEmailDetailHistoryEntry,
	shouldAdvanceAfterMobileArchive,
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

test("only auto-advances after archive while the archived email remains selected", () => {
	assert.equal(shouldAdvanceAfterMobileArchive("archived", "archived"), true);
	assert.equal(shouldAdvanceAfterMobileArchive("another-email", "archived"), false);
	assert.equal(shouldAdvanceAfterMobileArchive(null, "archived"), false);
});

test("marks mobile detail history entries while preserving existing location state", () => {
	const state = withMobileEmailDetailHistoryEntry({ from: "inbox", keep: true });
	assert.equal(state.from, "inbox");
	assert.equal(state.keep, true);
	assert.equal(isMobileEmailDetailHistoryEntry(state), true);
	assert.equal(isMobileEmailDetailHistoryEntry(null), false);
	assert.equal(isMobileEmailDetailHistoryEntry({ agenticInboxMobileEmailDetailEntry: false }), false);
});

test("keeps a desktop selection when entering mobile and clears it after mobile Back", () => {
	assert.deepEqual(getMobileEmailSelectionAction({
		isMobileViewport: true,
		wasMobileViewport: false,
		urlSelectedEmailId: null,
		selectedEmailId: "selected",
		isComposing: false,
	}), { type: "write-selected-email-to-url", emailId: "selected" });
	assert.deepEqual(getMobileEmailSelectionAction({
		isMobileViewport: true,
		wasMobileViewport: true,
		urlSelectedEmailId: null,
		selectedEmailId: "selected",
		isComposing: false,
	}), { type: "clear-selection" });
});

test("preserves an active compose instead of applying a stale URL email selection", () => {
	assert.deepEqual(getMobileEmailSelectionAction({
		isMobileViewport: true,
		wasMobileViewport: false,
		urlSelectedEmailId: "previously-selected",
		selectedEmailId: null,
		isComposing: true,
	}), { type: "none" });
});

test("clears URL email selection when closing the panel outside its mobile history entry", () => {
	const historyState = withMobileEmailDetailHistoryEntry({ from: "inbox" });
	assert.deepEqual(getMobileEmailPanelCloseAction({
		urlSelectedEmailId: "selected",
		returnThroughHistory: true,
		locationState: historyState,
	}), { type: "return-through-history" });
	assert.deepEqual(getMobileEmailPanelCloseAction({
		urlSelectedEmailId: "selected",
		returnThroughHistory: false,
		locationState: historyState,
	}), { type: "clear-url-selection" });
	assert.deepEqual(getMobileEmailPanelCloseAction({
		urlSelectedEmailId: "selected",
		returnThroughHistory: true,
		locationState: null,
	}), { type: "clear-url-selection" });
	assert.deepEqual(getMobileEmailPanelCloseAction({
		urlSelectedEmailId: null,
		returnThroughHistory: true,
		locationState: historyState,
	}), { type: "none" });
});
