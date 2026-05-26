import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Screen } from "../src/components/Screen";
import { useAuth } from "../src/auth/store";
import { api, ApiError } from "../src/api/client";
import { useTheme } from "../src/theme";

export default function SignInScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    setError(null);
    const trimmedToken = token.trim();
    const trimmedUrl = baseUrl.trim().replace(/\/$/, "");
    if (!trimmedToken || !trimmedUrl) {
      setError("Both the API token and base URL are required.");
      return;
    }
    setPending(true);
    try {
      await api.me(trimmedToken, trimmedUrl);
      await signIn(trimmedToken, trimmedUrl);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? "Token rejected. Generate a new one at /settings/devices on the web."
          : e instanceof Error
            ? e.message
            : "Sign-in failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
          <View>
            <Text style={[styles.title, { color: t.text }]}>EAS Dashboard</Text>
            <Text style={[styles.subtitle, { color: t.textMuted }]}>
              Paste the API token from your web account.
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: t.textMuted }]}>API base URL</Text>
            <TextInput
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://localhost:3000"
              placeholderTextColor={t.textMuted}
              style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bgElevated }]}
            />
            <Text style={{ fontSize: 11, color: t.textMuted }}>
              For Android emulator, use http://10.0.2.2:3000. For a real phone, use your computer&apos;s LAN IP.
            </Text>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: t.textMuted }]}>API token</Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder="eas_..."
              placeholderTextColor={t.textMuted}
              style={[
                styles.input,
                { color: t.text, borderColor: t.border, backgroundColor: t.bgElevated, fontFamily: "Menlo" },
              ]}
            />
          </View>

          {error && (
            <View style={{ backgroundColor: t.dangerBg, padding: 12, borderRadius: 8 }}>
              <Text style={{ color: t.danger, fontSize: 13 }}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={pending}
            style={({ pressed }) => [
              styles.button,
              {
                backgroundColor: t.primary,
                opacity: pending || pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: t.primaryFg, fontWeight: "600" }}>
              {pending ? "Verifying..." : "Sign in"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 4 },
  label: { fontSize: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
});
