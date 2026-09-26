import { TRIAGE_ERROR_TAG } from "../lib/email-tags.ts";

export const THREAD_TRIAGE_ERROR_JOIN_SQL = `
	LEFT JOIN email_tags AS thread_triage_error
		ON thread_triage_error.email_id = all_emails_with_conversation.id
		AND thread_triage_error.tag = '${TRIAGE_ERROR_TAG}'
`;

export const THREAD_TRIAGE_ERROR_AGGREGATE_SQL = `
	MAX(CASE WHEN thread_triage_error.email_id IS NULL THEN 0 ELSE 1 END) AS has_triage_error
`;
