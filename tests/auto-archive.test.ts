import assert from "node:assert/strict";
import { test } from "node:test";
import { Folders } from "../shared/folders.ts";
import { archiveAutoFiledEmail } from "../workers/agent/auto-archive.ts";

function fakeStorage(moveEmail: (emailId: string, folderId: string) => Promise<boolean>) {
	const calls: Array<{ emailId: string; folderId: string }> = [];
	return {
		calls,
		storage: {
			async moveEmail(emailId: string, folderId: string) {
				calls.push({ emailId, folderId });
				return moveEmail(emailId, folderId);
			},
		},
	};
}

const autoFiled = {
	status: "triaged",
	predictedDisposition: "auto-file",
	dispositionApplied: true,
};

test("archives a newly triaged email after its auto-file disposition was applied", async () => {
	const { calls, storage } = fakeStorage(async () => true);

	const result = await archiveAutoFiledEmail(storage, "email-1", autoFiled, () => {});

	assert.equal(result, "archived");
	assert.deepEqual(calls, [{ emailId: "email-1", folderId: Folders.ARCHIVE }]);
});

test("does not archive other dispositions, failed triage, missing emails, or preserved manual tags", async () => {
	const { calls, storage } = fakeStorage(async () => true);
	const outcomes = [
		{ status: "triaged", predictedDisposition: "review", dispositionApplied: true },
		{ status: "triaged", predictedDisposition: "action-required", dispositionApplied: true },
		{ status: "triaged", predictedDisposition: "auto-file", dispositionApplied: false },
		{ status: "triage_failed", predictedDisposition: "auto-file", dispositionApplied: false },
		{ status: "email_not_found", predictedDisposition: "auto-file", dispositionApplied: false },
	];

	for (const outcome of outcomes) {
		assert.equal(await archiveAutoFiledEmail(storage, "email-1", outcome, () => {}), "skipped");
	}
	assert.deepEqual(calls, []);
});

test("logs a rejected archive move without changing the successful triage result", async () => {
	const { storage } = fakeStorage(async () => false);
	const logs: unknown[][] = [];

	const result = await archiveAutoFiledEmail(storage, "email-1", autoFiled, (...values) => logs.push(values));

	assert.equal(result, "failed");
	assert.deepEqual(logs, [["Auto-archive failed: email could not be moved to Archive", "email-1"]]);
});

test("logs archive exceptions and keeps them separate from triage failures", async () => {
	const { storage } = fakeStorage(async () => { throw new Error("storage unavailable"); });
	const logs: unknown[][] = [];

	const result = await archiveAutoFiledEmail(storage, "email-1", autoFiled, (...values) => logs.push(values));

	assert.equal(result, "failed");
	assert.deepEqual(logs, [["Auto-archive failed:", "email-1", "storage unavailable"]]);
});
