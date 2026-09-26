import assert from "node:assert/strict";
import { test } from "node:test";
import {
	getBoundedTriageRefetchInterval,
	shouldRefreshAnalysisAfterTriageRecovery,
	TRIAGE_MAX_REFRESHES,
	TRIAGE_REFRESH_INTERVAL_MS,
} from "../app/lib/triage-refresh.ts";

function queryState(status: string, dataUpdateCount = 0, errorUpdateCount = 0) {
	return { state: { status, dataUpdateCount, errorUpdateCount } };
}

test("triage refresh uses a short interval with a fixed attempt budget", () => {
	assert.equal(getBoundedTriageRefetchInterval(queryState("pending")), TRIAGE_REFRESH_INTERVAL_MS);
	assert.equal(
		getBoundedTriageRefetchInterval(queryState("success", TRIAGE_MAX_REFRESHES - 1)),
		TRIAGE_REFRESH_INTERVAL_MS,
	);
	assert.equal(
		getBoundedTriageRefetchInterval(queryState("success", TRIAGE_MAX_REFRESHES)),
		false,
	);
	assert.equal(getBoundedTriageRefetchInterval(queryState("error")), false);
});

test("refreshes analysis after a previously observed triage failure clears", () => {
	assert.equal(shouldRefreshAnalysisAfterTriageRecovery(false, false, true), false);
	assert.equal(shouldRefreshAnalysisAfterTriageRecovery(true, true, true), false);
	assert.equal(shouldRefreshAnalysisAfterTriageRecovery(true, false, false), false);
	assert.equal(shouldRefreshAnalysisAfterTriageRecovery(true, false, true), true);
});
