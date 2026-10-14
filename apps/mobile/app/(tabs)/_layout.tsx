import { Tabs } from 'expo-router';
import { ClipboardCheck, House, LayoutDashboard, Receipt } from 'lucide-react-native';
import { fonts, useTheme } from '../../src/theme';

export default function TabsLayout() {
  const { c } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.brandText,
        tabBarInactiveTintColor: c.textTertiary,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color }) => <House size={22} color={color} strokeWidth={1.5} /> }} />
    </Tabs>
  );
}
