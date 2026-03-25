import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '../../constants/colors';

// Simple emoji icons — no external library needed, always render correctly
const TAB_ICONS = {
  dashboard: { active: '📊', inactive: '📊' },
  projects:  { active: '🎨', inactive: '🎨' },
  labour:    { active: '👷', inactive: '👷' },
  clients:   { active: '👥', inactive: '👥' },
  invoices:  { active: '🧾', inactive: '🧾' },
};

function TabIcon({ name, focused }) {
  const icon = TAB_ICONS[name];
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>
      {focused ? icon.active : icon.inactive}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor:  '#E0E0E0',
          borderTopWidth:  0.5,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: Colors.primary,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon name="dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ focused }) => <TabIcon name="projects" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="labour"
        options={{
          title: 'Labour',
          tabBarIcon: ({ focused }) => <TabIcon name="labour" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ focused }) => <TabIcon name="clients" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'Invoices',
          tabBarIcon: ({ focused }) => <TabIcon name="invoices" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
