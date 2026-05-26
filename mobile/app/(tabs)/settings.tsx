import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../src/auth/store";
import { api, type Me } from "../../src/api/client";
import { useTheme } from "../../src/theme";

export default function SettingsScreen() {
  const t = useTheme();
  const { token, baseUrl, signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!token) return;
    api.me(token, baseUrl).then(setMe).catch(() => setMe(null));
  }, [token, baseUrl]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} style={{ backgroundColor: t.bg }}>
      {me && (
        <View
          style={[
            styles.card,
            { backgroundColor: t.bgElevated, borderColor: t.border },
          ]}
        >
          <Text style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
            Signed in
          </Text>
          <Text style={{ color: t.text, marginTop: 4, fontSize: 16, fontWeight: "600" }}>
            {me.user.name ?? me.user.email}
          </Text>
          {me.user.name && me.user.email && (
            <Text style={{ color: t.textMuted, fontSize: 13 }}>{me.user.email}</Text>
          )}
          <Text style={{ color: t.textMuted, marginTop: 12, fontSize: 13 }}>
            Org: <Text style={{ color: t.text, fontWeight: "600" }}>{me.org.name}</Text>{" "}
            <Text style={{ color: t.textMuted }}>({me.org.role})</Text>
          </Text>
        </View>
      )}

      <View style={[styles.card, { backgroundColor: t.bgElevated, borderColor: t.border }]}>
        <Text style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
          API
        </Text>
        <Text style={{ color: t.text, marginTop: 4 }}>{baseUrl}</Text>
      </View>

      <Pressable
        onPress={signOut}
        style={({ pressed }) => [
          styles.signOut,
          { backgroundColor: t.dangerBg, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={{ color: t.danger, fontWeight: "600" }}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 10, padding: 16 },
  signOut: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
});
