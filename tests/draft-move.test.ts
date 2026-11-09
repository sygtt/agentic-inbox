// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { applyMigrations, mailboxMigrations } from "../workers/durableObject/migrations.ts";
import { canMoveEmail, canMoveThread } from "../workers/durableObject/draft-move.ts";
import { Folders } from "../shared/folders.ts";

test("migration marks only current Drafts and move guards preserve them", () => {
	const db = new DatabaseSync(":memory:");
	const sql = { exec(query: string, ...params: (string | number)[]) {
		if (params.length || /^select/i.test(query.trim())) return db.prepare(query).all(...params);
		db.exec(query);
		return [];
	} };
	const storage = { transactionSync<T>(callback: () => T) { return callback(); } };
	applyMigrations(sql as any, mailboxMigrations.slice(0, -1), storage);
	const insert = db.prepare("INSERT INTO emails (id, folder_id, subject) VALUES (?, ?, ?)");
	insert.run("draft", Folders.DRAFT, "draft");
	insert.run("inbox", Folders.INBOX, "ordinary");
	insert.run("old", Folders.ARCHIVE, "possibly old draft");
	applyMigrations(sql as any, mailboxMigrations, storage);
	assert.deepEqual(db.prepare("SELECT id, is_draft FROM emails ORDER BY id").all().map((row) => [row.id, row.is_draft]), [["draft", 1], ["inbox", 0], ["old", 0]]);
	applyMigrations(sql as any, mailboxMigrations, storage);
	assert.equal(canMoveEmail(1, Folders.ARCHIVE), false);
	assert.equal(canMoveEmail(0, Folders.DRAFT), false);
	assert.equal(canMoveEmail(0, Folders.ARCHIVE), true);
	assert.equal(canMoveThread(sql as any, ["draft"], Folders.DRAFT, Folders.INBOX), false);
	assert.equal(canMoveThread(sql as any, ["inbox"], Folders.INBOX, Folders.DRAFT), false);
	assert.equal(canMoveThread(sql as any, ["inbox", "draft"], Folders.INBOX, Folders.ARCHIVE), true);
	db.prepare("UPDATE emails SET folder_id = ? WHERE id = ?").run(Folders.INBOX, "draft");
	assert.equal(canMoveThread(sql as any, ["inbox", "draft"], Folders.INBOX, Folders.ARCHIVE), false);
	assert.equal(canMoveThread(sql as any, [...Array.from({ length: 99 }, (_, i) => `missing-${i}`), "draft"], Folders.INBOX, Folders.ARCHIVE), false);
	db.close();
});
