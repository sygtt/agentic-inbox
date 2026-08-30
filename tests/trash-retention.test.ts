import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { applyMigrations, mailboxMigrations } from "../workers/durableObject/migrations.ts";
import { canPermanentlyDelete, getTrashCutoff, getTrashTimestamp } from "../workers/lib/trash.ts";
import { deleteAttachmentObjects } from "../workers/lib/attachments.ts";
import { Folders } from "../shared/folders.ts";

test("Trash transitions preserve, set, and clear the retention timestamp", () => {
	const first = "2026-08-30T00:00:00.000Z";
	assert.equal(getTrashTimestamp(Folders.INBOX, Folders.TRASH, null, first), first);
	assert.equal(getTrashTimestamp(Folders.TRASH, Folders.TRASH, "2026-07-01T00:00:00.000Z", first), "2026-07-01T00:00:00.000Z");
	assert.equal(getTrashTimestamp(Folders.TRASH, Folders.INBOX, first), null);
	assert.equal(getTrashCutoff(Date.parse("2026-08-30T00:00:00.000Z")), "2026-07-31T00:00:00.000Z");
});

test("permanent deletion is allowed only for Trash and Draft", () => {
	assert.equal(canPermanentlyDelete(Folders.TRASH), true);
	assert.equal(canPermanentlyDelete(Folders.DRAFT), true);
	assert.equal(canPermanentlyDelete(Folders.INBOX), false);
	assert.equal(canPermanentlyDelete(Folders.SENT), false);
});

test("migration backfills existing Trash rows and leaves other rows null", () => {
	const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as any;
	const database = new DatabaseSync(":memory:");
	const sql = {
		exec(query: string, ...params: (string | number)[]) {
			const statement = database.prepare(query);
			if (params.length > 0) return statement.all(...params);
			if (/^select/i.test(query.trim())) return statement.all();
			database.exec(query);
			return [];
		},
	};
	const storage = { transactionSync<T>(callback: () => T) { return callback(); } };
	applyMigrations(sql, mailboxMigrations.slice(0, 10), storage);
	database.prepare("INSERT INTO emails (id, folder_id, subject) VALUES (?, ?, ?)").run("trash", Folders.TRASH, "Trash");
	database.prepare("INSERT INTO emails (id, folder_id, subject) VALUES (?, ?, ?)").run("inbox", Folders.INBOX, "Inbox");
	applyMigrations(sql, mailboxMigrations, storage);
	const trash = database.prepare("SELECT trashed_at FROM emails WHERE id = ?").get("trash") as { trashed_at: string };
	const inbox = database.prepare("SELECT trashed_at FROM emails WHERE id = ?").get("inbox") as { trashed_at: string | null };
	assert.match(trash.trashed_at, /^\d{4}-\d\d-\d\dT/);
	assert.equal(inbox.trashed_at, null);
	const timestamp = trash.trashed_at;
	applyMigrations(sql, mailboxMigrations, storage);
	assert.equal((database.prepare("SELECT trashed_at FROM emails WHERE id = ?").get("trash") as { trashed_at: string }).trashed_at, timestamp);
	database.close();
});

test("attachment deletion uses the persisted R2 object key", async () => {
	const deleted: string[][] = [];
	const bucket = { delete: async (keys: string[]) => { deleted.push(keys); } } as any;
	await deleteAttachmentObjects(bucket, "email-1", [{ id: "att-1", filename: "report.pdf" }]);
	assert.deepEqual(deleted, [["attachments/email-1/att-1/report.pdf"]]);
});
