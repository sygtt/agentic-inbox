// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { getRestoreTargetFolder } from "../app/lib/trash-undo.ts";

test("restores a deleted email to its own folder, not the folder in the URL", () => {
	assert.equal(getRestoreTargetFolder("archive", "inbox"), "archive");
	assert.equal(getRestoreTargetFolder("sent", "archive"), "sent");
});

test("falls back to the URL folder when the email's own folder is unknown", () => {
	assert.equal(getRestoreTargetFolder(null, "archive"), "archive");
	assert.equal(getRestoreTargetFolder(undefined, "sent"), "sent");
	assert.equal(getRestoreTargetFolder("", "draft"), "draft");
});

test("returns null when neither folder is known, so the caller keeps its default", () => {
	assert.equal(getRestoreTargetFolder(null, null), null);
	assert.equal(getRestoreTargetFolder(undefined, undefined), null);
});
