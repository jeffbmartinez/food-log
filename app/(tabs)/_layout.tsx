import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ADD_ENTRY_ROUTE, navigateToAddEntry } from '@/lib/entry-navigation';

function AddTabButton(props: BottomTabBarButtonProps) {
  return (
    <HapticTab
      {...props}
      href={ADD_ENTRY_ROUTE}
      onPress={(event) => {
        if ('preventDefault' in event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }

        navigateToAddEntry();
      }}
    />
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="entry"
        options={{
          title: 'Add',
          tabBarButton: AddTabButton,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="plus.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
