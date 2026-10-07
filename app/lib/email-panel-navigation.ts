// SPDX-License-Identifier: Apache-2.0
/**
 * Elements where the reader is typing, so global shortcuts must stand down.
 * Shared by the parent window listeners and the sandboxed iframe bridge.
 */
export const EDITABLE_SHORTCUT_TARGET_SELECTOR =
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
 * The shortcut the sandboxed email iframe bridge is allowed to replay on the
 * parent DOM, or null.
 *
 * Focus inside the iframe's nested browsing context keeps key events away from
 * the parent window listeners, so the injected bridge script reports which
 * allowlisted shortcut fired and the parent reconstructs it. This union is the
 * whole contract: `event.source` in EmailIframe remains the real trust boundary,
 * but no key text crosses it, so a hostile message body cannot invent a shortcut
 * or replay a key this function does not name.
 */
export function forwardedIframeShortcutKey(data: unknown): "Escape" | "/" | null {
	if (!data || typeof data !== "object") return null;
	const message = data as { __emailIframeEscape?: unknown; __emailIframeSearchShortcut?: unknown };
	if (message.__emailIframeEscape === true) return "Escape";
	if (message.__emailIframeSearchShortcut === true) return "/";
	return null;
}
