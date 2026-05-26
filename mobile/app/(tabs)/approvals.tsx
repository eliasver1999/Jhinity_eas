import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../src/auth/store";
import { api, type ApprovalRequest } from "../../src/api/client";
import { useTheme } from "../../src/theme";
import { ApprovalPill } from "../../src/components/StatusPill";
import { relativeTime } from "../../src/lib/time";

const STATUSES = ["pending", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

export default function ApprovalsScreen() {
  const t = useTheme();
  const { token, baseUrl } = useAuth();
  const [status, setStatus] = useState<Status>("pending");
  const [items, setItems] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const res = await api.approvals(token, baseUrl, status);
      setItems(res.approvals);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load approvals.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, baseUrl, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flexDirection: "row", padding: 12, gap: 4 }}>
        {STATUSES.map((s) => (
          <Pressable
            key={s}
            onPress={() => setStatus(s)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: s === status ? t.primary : "transparent",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={{
                color: s === status ? t.primaryFg : t.textMuted,
                fontWeight: "600",
                fontSize: 13,
                textTransform: "capitalize",
              }}
            >
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      {error && (
        <View style={{ padding: 16, backgroundColor: t.dangerBg, marginHorizontal: 12, borderRadius: 8 }}>
          <Text style={{ color: t.danger }}>{error}</Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 12, paddingTop: 0 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={t.text}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={{ padding: 32, alignItems: "center" }}>
              <Text style={{ color: t.textMuted }}>No {status} requests.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <ApprovalRow req={item} />}
      />
    </View>
  );
}

function ApprovalRow({ req }: { req: ApprovalRequest }) {
  const t = useTheme();
  return (
    <Link href={`/approval/${req.id}` as const} asChild>
      <Pressable
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: t.bgElevated, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.text, fontWeight: "600" }}>
              {req.appName ?? req.appSlug ?? "—"}
            </Text>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <ApprovalPill status={req.status} />
              <Text style={{ color: t.textMuted, fontSize: 12, fontFamily: "Menlo" }}>
                {req.buildProfile}
              </Text>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>
                {req.approvalCount}/{req.requiredApprovals}
              </Text>
            </View>
            {req.gitCommitHash && (
              <Text style={{ color: t.textMuted, fontSize: 12 }} numberOfLines={1}>
                <Text style={{ fontFamily: "Menlo" }}>{req.gitCommitHash.slice(0, 7)}</Text>
                {req.gitCommitMessage ? ` — ${req.gitCommitMessage.split("\n")[0]}` : ""}
              </Text>
            )}
          </View>
          <Text style={{ color: t.textMuted, fontSize: 12, marginLeft: 8 }}>
            {relativeTime(req.createdAt)}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
});
