// SPDX-License-Identifier: Apache-2.0
import { DEFAULT_TRIAGE_POLICY, TriagePolicySchema, decideDisposition, type TriagePolicy } from "../lib/email-triage.ts";
import { getEmailTriageAnalysis, type TriageStorage } from "./triage.ts";
export function readTriagePolicy(storage: TriageStorage) {
	const rows = [...storage.sql.exec("SELECT revision, policy_json, reason, created_at FROM triage_policy_history ORDER BY revision DESC LIMIT 1")] as {
		revision: number;
		policy_json: string;
		reason: string;
		created_at: string;
	}[];
	const row = rows[0];
	return { revision: row?.revision ?? 0, policy: row ? TriagePolicySchema.parse(JSON.parse(row.policy_json)) : { ...DEFAULT_TRIAGE_POLICY }, reason: row?.reason ?? null, updatedAt: row?.created_at ?? null };
}
export function updateTriagePolicy(storage: TriageStorage, policy: TriagePolicy, expectedRevision: number, reason: string) {
	const parsed = TriagePolicySchema.parse(policy);
	if (!Number.isInteger(expectedRevision) || expectedRevision < 0 || !reason.trim() || reason.length > 1000)
		throw new Error("Invalid revision or reason");
	return storage.transactionSync(() => {
		const current = readTriagePolicy(storage);
		if (current.revision !== expectedRevision)
			return { error: "Policy changed; read and preview again", currentRevision: current.revision };
		storage.sql.exec("INSERT INTO triage_policy_history (revision, policy_json, reason, created_at) VALUES (?1, ?2, ?3, ?4)", current.revision + 1, JSON.stringify(parsed), reason.trim(), new Date().toISOString());
		return readTriagePolicy(storage);
	});
}
export function compareTriageEmails(storage: TriageStorage, ids: string[], candidate?: TriagePolicy) {
	if (!ids.length || ids.length > 50 || new Set(ids).size !== ids.length)
		throw new Error("Supply 1-50 distinct email IDs");
	const current = readTriagePolicy(storage);
	const policy = candidate ? TriagePolicySchema.parse(candidate) : current.policy;
	const emails = ids.map(emailId => {
		const lookup = getEmailTriageAnalysis(storage, emailId);
		const tags = lookup.emailExists ? [...storage.sql.exec("SELECT tag, provenance FROM email_tags WHERE email_id = ?1 AND tag LIKE 'disposition:%'", emailId)] : [];
		return { emailId, ...lookup, currentTags: tags, currentPolicyPrediction: lookup.analysis ? decideDisposition(lookup.analysis.features, current.policy) : null, candidatePrediction: lookup.analysis ? decideDisposition(lookup.analysis.features, policy) : null };
	});
	return { ...current, candidatePolicy: policy, emails };
}
export function reapplyTriagePolicy(storage: TriageStorage, ids: string[], expectedRevision: number) {
	return storage.transactionSync(() => {
		const comparison = compareTriageEmails(storage, ids);
		if (comparison.revision !== expectedRevision)
			return { error: "Policy changed; preview again" };
		if (comparison.emails.some(email => !email.emailExists || !email.analysis))
			return { error: "Every email must exist and have a successful analysis" };
		const emails = comparison.emails.map(email => {
			if (email.currentTags.some(tag => tag.provenance === "manual"))
				return { emailId: email.emailId, manualDispositionPreserved: true };
			const tag = `disposition:${email.candidatePrediction}`;
			storage.sql.exec("DELETE FROM email_tags WHERE email_id = ?1 AND tag LIKE 'disposition:%'", email.emailId);
			storage.sql.exec("INSERT INTO email_tags (email_id, tag, provenance) VALUES (?1, ?2, 'agent')", email.emailId, tag);
			return { emailId: email.emailId, dispositionApplied: true, tag, provenance: "agent" };
		});
		return { revision: comparison.revision, emails };
	});
}
