import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const publicUrl = new URL("../public/", import.meta.url);

function pngSize(bytes: Buffer) {
	assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
	assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("PWA manifest declares Japanese install metadata and raster icons", async () => {
	const manifest = JSON.parse(
		await readFile(new URL("manifest.webmanifest", publicUrl), "utf8"),
	) as {
		lang: string;
		start_url: string;
		scope: string;
		display: string;
		icons: Array<{ src: string; sizes: string; type: string; purpose: string }>;
	};

	assert.equal(manifest.lang, "ja");
	assert.equal(manifest.start_url, "/");
	assert.equal(manifest.scope, "/");
	assert.equal(manifest.display, "standalone");
	assert.deepEqual(
		manifest.icons.map((icon) => [icon.src, icon.sizes, icon.type, icon.purpose]),
		[
			["/icon-192.png", "192x192", "image/png", "any"],
			["/icon-512.png", "512x512", "image/png", "any"],
			["/icon-maskable-512.png", "512x512", "image/png", "maskable"],
		],
	);
});

test("PWA icon files have the declared dimensions", async () => {
	const regularIcon = await readFile(new URL("icon-512.png", publicUrl));
	const maskableIcon = await readFile(new URL("icon-maskable-512.png", publicUrl));
	assert.notDeepEqual(maskableIcon, regularIcon);

	for (const [filename, size] of [
		["icon-192.png", 192],
		["icon-512.png", 512],
		["icon-maskable-512.png", 512],
	] as const) {
		assert.deepEqual(pngSize(await readFile(new URL(filename, publicUrl))), {
			width: size,
			height: size,
		});
	}
});
