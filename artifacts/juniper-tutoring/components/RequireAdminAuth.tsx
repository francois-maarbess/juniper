import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HapticPressable } from '@/components/HapticPressable';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export function RequireAdminAuth({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const router = useRouter();
  const { isLoaded, user, request } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(null);
      return;
    }
    let active = true;
    void request<{ isAdministrator: boolean }>('/marketplace/admin/status')
      .then((result) => { if (active) setIsAdmin(result.isAdministrator); })
      .catch(() => { if (active) setIsAdmin(false); });
    return () => { active = false; };
  }, [request, user]);

  if (!isLoaded || (user && isAdmin === null)) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.loading, { color: colors.mutedForeground }]}>Checking administrator access…</Text></View>;
  }
  if (!user) return null;
  if (isAdmin) return <>{children}</>;

  const copyId = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.pale }]}>
          <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Administrator account required</Text>
        <Text style={[styles.copy, { color: colors.mutedForeground }]}>
          This review space is limited to allowlisted Juniper staff accounts. Add your account UUID to the local administrator allowlist, then sign in again.
        </Text>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>YOUR ACCOUNT UUID</Text>
        <View style={[styles.uuidRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text selectable style={[styles.uuid, { color: colors.foreground }]}>{user.id}</Text>
          <HapticPressable accessibilityRole="button" accessibilityLabel="Copy account UUID" onPress={() => void copyId()} style={styles.copyButton}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={colors.primary} />
          </HapticPressable>
        </View>
        <Text style={[styles.role, { color: colors.mutedForeground }]}>Signed in as {user.activeRole === 'tutor' ? 'tutor' : 'learner'}</Text>
        <HapticPressable accessibilityRole="button" onPress={() => router.back()} style={[styles.back, { borderColor: colors.border }]}>
          <Text style={[styles.backText, { color: colors.primary }]}>Return to Juniper</Text>
        </HapticPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  loading: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  card: { borderRadius: 24, borderWidth: 1, gap: 14, maxWidth: 520, padding: 24, width: '100%', shadowColor: '#183B31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 3 },
  icon: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5 },
  copy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1 },
  uuidRow: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 12 },
  uuid: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  copyButton: { alignItems: 'center', minHeight: 36, justifyContent: 'center', width: 36 },
  role: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  back: { alignItems: 'center', borderRadius: 14, borderWidth: 1, minHeight: 46, justifyContent: 'center', marginTop: 2 },
  backText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
});
