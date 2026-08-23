import assert from "node:assert/strict";
import { test } from "node:test";
import {
	isMailboxCreationAllowed,
	normalizeEmailAddress,
	resolveMailboxRoute,
} from "../workers/lib/mailbox-routing.ts";

const mailboxSet = (...mailboxes: string[]) => new Set(mailboxes);

test("normalizes valid addresses and rejects malformed values", () => {
	assert.equal(normalizeEmailAddress("  Alias@Example.com "), "alias@example.com");
	assert.equal(normalizeEmailAddress("not-an-email"), null);
	assert.equal(normalizeEmailAddress(undefined), null);
});

test("allows the configured catch-all mailbox through the creation allow-list", () => {
	assert.equal(
		isMailboxCreationAllowed(
			"all@example.com",
			["support@example.com"],
			"all@example.com",
		),
		true,
	);
	assert.equal(
		isMailboxCreationAllowed(
			"other@example.com",
			["support@example.com"],
			"all@example.com",
		),
		false,
	);
});

test("delivers an existing configured mailbox directly", () => {
	const result = resolveMailboxRoute({
		envelopeRecipient: "Support@Example.com",
		configuredAddresses: ["support@example.com"],
		configuredDomains: ["example.com"],
		catchAllMailbox: "all@example.com",
		knownMailboxes: mailboxSet("support@example.com", "all@example.com"),
	});

	assert.deepEqual(result, {
		kind: "direct",
		storageMailbox: "support@example.com",
		envelopeRecipient: "support@example.com",
	});
});

test("delivers a direct mailbox even when the optional catch-all is malformed", () => {
	const result = resolveMailboxRoute({
		envelopeRecipient: "support@example.com",
		configuredAddresses: ["support@example.com"],
		configuredDomains: ["example.com"],
		catchAllMailbox: "not-an-email",
		knownMailboxes: mailboxSet("support@example.com"),
	});

	assert.deepEqual(result, {
		kind: "direct",
		storageMailbox: "support@example.com",
		envelopeRecipient: "support@example.com",
	});
});

test("routes an unknown alias to the registered catch-all mailbox", () => {
	const result = resolveMailboxRoute({
		envelopeRecipient: "shop@example.com",
		configuredAddresses: ["support@example.com"],
		configuredDomains: ["example.com"],
		catchAllMailbox: "all@example.com",
		knownMailboxes: mailboxSet("support@example.com", "all@example.com"),
	});

	assert.deepEqual(result, {
		kind: "catch-all",
		storageMailbox: "all@example.com",
		envelopeRecipient: "shop@example.com",
	});
});

test("uses the envelope recipient even when it differs from visible headers", () => {
	const result = resolveMailboxRoute({
		envelopeRecipient: "secret-alias@example.com",
		configuredAddresses: [],
		configuredDomains: ["example.com"],
		catchAllMailbox: "all@example.com",
		knownMailboxes: mailboxSet("all@example.com"),
	});

	assert.equal(result.kind, "catch-all");
	if (result.kind === "catch-all") {
		assert.equal(result.envelopeRecipient, "secret-alias@example.com");
	}
});

test("rejects unknown recipients when catch-all routing is disabled", () => {
	const result = resolveMailboxRoute({
		envelopeRecipient: "unknown@example.com",
		configuredAddresses: [],
		configuredDomains: ["example.com"],
		catchAllMailbox: "",
		knownMailboxes: mailboxSet(),
	});

	assert.equal(result.kind, "reject");
});

test("does not treat an invalid non-empty allow-list as disabled", () => {
	const result = resolveMailboxRoute({
		envelopeRecipient: "support@example.com",
		configuredAddresses: ["not-an-email"],
		configuredDomains: ["example.com"],
		catchAllMailbox: "",
		knownMailboxes: mailboxSet("support@example.com"),
	});

	assert.deepEqual(result, {
		kind: "reject",
		reason: 'Recipient "support@example.com" is not configured',
	});
});

test("rejects a configured mailbox that is not registered", () => {
	const result = resolveMailboxRoute({
		envelopeRecipient: "support@example.com",
		configuredAddresses: ["support@example.com"],
		configuredDomains: ["example.com"],
		catchAllMailbox: "all@example.com",
		knownMailboxes: mailboxSet("all@example.com"),
	});

	assert.deepEqual(result, {
		kind: "reject",
		reason: 'Configured mailbox "support@example.com" is not registered',
	});
});

test("rejects when the catch-all mailbox is not registered", () => {
	const result = resolveMailboxRoute({
		envelopeRecipient: "unknown@example.com",
		configuredAddresses: [],
		configuredDomains: ["example.com"],
		catchAllMailbox: "all@example.com",
		knownMailboxes: mailboxSet(),
	});

	assert.deepEqual(result, {
		kind: "reject",
		reason: 'Catch-all mailbox "all@example.com" is not registered',
	});
});

test("rejects recipients outside configured domains", () => {
	const result = resolveMailboxRoute({
		envelopeRecipient: "unknown@other.example",
		configuredAddresses: [],
		configuredDomains: ["example.com"],
		catchAllMailbox: "all@example.com",
		knownMailboxes: mailboxSet("all@example.com"),
	});

	assert.deepEqual(result, {
		kind: "reject",
		reason: 'Recipient domain "other.example" is not configured',
	});
});
