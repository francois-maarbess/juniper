import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useJuniper } from '@/context/JuniperContext';
import { useAuth } from '@/context/AuthContext';
import { hapticLight } from '@/lib/haptics';

function NativeTabLayout() {
  const { state } = useJuniper();
  const { user } = useAuth();
  const role = user?.activeRole ?? state.role;
  const isTutor = role === 'tutor';

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: isTutor ? 'briefcase' : 'house', selected: isTutor ? 'briefcase.fill' : 'house.fill' }}
        />
        <NativeTabs.Trigger.Label>
          {isTutor ? 'Home' : 'Home'}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'calendar', selected: 'calendar' }}
        />
        <NativeTabs.Trigger.Label>
          {isTutor ? 'Sessions' : 'My learning'}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="find">
        <NativeTabs.Trigger.Icon
          sf={{ default: isTutor ? 'tray' : 'magnifyingglass', selected: isTutor ? 'tray.fill' : 'magnifyingglass' }}
        />
        <NativeTabs.Trigger.Label>
          {isTutor ? 'Requests' : 'Find tutors'}
        </NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
        />
        <NativeTabs.Trigger.Label>{isTutor ? 'Tutor Hub' : 'Profile'}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { state } = useJuniper();
  const { user } = useAuth();
  const role = user?.activeRole ?? state.role;
  const isTutor = role === 'tutor';
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenListeners={{ tabPress: () => hapticLight() }}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: -0.1 },
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          paddingTop: 8,
          paddingBottom: isWeb ? 8 : Math.max(insets.bottom, 8),
          height: isWeb ? 72 : undefined,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? (isTutor ? 'briefcase.fill' : 'house.fill') : (isTutor ? 'briefcase' : 'house')} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? (isTutor ? 'briefcase' : 'home') : (isTutor ? 'briefcase-outline' : 'home-outline')} size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: isTutor ? 'Sessions' : 'My learning',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'calendar' : 'calendar'} tintColor={color} size={21} />
            ) : (
              <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="find"
        options={{
          title: isTutor ? 'Requests' : 'Find tutors',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? (isTutor ? 'flame.fill' : 'magnifyingglass') : (isTutor ? 'flame' : 'magnifyingglass')} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? (isTutor ? 'flame' : 'search') : (isTutor ? 'flame-outline' : 'search-outline')} size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: isTutor ? 'Tutor Hub' : 'Profile',
          tabBarIcon: ({ color, focused }) =>
            isIOS ? (
              <SymbolView name={focused ? 'person.crop.circle.fill' : 'person.crop.circle'} tintColor={color} size={22} />
            ) : (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={21} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="studio"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
