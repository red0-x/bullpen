// Design tokens for Bullpen, copied from the website's design system
// (cream canvas, white cards with 1.5px line borders, cap-brown buttons with a solid lip).
// Light theme only, matching the website.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FBF4EA", // cream canvas
  onSurface: "#3A1F14", // espresso
  surfaceSecondary: "#FFFFFF", // cards
  onSurfaceSecondary: "#3A1F14",
  surfaceTertiary: "#F4EEE6", // greyed rows, inputs
  onSurfaceTertiary: "#7A5A48",
  surfaceInverse: "#3A1F14",
  onSurfaceInverse: "#FFFFFF",
  muted: "#7A5A48", // cocoa

  brand: "#7B3F25", // cap brown
  onBrand: "#FFFFFF",
  brandPrimary: "#7B3F25",
  onBrandPrimary: "#FFFFFF",
  brandPrimaryLip: "#5A2C18",
  brandPrimaryHighlight: "#9A5434", // top of the button gradient
  onBrandPrimarySoft: "rgba(255,255,255,0.16)", // icon bubble on primary buttons
  brandPrimarySheen: "rgba(255,255,255,0.22)", // 1px top sheen on primary buttons
  shadow: "#3A1F14",
  brandSecondary: "#FFFFFF",
  onBrandSecondary: "#7B3F25",
  brandTertiary: "#FBF4EA",
  onBrandTertiary: "#3A1F14",

  success: "#3B4E22",
  onSuccess: "#FFFFFF",
  successSoft: "#E5EBD8", // sage
  warning: "#8A3418",
  onWarning: "#FFFFFF",
  warningSoft: "#FBE3DA", // blush
  warningBorder: "#F0C6B5",
  error: "#8A3418",
  onError: "#FFFFFF",
  info: "#7B3F25",
  onInfo: "#FFFFFF",
  star: "#E0A43A",

  border: "#E8D9C6", // line
  borderStrong: "#3A1F14",
  divider: "#E8D9C6",
  overlay: "rgba(58,31,20,0.45)",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

export const colors = light;

export const fonts = {
  head: "Head",
  body: "Body",
  semi: "BodySemi",
  bold: "BodyBold",
};

export const radius = { card: 20, btn: 16, tile: 16, field: 8, chip: 999 };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = (system === "light" || system === "dark") && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
