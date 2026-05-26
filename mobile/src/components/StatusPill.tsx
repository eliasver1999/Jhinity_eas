import { Text, View } from "react-native";
import { useTheme } from "../theme";

const buildStatusMap: Record<string, { fg: string; bg: string }> = {};

export function StatusPill({ status }: { status: string }) {
  const t = useTheme();
  const palette = (() => {
    switch (status) {
      case "FINISHED":
        return { fg: t.success, bg: t.successBg };
      case "IN_PROGRESS":
        return { fg: t.info, bg: t.infoBg };
      case "ERRORED":
        return { fg: t.danger, bg: t.dangerBg };
      case "CANCELED":
        return { fg: t.warn, bg: t.warnBg };
      default:
        return { fg: t.textMuted, bg: t.pillBg };
    }
  })();
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ color: palette.fg, fontSize: 11, fontWeight: "600" }}>
        {status.toLowerCase().replace(/_/g, " ")}
      </Text>
    </View>
  );
}

export function ApprovalPill({ status }: { status: string }) {
  const t = useTheme();
  const palette =
    status === "approved"
      ? { fg: t.success, bg: t.successBg }
      : status === "rejected"
        ? { fg: t.danger, bg: t.dangerBg }
        : { fg: t.warn, bg: t.warnBg };
  return (
    <View
      style={{
        backgroundColor: palette.bg,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: palette.fg,
          fontSize: 11,
          fontWeight: "600",
          textTransform: "capitalize",
        }}
      >
        {status}
      </Text>
    </View>
  );
}
