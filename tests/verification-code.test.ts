// SPDX-License-Identifier: Apache-2.0
import assert from "node:assert/strict";
import { test } from "node:test";
import {
	extractVerificationCode,
	extractVerificationCodeCandidates,
	resolveVerificationCode,
} from "../app/lib/verification-code.ts";

test("extracts a contextual 4–8 digit verification code", () => {
	assert.equal(
		extractVerificationCode("Your verification code", "Use 482913 to verify your sign-in."),
		"482913",
	);
	assert.equal(extractVerificationCode(null, "Use 482913 to verify your sign-in."), "482913");
	assert.equal(extractVerificationCode("Your OTP", "OTP: 482913"), "482913");
	assert.equal(extractVerificationCode("", "Your OTP is 482913"), "482913");
});

test("supports codes in HTML messages", () => {
	assert.equal(
		extractVerificationCode("Security alert", "<p>Your one-time password is <strong>1234</strong>.</p>"),
		"1234",
	);
});

test("does not label an arbitrary number as a verification code", () => {
	assert.equal(extractVerificationCode("Order confirmation", "Your order number is 123456."), null);
	assert.equal(extractVerificationCode("Hello", "Your invoice total is 1234."), null);
	assert.equal(extractVerificationCode("Security alert", "A new sign-in was detected on August 26, 2026."), null);
	assert.equal(extractVerificationCode("Verify your account", "The event occurred on August 26, 2026."), null);
	assert.equal(extractVerificationCode("", "Use the link below to verify your account. Copyright 2026."), null);
	assert.equal(extractVerificationCode("", "Your verification code expires in 2026. The code is 654321."), "654321");
	assert.equal(
		extractVerificationCode("Your verification code", "2026 annual notice. Your code is 654321."),
		"654321",
	);
});

test("chooses the code closest to its verification context", () => {
	assert.equal(
		extractVerificationCode("", "Order 123456 is ready. Your verification code is 654321."),
		"654321",
	);
});

test("rejects numbers outside the supported code length", () => {
	assert.equal(extractVerificationCode("Verification code", "Use 123456789 to verify."), null);
});

test("extracts stable candidates from subject and body without relying on English context", () => {
	assert.deepEqual(
		extractVerificationCodeCandidates("Your code expires in 2026", "Su código de verificación es 006543."),
		[
			{ id: "candidate_1", value: "2026" },
			{ id: "candidate_2", value: "006543" },
		],
	);
	assert.deepEqual(
		extractVerificationCodeCandidates("", "<p>Use <strong>482913</strong></p> <p>Ref 482913</p>"),
		[{ id: "candidate_1", value: "482913" }],
	);
});

test("uses only a valid Jev candidate selection and preserves deterministic fallback", () => {
	const subject = "Your verification code";
	const body = "Use 482913 to verify. Order 617204 is ready.";
	assert.equal(resolveVerificationCode(subject, body, { candidateId: "candidate_2", candidateValue: "617204" }), "617204");
	assert.equal(resolveVerificationCode(subject, body, { candidateId: null }), null);
	assert.equal(
		resolveVerificationCode(subject, body, {
			candidateId: null,
			candidateValue: null,
			candidateSetComplete: false,
		}),
		"482913",
	);
	assert.equal(
		resolveVerificationCode(subject, `${"x".repeat(12_000)} Your verification code is 654321.`, {
			candidateId: null,
			candidateSetComplete: false,
		}),
		"654321",
	);
	assert.equal(resolveVerificationCode(subject, body, { candidateId: "candidate_99" }), "482913");
	assert.equal(resolveVerificationCode(subject, body), "482913");
});

test("uses the server-derived candidate mapping when HTML normalization differs", () => {
	const body = '<p><img alt="1111"> ... 2222</p>';
	assert.equal(
		resolveVerificationCode("Security alert", body, {
			candidateId: "candidate_1",
			candidateValue: "1111",
		}),
		"1111",
	);
});
