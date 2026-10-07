// SPDX-License-Identifier: Apache-2.0

/**
 * Folder an email must be restored to when a Trash deletion is undone.
 *
 * The email's own folder wins: `?email=` links survive in history, bookmarks and
 * hand-edited URLs, so the folder segment of the route can describe a view the
 * email is not actually in (for example `/emails/inbox?email=<archived id>`).
 * Restoring by the route folder in that case silently files the message into the
 * wrong folder. The route folder is only a fallback, for when the email's own
 * folder is unknown.
 *
 * Returns null when neither is known, so the caller keeps its own default.
 */
export function getRestoreTargetFolder(
	emailFolderId: string | null | undefined,
	routeFolder: string | null | undefined,
): string | null {
	return emailFolderId || routeFolder || null;
}
