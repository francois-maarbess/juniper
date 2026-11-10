import React, { type ReactNode } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { BrandMark } from '@/components/JuniperUI';
import { SkeletonBlock } from '@/components/LoadingSkeleton';

export function AuthShell({
  eyebrow, title, description, children,
}: {
  eyebrow: string; title: string; description: string; children: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, {
          paddingTop: Math.max(insets.top, 22), paddingBottom: Math.max(insets.bottom, 24),
          minHeight: wide ? '100%' : undefined,
        }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.frame, { maxWidth: wide ? 1100 : 480, flexDirection: wide ? 'row' : 'column' }]}>
          <View style={[styles.brandLine, wide && styles.brandLineWide]}>
            <BrandMark inverted={wide} />
            <View style={[styles.secureTag, { backgroundColor: wide ? 'rgba(255,255,255,0.14)' : colors.leaf, borderWidth: wide ? 1 : 0, borderColor: 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="lock-closed-outline" size={13} color={wide ? '#FFFFFF' : colors.primary} />
              <Text style={[styles.secureTagText, { color: wide ? '#FFFFFF' : colors.primary }]}>Thoughtful tutoring</Text>
            </View>
          </View>

          <LinearGradient
            colors={['#315B45', '#19392E']}
            start={{ x: 0.08, y: 0 }} end={{ x: 0.95, y: 1 }}
            style={[styles.storyPanel, wide && styles.storyPanelWide]}
          >
            <View style={styles.orbLarge} />
            <View style={styles.orbSmall} />
            <View style={styles.storyContent}>
              <View style={styles.storyIcon}>
                <Ionicons name="leaf" size={18} color="#EAF0E7" />
              </View>
              <Text style={styles.storyEyebrow}>LEARNING, WITH ROOM TO GROW</Text>
              <Text style={styles.storyTitle}>The right person{ '\n' }makes it click.</Text>
              <Text style={styles.storyDescription}>
                A tough class, a new language, or tomorrow’s exam. Find a tutor who knows the way through.
              </Text>
              <View style={styles.storyDivider} />
              <View style={styles.storyFooter}>
                <View style={styles.storyDots}>
                  <View style={[styles.storyDot, { backgroundColor: '#E5B48E' }]} />
                  <View style={[styles.storyDot, { backgroundColor: '#B9CFB7' }]} />
                  <View style={[styles.storyDot, { backgroundColor: '#F0D7BF' }]} />
                </View>
                <Text style={styles.storyFooterText}>Your questions are a good place to start.</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={[styles.formPanel, { backgroundColor: colors.card, borderColor: colors.border }, wide && styles.formPanelWide]}>
            <Text style={[styles.formEyebrow, { color: colors.orange }]}>{eyebrow.toUpperCase()}</Text>
            <Text style={[styles.formTitle, { color: colors.foreground }]}>{title}</Text>
            <Text style={[styles.formDescription, { color: colors.mutedForeground }]}>{description}</Text>
            <View style={styles.formContent}>{children}</View>
          </View>
        </View>
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>Juniper · Thoughtful support for what you’re learning</Text>
      </ScrollView>
    </View>
  );
}

export function AuthField({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = 'sentences', autoComplete, testID,
}: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder: string;
  secureTextEntry?: boolean; keyboardType?: 'default' | 'email-address'; autoCapitalize?: 'none' | 'sentences';
  autoComplete?: 'email' | 'name' | 'given-name' | 'family-name' | 'password' | 'new-password'; testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        autoCorrect={false}
        keyboardType={keyboardType ?? 'default'}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        secureTextEntry={secureTextEntry}
        selectionColor={colors.primary}
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
      />
    </View>
  );
}

export function AuthButton({
  label, onPress, loading = false, disabled = false, variant = 'primary', testID,
}: {
  label: string; onPress: () => void; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'secondary'; testID?: string;
}) {
  const colors = useColors();
  const primary = variant === 'primary';
  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.button, {
        backgroundColor: primary ? colors.primary : colors.leaf,
        opacity: disabled || loading ? 0.58 : pressed ? 0.82 : 1,
      }]}
    >
      {loading ? <SkeletonBlock style={{ height: 18, width: 52, borderRadius: 6 }} /> : (
        <Text style={[styles.buttonText, { color: primary ? colors.primaryForeground : colors.primary }]}>{label}</Text>
      )}
    </HapticPressable>
  );
}

export function AuthLink({ children, onPress }: { children: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <HapticPressable accessibilityRole="link" onPress={onPress} hitSlop={8}>
      <Text style={[styles.link, { color: colors.primary }]}>{children}</Text>
    </HapticPressable>
  );
}

export function AuthMessage({ children, kind = 'error' }: { children: string; kind?: 'error' | 'success' }) {
  const colors = useColors();
  const success = kind === 'success';
  return (
    <View style={[styles.message, { backgroundColor: success ? colors.leaf : colors.softCoral }]}>
      <Ionicons name={success ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={17} color={success ? colors.primary : colors.destructive} />
      <Text style={[styles.messageText, { color: success ? colors.deep : colors.destructive }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  frame: { width: '100%', gap: 16, alignSelf: 'center' },
  brandLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 2 },
  brandLineWide: { position: 'absolute', top: 22, left: 30, right: 30, zIndex: 2 },
  secureTag: { flexDirection: 'row', gap: 6, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' },
  secureTagText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  storyPanel: { borderRadius: 28, overflow: 'hidden', minHeight: 250, justifyContent: 'flex-end', padding: 25 },
  storyPanelWide: { flex: 1, minHeight: 580, borderTopRightRadius: 0, borderBottomRightRadius: 0, padding: 42, justifyContent: 'center' },
  storyContent: { zIndex: 1, maxWidth: 390 },
  storyIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.18)', borderWidth: 1, marginBottom: 20 },
  storyEyebrow: { color: '#C1D1C3', fontFamily: 'Inter_600SemiBold', fontSize: 9, letterSpacing: 1.3, marginBottom: 8 },
  storyTitle: { color: '#FFFCF5', fontFamily: 'serif', fontSize: 36, lineHeight: 42, letterSpacing: -0.8 },
  storyDescription: { color: '#E3E9DF', fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 20, marginTop: 10, maxWidth: 330 },
  storyDivider: { width: 42, height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 19, marginBottom: 13 },
  storyFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storyDots: { flexDirection: 'row', paddingLeft: 1 },
  storyDot: { width: 11, height: 11, borderRadius: 6, marginLeft: -2, borderWidth: 1.5, borderColor: '#214B3A' },
  storyFooterText: { color: '#E2E9DF', fontFamily: 'Inter_500Medium', fontSize: 10 },
  orbLarge: { position: 'absolute', width: 280, height: 280, borderRadius: 140, borderWidth: 1, borderColor: 'rgba(237,244,233,0.11)', right: -82, top: -142 },
  orbSmall: { position: 'absolute', width: 186, height: 186, borderRadius: 93, borderWidth: 1, borderColor: 'rgba(237,244,233,0.12)', right: -32, top: -96 },
  formPanel: { borderWidth: 1, borderRadius: 28, padding: 23, shadowColor: '#19382F', shadowOpacity: 0.07, shadowRadius: 26, shadowOffset: { width: 0, height: 12 } },
  formPanelWide: { width: 430, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, justifyContent: 'center', paddingHorizontal: 40, paddingTop: 56 },
  formEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3, marginBottom: 7 },
  formTitle: { fontFamily: 'serif', fontSize: 30, lineHeight: 36, letterSpacing: -0.7 },
  formDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 7 },
  formContent: { marginTop: 22, gap: 14 },
  fieldGroup: { gap: 7 },
  fieldLabel: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: -0.1 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 15, paddingHorizontal: 15, fontFamily: 'Inter_400Regular', fontSize: 14, outlineStyle: 'none' as never },
  button: { minHeight: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, marginTop: 4, shadowColor: '#183B31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 11, elevation: 2 },
  buttonText: { fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: -0.2 },
  link: { fontFamily: 'Inter_700Bold', fontSize: 12, textAlign: 'center', paddingVertical: 6 },
  message: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  messageText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16 },
  footer: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 16, textAlign: 'center' },
});
