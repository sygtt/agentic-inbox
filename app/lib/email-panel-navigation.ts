// SPDX-License-Identifier: Apache-2.0
export const EDITABLE_ESCAPE_TARGET_SELECTOR =
	'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
export interface EmailPanelEscapeState {
	key: string;
	defaultPrevented: boolean;
	isPanelVisible: boolean;
	isOverlayOpen: boolean;
	isComposing: boolean;
	isEditableTarget: boolean;
}
/**
 * Escape closes the desktop detail panel only while nothing else owns the key.
 * During compose the shortcut must stay inert: closing the panel unmounts
 * ComposePanel and discards an unsaved reply without saving or confirmation.
 */
export function shouldCloseEmailPanelOnEscape(state: EmailPanelEscapeState): boolean {
	if (state.key !== "Escape" || state.defaultPrevented) return false;
	if (state.isOverlayOpen || state.isComposing) return false;
	return state.isPanelVisible && !state.isEditableTarget;
}

/**
 * Shape check for the Escape report posted by the sandboxed email iframe.
 * The iframe runs in an opaque origin, so the `event.source` comparison in
 * EmailIframe is the real trust boundary; this keeps the payload contract
 * explicit and testable without a DOM.
 */
export function isEmailIframeEscapeMessage(data: unknown): boolean {
	if (!data || typeof data !== "object") return false;
	return (data as { __emailIframeEscape?: unknown }).__emailIframeEscape === true;
}
