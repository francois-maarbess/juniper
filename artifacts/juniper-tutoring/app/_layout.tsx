import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { JuniperProvider } from '@/context/JuniperContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from '@expo-google-fonts/inter';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useColors } from '@/hooks/useColors';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  const { isLoaded, user } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!isLoaded || user) return;
    const [group, screen] = segments as string[];
    const authRoute = group === '(auth)';
    const routeSegments = segments as string[];
    const publicDiscovery =
      (group === '(tabs)' && (screen === 'find' || screen === 'index')) ||
      (routeSegments.includes('(tabs)') &&
        (routeSegments.length === 1 || routeSegments.some((segment) => segment === 'find' || segment === 'index')));
    const publicTutorProfile = group === 'tutor';
    if (!authRoute && !publicDiscovery && !publicTutorProfile) {
      router.replace({ pathname: '/(auth)/welcome', params: { next: `/${segments.join('/')}` } });
    }
  }, [isLoaded, user, segments]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitle: 'Back',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="request" options={{ presentation: 'modal' }} />
      <Stack.Screen name="become-tutor" options={{ presentation: 'modal' }} />
      <Stack.Screen name="tutor/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="requests/[id]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="confirmation" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat/[bookingId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sessions/[bookingId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="admin/tutors" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <BottomSheetModalProvider>
            <KeyboardProvider>
          <AuthProvider>
            <JuniperProvider>
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
              <RootLayoutNav />
            </JuniperProvider>
          </AuthProvider>
            </KeyboardProvider>
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
