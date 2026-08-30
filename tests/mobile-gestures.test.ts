import assert from "node:assert/strict";
import { test } from "node:test";
import { clampMobileSwipe, getMobileSwipeAction } from "../app/lib/mobile-gestures.ts";

test("mobile swipe actions use intentional thresholds", () => {
	assert.equal(getMobileSwipeAction(-75), null);
	assert.equal(getMobileSwipeAction(-76), "archive");
	assert.equal(getMobileSwipeAction(76), "toggle-read");
	assert.equal(getMobileSwipeAction(75), null);
});

test("mobile swipe offsets stay within the reveal limit", () => {
	assert.equal(clampMobileSwipe(-200), -120);
	assert.equal(clampMobileSwipe(200), 120);
	assert.equal(clampMobileSwipe(32), 32);
});
