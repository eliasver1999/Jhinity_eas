import { useColorScheme } from "react-native";

export type Theme = {
  bg: string;
  bgElevated: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryFg: string;
  pillBg: string;
  success: string;
  successBg: string;
  warn: string;
  warnBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
};

const light: Theme = {
  bg: "#fafafa",
  bgElevated: "#ffffff",
  border: "#e5e5e5",
  text: "#171717",
  textMuted: "#737373",
  primary: "#171717",
  primaryFg: "#ffffff",
  pillBg: "#f5f5f5",
  success: "#065f46",
  successBg: "#d1fae5",
  warn: "#92400e",
  warnBg: "#fef3c7",
  danger: "#991b1b",
  dangerBg: "#fee2e2",
  info: "#1e40af",
  infoBg: "#dbeafe",
};

const dark: Theme = {
  bg: "#0a0a0a",
  bgElevated: "#171717",
  border: "#262626",
  text: "#fafafa",
  textMuted: "#a3a3a3",
  primary: "#fafafa",
  primaryFg: "#171717",
  pillBg: "#262626",
  success: "#a7f3d0",
  successBg: "#064e3b66",
  warn: "#fde68a",
  warnBg: "#78350f66",
  danger: "#fecaca",
  dangerBg: "#7f1d1d66",
  info: "#bfdbfe",
  infoBg: "#1e3a8a66",
};

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}
