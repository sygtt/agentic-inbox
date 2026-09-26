// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useQuery } from "@tanstack/react-query";
import api from "~/services/api";
import type { EmailTriageAnalysis } from "~/types";
import { queryKeys } from "./keys";

export function useEmailTriageAnalysis(
	mailboxId: string | undefined,
	emailId: string | undefined,
	options?: { enabled?: boolean },
) {
	return useQuery<EmailTriageAnalysis | null>({
		queryKey: mailboxId && emailId
			? queryKeys.emailTriage.analysis(mailboxId, emailId)
			: ["email-triage", "_disabled"],
		queryFn: ({ signal }) => api.getEmailTriageAnalysis(mailboxId!, emailId!, { signal }),
		enabled: !!mailboxId && !!emailId && (options?.enabled ?? true),
	});
}
