import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveAutoFiledEmail } from "../workers/agent/auto-archive.ts";

function fakeStorage(archiveEmail: (emailId: string) => Promise<"archived" | "skipped">) {
	const calls: string[] = [];
	return {
		calls,
		storage: {
			async archiveAutoFiledEmailIfInInbox(emailId: string) {
				calls.push(emailId);
				return archiveEmail(emailId);
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
	const { calls, storage } = fakeStorage(async () => "archived");

	const result = await archiveAutoFiledEmail(storage, "email-1", autoFiled, () => {});

	assert.equal(result, "archived");
	assert.deepEqual(calls, ["email-1"]);
});

test("does not archive other dispositions, failed triage, missing emails, or preserved manual tags", async () => {
	const { calls, storage } = fakeStorage(async () => "archived");
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

test("keeps a manual folder move or disposition change made during triage", async () => {
	const { calls, storage } = fakeStorage(async () => "skipped");
	const logs: unknown[][] = [];

	const result = await archiveAutoFiledEmail(storage, "email-1", autoFiled, (...values) => logs.push(values));

	assert.equal(result, "skipped");
	assert.deepEqual(calls, ["email-1"]);
	assert.deepEqual(logs, []);
});

test("logs an archive exception without changing the successful triage result", async () => {
	const { storage } = fakeStorage(async () => { throw new Error("archive folder unavailable"); });
	const logs: unknown[][] = [];

	const result = await archiveAutoFiledEmail(storage, "email-1", autoFiled, (...values) => logs.push(values));

	assert.equal(result, "failed");
	assert.deepEqual(logs, [["Auto-archive failed:", "email-1", "archive folder unavailable"]]);
});
