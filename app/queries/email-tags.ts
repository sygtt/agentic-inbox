import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "~/services/api";
import type { EmailTag } from "~/types";
import { queryKeys } from "./keys";

export function useEmailTags(
	mailboxId: string | undefined,
	emailId: string | undefined,
	options?: { enabled?: boolean },
) {
	return useQuery<EmailTag[]>({
		queryKey: mailboxId && emailId
			? queryKeys.emailTags.list(mailboxId, emailId)
			: ["email-tags", "_disabled"],
		queryFn: () => api.getEmailTags(mailboxId!, emailId!),
		enabled: !!mailboxId && !!emailId && (options?.enabled ?? true),
	});
}

export function useUpsertEmailTag() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ mailboxId, emailId, tag }: { mailboxId: string; emailId: string; tag: string }) =>
			api.upsertEmailTag(mailboxId, emailId, tag),
		onSuccess: (_data, { mailboxId, emailId }) => {
			qc.invalidateQueries({ queryKey: queryKeys.emailTags.list(mailboxId, emailId) });
			qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
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
			qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
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
			qc.invalidateQueries({ queryKey: ["emails", mailboxId] });
		},
	});
}
