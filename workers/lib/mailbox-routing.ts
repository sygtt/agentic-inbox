// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { z } from "zod";

const EmailAddress = z.string().trim().toLowerCase().email();

export type MailboxRouteDecision =
	| {
			kind: "direct";
			storageMailbox: string;
			envelopeRecipient: string;
		}
	| {
			kind: "catch-all";
			storageMailbox: string;
			envelopeRecipient: string;
		}
	| {
			kind: "reject";
			reason: string;
		};

export interface MailboxRouteOptions {
	envelopeRecipient: unknown;
	configuredAddresses: readonly unknown[];
	configuredDomains?: readonly unknown[];
	catchAllMailbox?: unknown;
	knownMailboxes: ReadonlySet<string>;
}

/**
 * Normalize a single email address for routing and mailbox identity checks.
 * Returns null for missing or malformed values.
 */
export function normalizeEmailAddress(value: unknown): string | null {
	const parsed = EmailAddress.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/**
 * Resolve the storage mailbox without changing the original SMTP recipient.
 *
 * `configuredAddresses` is the optional EMAIL_ADDRESSES allow-list. When it
 * is present, addresses outside the list can only use the configured
 * catch-all mailbox. `knownMailboxes` represents the R2 mailbox registry
 * entries checked by the caller.
 */
export function resolveMailboxRoute({
	envelopeRecipient: rawEnvelopeRecipient,
	configuredAddresses: rawConfiguredAddresses,
	configuredDomains: configuredDomainsInput = [],
	catchAllMailbox: rawCatchAllMailbox,
	knownMailboxes,
}: MailboxRouteOptions): MailboxRouteDecision {
	const envelopeRecipient = normalizeEmailAddress(rawEnvelopeRecipient);
	if (!envelopeRecipient) {
		return {
			kind: "reject",
			reason: "Inbound email has no valid SMTP envelope recipient",
		};
	}

	const configuredAddresses = rawConfiguredAddresses
		.map(normalizeEmailAddress)
		.filter((address): address is string => address !== null);
	const configuredSet = new Set(configuredAddresses);
	const configuredDomains = (configuredDomainsInput ?? [])
		.map((domain) => String(domain).trim().toLowerCase())
		.filter(Boolean);
	const envelopeDomain = envelopeRecipient.split("@")[1];
	if (configuredDomains.length > 0 && !configuredDomains.includes(envelopeDomain)) {
		return {
			kind: "reject",
			reason: `Recipient domain "${envelopeDomain}" is not configured`,
		};
	}

	const catchAllMailbox = rawCatchAllMailbox
		? normalizeEmailAddress(rawCatchAllMailbox)
		: null;
	if (rawCatchAllMailbox && !catchAllMailbox) {
		return {
			kind: "reject",
			reason: "CATCH_ALL_MAILBOX is not a valid email address",
		};
	}
	if (
		catchAllMailbox &&
		configuredDomains.length > 0 &&
		!configuredDomains.includes(catchAllMailbox.split("@")[1])
	) {
		return {
			kind: "reject",
			reason: `CATCH_ALL_MAILBOX domain "${catchAllMailbox.split("@")[1]}" is not configured`,
		};
	}

	const isAllowListed =
		configuredSet.size === 0 || configuredSet.has(envelopeRecipient);
	const envelopeMailboxExists = knownMailboxes.has(envelopeRecipient);

	if (isAllowListed && envelopeMailboxExists) {
		return {
			kind: "direct",
			storageMailbox: envelopeRecipient,
			envelopeRecipient,
		};
	}

	if (configuredSet.has(envelopeRecipient) && !envelopeMailboxExists) {
		return {
			kind: "reject",
			reason: `Configured mailbox "${envelopeRecipient}" is not registered`,
		};
	}

	if (catchAllMailbox) {
		if (!knownMailboxes.has(catchAllMailbox)) {
			return {
				kind: "reject",
				reason: `Catch-all mailbox "${catchAllMailbox}" is not registered`,
			};
		}

		return {
			kind: "catch-all",
			storageMailbox: catchAllMailbox,
			envelopeRecipient,
		};
	}

	return {
		kind: "reject",
		reason: configuredSet.size > 0
			? `Recipient "${envelopeRecipient}" is not configured`
			: `Mailbox "${envelopeRecipient}" is not registered and catch-all routing is disabled`,
	};
}
