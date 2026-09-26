export const TRIAGE_REFRESH_INTERVAL_MS = 3_000;
export const TRIAGE_MAX_REFRESHES = 20;

interface RefreshableQuery {
	state: {
		status: string;
		dataUpdateCount: number;
		errorUpdateCount: number;
	};
}

export function getBoundedTriageRefetchInterval(
	query: RefreshableQuery,
): number | false {
	if (query.state.status === "error") return false;
	if (query.state.dataUpdateCount + query.state.errorUpdateCount >= TRIAGE_MAX_REFRESHES) {
		return false;
	}
	return TRIAGE_REFRESH_INTERVAL_MS;
}
