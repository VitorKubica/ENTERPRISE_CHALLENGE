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
      <Tabs.Screen name="atividade" options={{ title: 'Recargas e fatura', tabBarLabel: 'Recargas', tabBarIcon: ({ color }) => <Receipt size={22} color={color} strokeWidth={1.5} /> }} />
      <Tabs.Screen name="gestor" options={{ title: 'Gestor', tabBarIcon: ({ color }) => <LayoutDashboard size={22} color={color} strokeWidth={1.5} /> }} />
      <Tabs.Screen name="evidencias" options={{ title: 'Evidências', tabBarIcon: ({ color }) => <ClipboardCheck size={22} color={color} strokeWidth={1.5} /> }} />
    </Tabs>
  );
}
