import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../src/auth/store";
import { useTheme } from "../src/theme";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, token } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const t = useTheme();

  useEffect(() => {
    if (!ready) return;
    const onAuthRoute = segments[0] === "sign-in";
    if (!token && !onAuthRoute) {
      router.replace("/sign-in");
    } else if (token && onAuthRoute) {
      router.replace("/(tabs)/builds");
    }
  }, [ready, token, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: t.bg }}>
        <ActivityIndicator color={t.text} />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="approval/[id]"
            options={{ presentation: "card", headerShown: true, title: "Approval" }}
          />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}
