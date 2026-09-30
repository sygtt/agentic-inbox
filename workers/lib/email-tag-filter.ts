import { TRIAGE_ERROR_TAG } from "./email-tags.ts";

export const AVAILABLE_EMAIL_TAGS_SQL = `
	SELECT tag FROM email_tags
	UNION
	SELECT ?1 AS tag WHERE EXISTS (SELECT 1 FROM email_triage_failures)
	ORDER BY tag
`;

/** Build an exact tag-membership check from trusted SQL expressions. */
export function emailTagExistsSql(emailIdExpression: string, tagExpression: string): string {
	return `(
		EXISTS (
			SELECT 1 FROM email_tags AS tag_filter
			WHERE tag_filter.email_id = ${emailIdExpression}
			AND tag_filter.tag = ${tagExpression}
		)
		OR (
			${tagExpression} = '${TRIAGE_ERROR_TAG}'
			AND EXISTS (SELECT 1 FROM email_triage_failures WHERE email_id = ${emailIdExpression})
		)
	)`;
}
