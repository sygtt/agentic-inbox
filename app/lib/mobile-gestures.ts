// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

export const MOBILE_SWIPE_THRESHOLD = 76;

export function clampMobileSwipe(value: number, limit = 120): number {
	return Math.max(-limit, Math.min(limit, value));
}

export function getMobileSwipeAction(
	offset: number,
	threshold = MOBILE_SWIPE_THRESHOLD,
): "archive" | "toggle-read" | null {
	if (offset <= -threshold) return "archive";
	if (offset >= threshold) return "toggle-read";
	return null;
}
