import assert from "node:assert/strict";
import { test } from "node:test";
import {
	getMobileArchiveSuccessAction,
	getMobileEmailNeighborIds,
	getMobileEmailPanelCloseAction,
	getMobileEmailSelectionAction,
	isEmailStillSelected,
	isMobileEmailDetailHistoryEntry,
	shouldMarkUrlSelectedEmailRead,
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

test("advances only mobile archive completion and closes the desktop detail", () => {
	const selectedArchive = {
		isMobileViewport: true,
		selectedEmailId: "archived",
		archivedEmailId: "archived",
		nextEmailId: "next",
	};
	assert.deepEqual(getMobileArchiveSuccessAction(selectedArchive), { type: "navigate", emailId: "next" });
	assert.deepEqual(getMobileArchiveSuccessAction({ ...selectedArchive, isMobileViewport: false }), { type: "close" });
	assert.deepEqual(getMobileArchiveSuccessAction({ ...selectedArchive, nextEmailId: null }), { type: "close" });
	assert.deepEqual(getMobileArchiveSuccessAction({ ...selectedArchive, selectedEmailId: "another-email" }), { type: "none" });
	assert.deepEqual(getMobileArchiveSuccessAction({ ...selectedArchive, selectedEmailId: null }), { type: "none" });
});

test("only closes async email actions while their email remains selected", () => {
	assert.equal(isEmailStillSelected("email-a", "email-a"), true);
	assert.equal(isEmailStillSelected("email-b", "email-a"), false);
	assert.equal(isEmailStillSelected(null, "email-a"), false);
});

test("allows URL-selected email read marking only for active mobile detail", () => {
	const selection = {
		isMobileViewport: true,
		isComposing: false,
		urlSelectedEmailId: "selected",
		selectedEmailId: "selected",
		emailId: "selected",
		lastMarkedEmailId: null,
	};
	assert.equal(shouldMarkUrlSelectedEmailRead(selection), true);
	assert.equal(shouldMarkUrlSelectedEmailRead({ ...selection, isComposing: true }), false);
	assert.equal(shouldMarkUrlSelectedEmailRead({ ...selection, isMobileViewport: false }), false);
	assert.equal(shouldMarkUrlSelectedEmailRead({ ...selection, selectedEmailId: null }), false);
	assert.equal(shouldMarkUrlSelectedEmailRead({ ...selection, lastMarkedEmailId: "selected" }), false);
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
		wasComposing: false,
		urlSelectedEmailId: null,
		selectedEmailId: "selected",
		isComposing: false,
	}), { type: "write-selected-email-to-url", emailId: "selected" });
	assert.deepEqual(getMobileEmailSelectionAction({
		isMobileViewport: true,
		wasMobileViewport: true,
		wasComposing: false,
		urlSelectedEmailId: null,
		selectedEmailId: "selected",
		isComposing: false,
	}), { type: "clear-selection" });
});

test("preserves an active compose instead of applying a stale URL email selection", () => {
	assert.deepEqual(getMobileEmailSelectionAction({
		isMobileViewport: true,
		wasMobileViewport: false,
		wasComposing: false,
		urlSelectedEmailId: "previously-selected",
		selectedEmailId: null,
		isComposing: true,
	}), { type: "none" });
});

test("restores a selected email to the URL when closing a compose after resizing to mobile", () => {
	assert.deepEqual(getMobileEmailSelectionAction({
		isMobileViewport: true,
		wasMobileViewport: true,
		wasComposing: true,
		urlSelectedEmailId: null,
		selectedEmailId: "restored-email",
		isComposing: false,
	}), { type: "write-selected-email-to-url", emailId: "restored-email" });
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
