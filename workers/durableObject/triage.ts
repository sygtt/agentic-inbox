// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { DISPOSITION_VALUES } from "../lib/email-tags.ts";
import type { PersistedEmailTriageResult } from "../lib/email-triage.ts";

export interface TriageStorage {
	sql: SqlStorage;
	transactionSync<T>(closure: () => T): T;
}

export function applyEmailTriageResult(
	storage: TriageStorage,
	id: string,
	result: PersistedEmailTriageResult,
) {
	if (!DISPOSITION_VALUES.includes(result.predictedDisposition)) {
		throw new Error(`Invalid triage disposition: ${result.predictedDisposition}`);
	}
	const featuresJson = JSON.stringify(result.features);
	const analyzedAt = new Date().toISOString();

	return storage.transactionSync(() => {
		const email = [
			...storage.sql.exec(
				"SELECT id FROM emails WHERE id = ?1",
				id,
			),
		] as { id: string }[];
		if (email.length === 0) return null;

		storage.sql.exec(
			`INSERT INTO email_triage_analysis
				(email_id, schema_version, policy_version, model, features_json, predicted_disposition, analyzed_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
			 ON CONFLICT(email_id) DO UPDATE SET
				schema_version = excluded.schema_version,
				policy_version = excluded.policy_version,
				model = excluded.model,
				features_json = excluded.features_json,
				predicted_disposition = excluded.predicted_disposition,
				analyzed_at = excluded.analyzed_at`,
			id,
			result.schemaVersion,
			result.policyVersion,
			result.model,
			featuresJson,
			result.predictedDisposition,
			analyzedAt,
		);

		const manualDisposition = [
			...storage.sql.exec(
				`SELECT tag FROM email_tags
				 WHERE email_id = ?1
				   AND tag LIKE 'disposition:%'
				   AND provenance = 'manual'
				 LIMIT 1`,
				id,
			),
		];
		if (manualDisposition.length > 0) {
			return {
				dispositionApplied: false,
				manualDispositionPreserved: true,
			};
		}

		const tag = `disposition:${result.predictedDisposition}`;
		storage.sql.exec(
			`DELETE FROM email_tags WHERE email_id = ?1 AND tag LIKE 'disposition:%'`,
			id,
		);
		storage.sql.exec(
			`INSERT INTO email_tags (email_id, tag, provenance) VALUES (?1, ?2, 'agent')`,
			id,
			tag,
		);
		return {
			dispositionApplied: true,
			manualDispositionPreserved: false,
		};
	});
}

export function setEmailDisposition(
	storage: TriageStorage,
	id: string,
	value: string,
	provenance: string,
) {
	return storage.transactionSync(() => {
		const email = [
			...storage.sql.exec(
				"SELECT id FROM emails WHERE id = ?1",
				id,
			),
		] as { id: string }[];
		if (email.length === 0) return null;

		const currentDisposition = [
			...storage.sql.exec(
				`SELECT tag FROM email_tags
				 WHERE email_id = ?1
				   AND tag LIKE 'disposition:%'
				 LIMIT 1`,
				id,
			),
		] as { tag: string }[];
		const previousValue = currentDisposition[0]?.tag.startsWith("disposition:")
			? currentDisposition[0].tag.slice("disposition:".length)
			: null;
		const analysis = [
			...storage.sql.exec(
				`SELECT schema_version, policy_version, model
				 FROM email_triage_analysis
				 WHERE email_id = ?1`,
				id,
			),
		] as {
			schema_version: number | null;
			policy_version: number | null;
			model: string | null;
		}[];

		const tag = `disposition:${value}`;
		storage.sql.exec(
			`DELETE FROM email_tags WHERE email_id = ?1 AND tag LIKE 'disposition:%'`,
			id,
		);
		storage.sql.exec(
			`INSERT INTO email_tags (email_id, tag, provenance) VALUES (?1, ?2, ?3)`,
			id,
			tag,
			provenance,
		);

		if (provenance === "manual" && previousValue !== value) {
			const latestAnalysis = analysis[0];
			storage.sql.exec(
				`INSERT INTO email_triage_feedback
					(id, email_id, event_type, previous_value, new_value,
					 feature_schema_version, policy_version, model, created_at)
				 VALUES (?1, ?2, 'manual_disposition', ?3, ?4, ?5, ?6, ?7, ?8)`,
				crypto.randomUUID(),
				id,
				previousValue,
				value,
				latestAnalysis?.schema_version ?? null,
				latestAnalysis?.policy_version ?? null,
				latestAnalysis?.model ?? null,
				new Date().toISOString(),
			);
		}

		return { tag, provenance };
	});
}
