import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSearchQuery } from "../app/lib/search-parser.ts";

test("parses an exact namespaced tag operator alongside other search filters", () => {
	assert.deepEqual(parseSearchQuery("invoice tag:disposition:action-required in:archive"), {
		query: "invoice",
		folder: "archive",
		tag: "disposition:action-required",
	});
});
