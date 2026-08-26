import assert from "node:assert/strict";
import { test } from "node:test";
import { extractVerificationCode } from "../app/lib/verification-code.ts";

test("extracts a contextual 4–8 digit verification code", () => {
	assert.equal(
		extractVerificationCode("Your verification code", "Use 482913 to verify your sign-in."),
		"482913",
	);
	assert.equal(extractVerificationCode(null, "Use 482913 to verify your sign-in."), "482913");
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
