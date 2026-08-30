import { Folders } from "../../shared/folders.ts";

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function canPermanentlyDelete(folderId: string): boolean {
	return folderId === Folders.TRASH || folderId === Folders.DRAFT;
}

export function getTrashTimestamp(
	currentFolderId: string | null | undefined,
	targetFolderId: string,
	currentTimestamp: string | null | undefined,
	now = new Date().toISOString(),
): string | null {
	if (targetFolderId !== Folders.TRASH) return null;
	return currentFolderId === Folders.TRASH ? currentTimestamp ?? null : now;
}

export function getTrashCutoff(now = Date.now()): string {
	return new Date(now - TRASH_RETENTION_MS).toISOString();
}
