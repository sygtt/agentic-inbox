// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { forwardedIframeShortcutKey, shouldCloseEmailPanelOnEscape } from "../app/lib/email-panel-navigation.ts";
const base = {
	key: "Escape",
	defaultPrevented: false,
	isPanelVisible: true,
	isOverlayOpen: false,
	isComposing: false,
	isEditableTarget: false,
};
test("escape closes the detail panel when nothing else owns the key", () => {
	assert.equal(shouldCloseEmailPanelOnEscape(base), true);
});
test("escape never discards an active compose", () => {
	assert.equal(shouldCloseEmailPanelOnEscape({ ...base, isComposing: true }), false);
});
test("escape stays inert while a source or image overlay is open", () => {
	assert.equal(shouldCloseEmailPanelOnEscape({ ...base, isOverlayOpen: true }), false);
});
test("escape is left to editable fields such as the compose body", () => {
	assert.equal(shouldCloseEmailPanelOnEscape({ ...base, isEditableTarget: true }), false);
});
test("escape is ignored when the desktop panel is hidden or the key was consumed", () => {
	assert.equal(shouldCloseEmailPanelOnEscape({ ...base, isPanelVisible: false }), false);
	assert.equal(shouldCloseEmailPanelOnEscape({ ...base, defaultPrevented: true }), false);
});
test("keys other than escape never close the panel", () => {
	assert.equal(shouldCloseEmailPanelOnEscape({ ...base, key: "Enter" }), false);
});
test("only allowlisted iframe shortcut reports are replayed on the parent", () => {
	assert.equal(forwardedIframeShortcutKey({ __emailIframeEscape: true }), "Escape");
	assert.equal(forwardedIframeShortcutKey({ __emailIframeEscape: true, defaultPrevented: false }), "Escape");
	assert.equal(forwardedIframeShortcutKey({ __emailIframeSearchShortcut: true }), "/");
	assert.equal(forwardedIframeShortcutKey({ __emailIframeSearchShortcut: true, defaultPrevented: true }), "/");
	assert.equal(forwardedIframeShortcutKey({ __emailIframeEscape: "yes" }), null);
	assert.equal(forwardedIframeShortcutKey({ __emailIframeSearchShortcut: "yes" }), null);
	assert.equal(forwardedIframeShortcutKey({ __emailIframeEscape: false }), null);
	assert.equal(forwardedIframeShortcutKey({ __emailIframeHeight: true, height: 120 }), null);
	assert.equal(forwardedIframeShortcutKey({}), null);
	assert.equal(forwardedIframeShortcutKey(null), null);
	assert.equal(forwardedIframeShortcutKey("Escape"), null);
});
