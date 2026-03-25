import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { AppTheme } from '../constants/theme';
import { Colors } from '../constants/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 2 },
  },
});

function AuthGuard() {
  const router = useRouter();
  const { session, loading, initialize } = useAuthStore();
  const hasRedirected = useRef(false);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, []);

  useEffect(() => {
    // Wait until Supabase has finished checking the session
    if (loading) return;

    if (session) {
      // Logged in — go to dashboard
      router.replace('/(tabs)/dashboard');
    } else {
      // Not logged in — go to login
      // Only redirect to login if we haven't already
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        router.replace('/(auth)/login');
      }
    }
  }, [session, loading]);

  // Show splash while session is loading
  if (loading) {
    return (
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: Colors.primary,
        alignItems: 'center', justifyContent: 'center', zIndex: 999,
      }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={AppTheme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
          <AuthGuard />
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
