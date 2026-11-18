// SPDX-License-Identifier: Apache-2.0
import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { Appearance, ThemeId } from "../../shared/appearance";
export const AppearanceContext = createContext<{
 saved: Appearance;
 setSaved: Dispatch<SetStateAction<Appearance>>;
 preview: ThemeId | null;
 setPreview: Dispatch<SetStateAction<ThemeId | null>>;
} | null>(null);
export function useAppearance() {
 const context = useContext(AppearanceContext);
 if (!context) throw new Error("Appearance context missing");
 return context;
}
