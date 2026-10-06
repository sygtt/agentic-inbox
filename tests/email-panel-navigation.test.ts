// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { isEmailIframeEscapeMessage, shouldCloseEmailPanelOnEscape } from "../app/lib/email-panel-navigation.ts";
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
test("only the iframe escape report is treated as an escape message", () => {
	assert.equal(isEmailIframeEscapeMessage({ __emailIframeEscape: true }), true);
	assert.equal(isEmailIframeEscapeMessage({ __emailIframeEscape: true, defaultPrevented: false }), true);
	assert.equal(isEmailIframeEscapeMessage({ __emailIframeEscape: "yes" }), false);
	assert.equal(isEmailIframeEscapeMessage({ __emailIframeHeight: true, height: 120 }), false);
	assert.equal(isEmailIframeEscapeMessage(null), false);
	assert.equal(isEmailIframeEscapeMessage("Escape"), false);
});
