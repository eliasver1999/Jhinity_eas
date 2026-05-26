import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "../../src/auth/store";
import { api, type ApprovalDetail } from "../../src/api/client";
import { useTheme } from "../../src/theme";
import { ApprovalPill } from "../../src/components/StatusPill";
import { relativeTime } from "../../src/lib/time";

export default function ApprovalDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, baseUrl } = useAuth();
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setError(null);
      const d = await api.approval(token, baseUrl, id);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    }
  }, [token, baseUrl, id]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(kind: "approve" | "reject") {
    if (!token || !id || !detail) return;
    setPending(true);
    setError(null);
    try {
      const trimmed = comment.trim() || undefined;
      if (kind === "approve") await api.approve(token, baseUrl, id, trimmed);
      else await api.reject(token, baseUrl, id, trimmed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await load();
      setComment("");
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setError(e instanceof Error ? e.message : "Decision failed.");
    } finally {
      setPending(false);
    }
  }

  if (!detail) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: t.bg }}>
        {error ? (
          <Text style={{ color: t.danger, padding: 20, textAlign: "center" }}>{error}</Text>
        ) : (
          <ActivityIndicator color={t.text} />
        )}
      </View>
    );
  }

  const { request, events, easBuildUrl, canDecide, alreadyDecided } = detail;

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 22, fontWeight: "700" }}>
              {request.appName ?? request.appSlug ?? "Untitled"}
            </Text>
            <Text style={{ color: t.textMuted, fontFamily: "Menlo", marginTop: 4 }}>
              {request.buildProfile}
            </Text>
          </View>
          <ApprovalPill status={request.status} />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
        <Field label="Commit">
          {request.gitCommitHash ? (
            <View>
              <Text style={{ fontFamily: "Menlo", color: t.text }}>
                {request.gitCommitHash.slice(0, 12)}
              </Text>
              {request.gitCommitMessage && (
                <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>
                  {request.gitCommitMessage.split("\n")[0]}
                </Text>
              )}
            </View>
          ) : (
            <Text style={{ color: t.textMuted }}>—</Text>
          )}
        </Field>
        <Field label="Initiated by">
          <Text style={{ color: t.text }}>{request.initiatingActor ?? "—"}</Text>
        </Field>
        <Field label="Approvals">
          <Text style={{ color: t.text }}>
            {request.approvalCount} of {request.requiredApprovals}
          </Text>
        </Field>
        {easBuildUrl && (
          <Pressable onPress={() => Linking.openURL(easBuildUrl)}>
            <Text style={{ color: t.info, marginTop: 8 }}>View on EAS ↗</Text>
          </Pressable>
        )}
      </View>

      <View>
        <Text style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
          Timeline
        </Text>
        {events.map((e) => (
          <View key={e.id} style={[styles.eventRow, { borderColor: t.border, backgroundColor: t.bgElevated }]}>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 6,
                backgroundColor:
                  e.type === "approved" ? t.success : e.type === "rejected" ? t.danger : t.info,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 13 }}>
                <Text style={{ fontWeight: "600" }}>
                  {e.userName ?? e.userEmail ?? "Someone"}
                </Text>{" "}
                <Text style={{ color: t.textMuted }}>
                  {labelForEvent(e.type)} · {relativeTime(e.createdAt)}
                </Text>
              </Text>
              {e.comment && (
                <Text style={{ color: t.text, fontSize: 13, marginTop: 4 }}>{e.comment}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {canDecide && !alreadyDecided && (
        <View style={[styles.card, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
          <Text style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
            Your decision
          </Text>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Comment (optional)"
            placeholderTextColor={t.textMuted}
            multiline
            style={{
              borderWidth: 1,
              borderColor: t.border,
              borderRadius: 8,
              padding: 10,
              marginTop: 8,
              color: t.text,
              minHeight: 60,
            }}
          />
          {error && <Text style={{ color: t.danger, marginTop: 8, fontSize: 13 }}>{error}</Text>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() =>
                Alert.alert("Approve?", "This will record your approval.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Approve", style: "default", onPress: () => decide("approve") },
                ])
              }
              disabled={pending}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: t.success,
                  flex: 1,
                  opacity: pending || pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ color: t.successBg, fontWeight: "700" }}>Approve</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert("Reject?", "This will block the release.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Reject", style: "destructive", onPress: () => decide("reject") },
                ])
              }
              disabled={pending}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: "transparent",
                  borderWidth: 1,
                  borderColor: t.danger,
                  flex: 1,
                  opacity: pending || pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ color: t.danger, fontWeight: "700" }}>Reject</Text>
            </Pressable>
          </View>
        </View>
      )}

      {alreadyDecided && (
        <Text style={{ color: t.textMuted, textAlign: "center", fontSize: 13 }}>
          You&apos;ve already cast a decision on this request.
        </Text>
      )}

      {!canDecide && request.status === "pending" && !alreadyDecided && (
        <Text style={{ color: t.textMuted, textAlign: "center", fontSize: 13 }}>
          You don&apos;t have permission to decide on this build profile.
        </Text>
      )}
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </Text>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

function labelForEvent(type: string): string {
  switch (type) {
    case "created":
      return "opened the request";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "comment":
      return "commented";
    default:
      return type;
  }
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 16 },
  eventRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 6,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
