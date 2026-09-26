export const THREAD_TRIAGE_ERROR_JOIN_SQL = `
	LEFT JOIN email_triage_failures AS thread_triage_error
		ON thread_triage_error.email_id = all_emails_with_conversation.id
`;

export const THREAD_TRIAGE_ERROR_AGGREGATE_SQL = `
	MAX(CASE WHEN thread_triage_error.email_id IS NULL THEN 0 ELSE 1 END) AS has_triage_error
`;
