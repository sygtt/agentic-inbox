// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "~/services/api";
import type { MailRule, MailRuleInput } from "~/types";
import { queryKeys } from "./keys";

export function useMailRules(mailboxId: string | undefined) {
	return useQuery<MailRule[]>({
		queryKey: mailboxId ? queryKeys.rules.list(mailboxId) : ["rules", "_disabled"],
		queryFn: () => api.listMailRules(mailboxId!),
		enabled: !!mailboxId,
	});
}

function useMailRuleMutation<TVariables>(
	mutationFn: (variables: TVariables) => Promise<unknown>,
) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn,
		onSuccess: (_data, variables) => {
			const mailboxId = (variables as { mailboxId: string }).mailboxId;
			return queryClient.invalidateQueries({ queryKey: queryKeys.rules.list(mailboxId) });
		},
	});
}

export function useCreateMailRule() {
	return useMailRuleMutation(({ mailboxId, rule }: { mailboxId: string; rule: MailRuleInput }) =>
		api.createMailRule(mailboxId, rule));
}

export function useUpdateMailRule() {
	return useMailRuleMutation(({ mailboxId, id, rule }: { mailboxId: string; id: string; rule: MailRuleInput }) =>
		api.updateMailRule(mailboxId, id, rule));
}

export function useSetMailRuleEnabled() {
	return useMailRuleMutation(({ mailboxId, id, enabled }: { mailboxId: string; id: string; enabled: boolean }) =>
		api.setMailRuleEnabled(mailboxId, id, enabled));
}

export function useDeleteMailRule() {
	return useMailRuleMutation(({ mailboxId, id }: { mailboxId: string; id: string }) =>
		api.deleteMailRule(mailboxId, id));
}

export function useReorderMailRules() {
	return useMailRuleMutation(({ mailboxId, ruleIds }: { mailboxId: string; ruleIds: string[] }) =>
		api.reorderMailRules(mailboxId, ruleIds));
}
