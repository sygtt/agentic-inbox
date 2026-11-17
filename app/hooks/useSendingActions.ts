// SPDX-License-Identifier: Apache-2.0
import { useMailbox } from "~/queries/mailboxes";

// No default-on flash before this mailbox's settings have loaded.
export function useSendingActions(mailboxId: string | undefined) {
	const { data: mailbox } = useMailbox(mailboxId);
	return !!mailbox && mailbox.settings?.showSendingActions !== false;
}
