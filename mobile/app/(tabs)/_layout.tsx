import { Tabs } from "expo-router";
import { useTheme } from "../../src/theme";

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.text,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: {
          backgroundColor: t.bgElevated,
          borderTopColor: t.border,
        },
        headerStyle: { backgroundColor: t.bgElevated },
        headerTitleStyle: { color: t.text },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="builds" options={{ title: "Builds" }} />
      <Tabs.Screen name="approvals" options={{ title: "Approvals" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}
