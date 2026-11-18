// SPDX-License-Identifier: Apache-2.0
// Fork-authored semantic palettes; no external palette or implementation copied.
export const themes = {
	"amethyst-light": {
		"name": "Amethyst Light",
		"mode": "light",
		"colors": {
			"canvas": "#f5f2fa",
			"surface": "#faf8ff",
			"surfaceContainer": "#f0edf7",
			"surfaceElevated": "#e9e5f1",
			"onSurface": "#1d1b24",
			"onSurfaceMuted": "#494453",
			"primary": "#59478b",
			"onPrimary": "#ffffff",
			"primaryContainer": "#e8ddff",
			"onPrimaryContainer": "#35235d",
			"outline": "#797282",
			"focus": "#59478b",
			"danger": "#a12830",
			"onDanger": "#ffffff",
			"dangerContainer": "#ffdad6",
			"success": "#24633d",
			"warning": "#755400",
			"mailUnread": "#eee7fa",
			"mailSelected": "#e8ddff",
			"mailHover": "#e9e5f1",
			"mailStar": "#755400",
			"navActive": "#e8ddff",
			"tagNeutral": "#e9e5f1"
		}
	},
	"amethyst-dark": {
		"name": "Amethyst Dark",
		"mode": "dark",
		"colors": {
			"canvas": "#15121c",
			"surface": "#1e1a27",
			"surfaceContainer": "#282232",
			"surfaceElevated": "#352e40",
			"onSurface": "#f1eaf9",
			"onSurfaceMuted": "#d0c5dc",
			"primary": "#d1baff",
			"onPrimary": "#2c174c",
			"primaryContainer": "#493565",
			"onPrimaryContainer": "#f0e5ff",
			"outline": "#a297b0",
			"focus": "#d9c4ff",
			"danger": "#ffb4b9",
			"onDanger": "#4d101b",
			"dangerContainer": "#541e2a",
			"success": "#92ddb0",
			"warning": "#f2ce81",
			"mailUnread": "#30263f",
			"mailSelected": "#493565",
			"mailHover": "#352e40",
			"mailStar": "#f2ce81",
			"navActive": "#493565",
			"tagNeutral": "#352e40"
		}
	},
	"sakura-light": {
		"name": "Sakura Light",
		"mode": "light",
		"colors": {
			"canvas": "#fcf1f3",
			"surface": "#fff8f8",
			"surfaceContainer": "#f7e8ec",
			"surfaceElevated": "#f0dfe5",
			"onSurface": "#302128",
			"onSurfaceMuted": "#62444f",
			"primary": "#943a60",
			"onPrimary": "#ffffff",
			"primaryContainer": "#ffdae7",
			"onPrimaryContainer": "#5b1937",
			"outline": "#956976",
			"focus": "#943a60",
			"danger": "#a32432",
			"onDanger": "#ffffff",
			"dangerContainer": "#ffdadb",
			"success": "#28633f",
			"warning": "#765315",
			"mailUnread": "#fae4ee",
			"mailSelected": "#ffdae7",
			"mailHover": "#f0dfe5",
			"mailStar": "#765315",
			"navActive": "#ffdae7",
			"tagNeutral": "#f0dfe5"
		}
	},
	"sakura-dark": {
		"name": "Sakura Dark",
		"mode": "dark",
		"colors": {
			"canvas": "#1d1218",
			"surface": "#281b22",
			"surfaceContainer": "#35242e",
			"surfaceElevated": "#45313c",
			"onSurface": "#ffeaf2",
			"onSurfaceMuted": "#e1bfcd",
			"primary": "#ffafce",
			"onPrimary": "#57152f",
			"primaryContainer": "#683048",
			"onPrimaryContainer": "#ffe5ef",
			"outline": "#b88d9e",
			"focus": "#ffc1da",
			"danger": "#ffb4b4",
			"onDanger": "#56141b",
			"dangerContainer": "#60232e",
			"success": "#a1dfb6",
			"warning": "#f4d094",
			"mailUnread": "#3d2735",
			"mailSelected": "#683048",
			"mailHover": "#45313c",
			"mailStar": "#f4d094",
			"navActive": "#683048",
			"tagNeutral": "#45313c"
		}
	}
} as const;
export type ThemeId = keyof typeof themes;
export const DEFAULT_THEME: ThemeId = "amethyst-light";
export function isThemeId(value: unknown): value is ThemeId {
 return typeof value === "string" && Object.hasOwn(themes, value);
}
export type Appearance = { themeId: ThemeId; error: "corrupt" | "read-failed" | null };
export function themeVariables(id: ThemeId): Record<string, string> {
 return Object.fromEntries(Object.entries(themes[id].colors).map(([key, value]) => [`--app-${key}`, value]));
}
