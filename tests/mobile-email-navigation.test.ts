import assert from "node:assert/strict";
import { test } from "node:test";
import { getMobileEmailNeighborIds } from "../app/lib/mobile-email-navigation.ts";

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
