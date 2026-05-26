import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../src/auth/store";
import { api, type Build } from "../../src/api/client";
import { useTheme } from "../../src/theme";
import { ApprovalPill, StatusPill } from "../../src/components/StatusPill";
import { relativeTime } from "../../src/lib/time";

export default function BuildsScreen() {
  const t = useTheme();
  const { token, baseUrl } = useAuth();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [easConnected, setEasConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const res = await api.builds(token, baseUrl);
      setBuilds(res.builds);
      setEasConnected(res.easConnected);
      if (res.error) setError(res.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load builds.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, baseUrl]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {!easConnected && !loading && (
        <View style={{ padding: 16, backgroundColor: t.warnBg }}>
          <Text style={{ color: t.warn }}>
            No Expo account connected. Connect EAS on the web first.
          </Text>
        </View>
      )}
      {error && (
        <View style={{ padding: 16, backgroundColor: t.dangerBg }}>
          <Text style={{ color: t.danger }}>{error}</Text>
        </View>
      )}
      <FlatList
        data={builds}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 12 }}
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
              <Text style={{ color: t.textMuted }}>No builds yet.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <BuildRow build={item} />}
      />
    </View>
  );
}

function BuildRow({ build }: { build: Build }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => build.easUrl && Linking.openURL(build.easUrl)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.bgElevated, borderColor: t.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: t.text, fontWeight: "600" }}>
            {build.appName ?? build.appSlug ?? "—"}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill status={build.status} />
            {build.approval && <ApprovalPill status={build.approval.status} />}
            <Text style={{ color: t.textMuted, fontSize: 12 }}>
              {build.platform.toLowerCase()}
              {build.buildProfile ? ` · ${build.buildProfile}` : ""}
            </Text>
          </View>
          {build.gitCommitHash && (
            <Text style={{ color: t.textMuted, fontSize: 12 }} numberOfLines={1}>
              <Text style={{ fontFamily: "Menlo" }}>{build.gitCommitHash.slice(0, 7)}</Text>
              {build.gitCommitMessage ? ` — ${build.gitCommitMessage.split("\n")[0]}` : ""}
            </Text>
          )}
        </View>
        <Text style={{ color: t.textMuted, fontSize: 12, marginLeft: 8 }}>
          {relativeTime(build.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
});
