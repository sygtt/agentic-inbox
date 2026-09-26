import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "~/services/api";
import { getBoundedTriageRefetchInterval } from "~/lib/triage-refresh";
import type { EmailTag } from "~/types";
import { queryKeys } from "./keys";

export function useAvailableEmailTags(mailboxId: string | undefined) {
	return useQuery<string[]>({
		queryKey: mailboxId
			? queryKeys.emailTags.available(mailboxId)
			: ["email-tags", "_disabled_available"],
		queryFn: () => api.listEmailTags(mailboxId!),
		enabled: !!mailboxId,
		refetchInterval: 30_000,
	});
}

export function useEmailTags(
	mailboxId: string | undefined,
	emailId: string | undefined,
	options?: { enabled?: boolean; refreshWhileTriagePending?: boolean },
) {
	return useQuery<EmailTag[]>({
		queryKey: mailboxId && emailId
			? queryKeys.emailTags.list(mailboxId, emailId)
			: ["email-tags", "_disabled"],
		queryFn: () => api.getEmailTags(mailboxId!, emailId!),
		enabled: !!mailboxId && !!emailId && (options?.enabled ?? true),
		refetchInterval: options?.refreshWhileTriagePending
			? (query) => {
				return getBoundedTriageRefetchInterval(query);
			}
			: false,
	});
}

export function useUpsertEmailTag() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ mailboxId, emailId, tag }: { mailboxId: string; emailId: string; tag: string }) =>
			api.upsertEmailTag(mailboxId, emailId, tag),
		onSuccess: (_data, { mailboxId, emailId }) => {
			qc.invalidateQueries({ queryKey: queryKeys.emailTags.list(mailboxId, emailId) });
			qc.invalidateQueries({ queryKey: queryKeys.emailTags.available(mailboxId) });
			qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
			qc.invalidateQueries({ queryKey: ["search", mailboxId] });
		},
	});
}

export function useRemoveEmailTag() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ mailboxId, emailId, tag }: { mailboxId: string; emailId: string; tag: string }) =>
			api.removeEmailTag(mailboxId, emailId, tag),
		onSuccess: (_data, { mailboxId, emailId }) => {
			qc.invalidateQueries({ queryKey: queryKeys.emailTags.list(mailboxId, emailId) });
			qc.invalidateQueries({ queryKey: queryKeys.emailTags.available(mailboxId) });
			qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
			qc.invalidateQueries({ queryKey: ["search", mailboxId] });
		},
	});
}

export function useSetEmailDisposition() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ mailboxId, emailId, value }: { mailboxId: string; emailId: string; value: string }) =>
			api.setEmailDisposition(mailboxId, emailId, value),
		onSuccess: (_data, { mailboxId, emailId }) => {
			qc.invalidateQueries({ queryKey: queryKeys.emailTags.list(mailboxId, emailId) });
			qc.invalidateQueries({ queryKey: queryKeys.emailTags.available(mailboxId) });
			qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
			qc.invalidateQueries({ queryKey: ["search", mailboxId] });
		},
	});
}
