// SPDX-License-Identifier: Apache-2.0
import { Folders } from "../../shared/folders.ts";

export function canMoveEmail(isDraft: number, destination: string): boolean {
	return !isDraft && destination !== Folders.DRAFT;
}

export function canMoveThread(sql: Pick<SqlStorage, "exec">, ids: string[], source: string, destination: string): boolean {
	if (source === Folders.DRAFT || destination === Folders.DRAFT) return false;
	for (let start = 0; start < ids.length; start += 99) {
		const batch = ids.slice(start, start + 99);
		const placeholders = batch.map(() => "?").join(",");
		if ([...sql.exec(`SELECT 1 FROM emails WHERE folder_id = ? AND is_draft = 1 AND id IN (${placeholders}) LIMIT 1`, source, ...batch)].length) return false;
	}
	return true;
}
