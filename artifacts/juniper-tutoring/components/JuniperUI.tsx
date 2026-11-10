import React, { type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ScrollViewProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { hapticLight } from '@/lib/haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import type { Tutor } from '@/constants/juniper-data';
import { useJuniper } from '@/context/JuniperContext';
import { SkeletonBlock } from '@/components/LoadingSkeleton';

export function Screen({
  children,
  scroll = true,
  contentStyle,
  keyboardShouldPersistTaps,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: object;
  keyboardShouldPersistTaps?: ScrollViewProps['keyboardShouldPersistTaps'];
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? 67 : Math.max(insets.top, 8);
  const bottom = Platform.OS === 'web' ? 120 : Math.max(insets.bottom, 18) + 108;
  return (
    <View style={[ui.screen, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          style={ui.screen}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          contentContainerStyle={[
            ui.page,
            { paddingTop: top, paddingBottom: bottom },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            ui.page,
            ui.fill,
            { paddingTop: top, paddingBottom: Math.max(insets.bottom, 12) },
            contentStyle,
          ]}
        >
          {children}
        </View>
      )}
    </View>
  );
}

export function BrandMark({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  const colors = useColors();
  return (
    <View style={ui.brand}>
      <View style={[ui.brandIcon, { backgroundColor: inverted ? '#FFFFFF' : colors.primary }]}>
        <Ionicons name="leaf-outline" size={compact ? 17 : 20} color={inverted ? colors.primary : colors.primaryForeground} />
      </View>
      <Text style={[ui.brandName, { color: inverted ? '#FFFFFF' : colors.foreground }, compact && ui.brandNameCompact]}>
        juniper
      </Text>
    </View>
  );
}

export function PreviewLabel({ text = 'Preview mode' }: { text?: string }) {
  const colors = useColors();
  return (
    <View style={[ui.previewLabel, { backgroundColor: colors.leaf }]}>
      <View style={[ui.previewDot, { backgroundColor: colors.primary }]} />
      <Text style={[ui.previewLabelText, { color: colors.primary }]}>{text}</Text>
    </View>
  );
}

export function PreviewNotice({
  message = 'Sample profiles · local-only requests and sessions',
}: {
  message?: string;
}) {
  const colors = useColors();
  const { persistenceError } = useJuniper();
  return (
    <View
      style={[
        ui.previewNotice,
        { backgroundColor: persistenceError ? colors.softCoral : colors.leaf },
      ]}
    >
      <Ionicons
        name={persistenceError ? 'alert-circle-outline' : 'information-circle-outline'}
        size={16}
        color={persistenceError ? colors.destructive : colors.primary}
      />
      <Text
        style={[
          ui.previewNoticeText,
          { color: persistenceError ? colors.destructive : colors.primary },
        ]}
      >
        {persistenceError
          ? 'This device could not save your preview changes.'
          : message}
      </Text>
    </View>
  );
}

export function PageHeader({
  title,
  eyebrow,
  onBack,
  right,
}: {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View style={[ui.pageHeader, { borderBottomColor: colors.border }]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            hapticLight();
            onBack?.();
          }}
          style={[ui.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="arrow-back" size={19} color={colors.foreground} />
        </Pressable>
      ) : null}
      <View style={ui.pageHeaderText}>
        {eyebrow ? (
          <Text style={[ui.eyebrow, { color: colors.mutedForeground }]}>{eyebrow}</Text>
        ) : null}
        <Text style={[ui.pageTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function SectionHeading({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={ui.sectionHeading}>
      <Text style={[ui.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action && onAction ? (
        <Pressable
          onPress={() => {
            hapticLight();
            onAction?.();
          }}
          accessibilityRole="button"
          style={({ pressed }) => [pressed && ui.pressed]}
        >
          <Text style={[ui.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Pill({
  label,
  selected = false,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  const content = (
    <>
      {icon ? (
        <Ionicons
          name={icon}
          size={15}
          color={selected ? colors.primaryForeground : colors.mutedForeground}
        />
      ) : null}
      <Text
        style={[
          ui.pillText,
          { color: selected ? colors.primaryForeground : colors.secondaryForeground },
        ]}
      >
        {label}
      </Text>
    </>
  );
  const style = [
    ui.pill,
    {
      backgroundColor: selected ? colors.primary : colors.card,
      borderColor: selected ? colors.primary : colors.border,
    },
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        hapticLight();
        onPress?.();
      }}
      style={({ pressed }) => [style, pressed && ui.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'quiet';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const variants = {
    primary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      color: colors.primaryForeground,
    },
    secondary: {
      backgroundColor: colors.leaf,
      borderColor: colors.leaf,
      color: colors.primary,
    },
    outline: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
    },
    quiet: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: colors.primary,
    },
  } as const;
  const palette = variants[variant];
  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        disabled={disabled || loading}
        onPressIn={() => {
          scale.value = withSpring(0.975);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        onPress={() => {
          hapticLight();
          onPress();
        }}
        style={[
          ui.actionButton,
          {
            backgroundColor: palette.backgroundColor,
            borderColor: palette.borderColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {loading ? (
          <SkeletonBlock style={ui.buttonLoadingSkeleton} />
        ) : (
          <>
            <Text style={[ui.actionButtonText, { color: palette.color }]}>{label}</Text>
            {icon ? <Ionicons name={icon} size={17} color={palette.color} /> : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  selected = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  selected?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        hapticLight();
        onPress();
      }}
      style={({ pressed }) => [ui.iconButton, pressed && ui.pressed]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={selected ? colors.orange : colors.mutedForeground}
      />
    </Pressable>
  );
}

export function TutorPortrait({
  tutor,
  size = 'medium',
}: {
  tutor: Tutor;
  size?: 'small' | 'medium' | 'large';
}) {
  const sizeStyle =
    size === 'large' ? ui.portraitLarge : size === 'small' ? ui.portraitSmall : ui.portraitMedium;
  return (
    <View style={[ui.portraitFrame, sizeStyle]}>
      <Image source={tutor.photo} style={ui.portraitImage} resizeMode="cover" />
    </View>
  );
}

export const TutorCard = React.memo(function TutorCard({
  tutor,
  onPress,
  compact = false,
  saved = false,
  onToggleSave,
}: {
  tutor: Tutor;
  onPress: () => void;
  compact?: boolean;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        ui.tutorCard,
        compact && ui.tutorCardCompact,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[ui.tutorPhotoWrap, compact && ui.tutorPhotoWrapCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${tutor.name}'s profile`}
          onPress={onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.96 : 1 })}
        >
          <TutorPortrait tutor={tutor} size={compact ? 'small' : 'medium'} />
        </Pressable>
        {onToggleSave ? (
          <View style={ui.saveOverlay}>
            <IconButton
              icon={saved ? 'heart' : 'heart-outline'}
              onPress={onToggleSave}
              label={saved ? 'Remove from saved tutors' : 'Save tutor'}
              selected={saved}
            />
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${tutor.name}'s profile`}
        onPress={onPress}
        style={({ pressed }) => [
          ui.tutorInfo,
          compact && ui.tutorInfoCompact,
          pressed && ui.pressed,
        ]}
      >
        <View style={ui.tutorNameRow}>
          <Text style={[ui.tutorName, { color: colors.foreground }]} numberOfLines={1}>
            {tutor.name}
          </Text>
          <Text style={[ui.tutorPrice, { color: colors.primary }]}>${tutor.hourlyRate}</Text>
        </View>
        <Text style={[ui.tutorSubject, { color: colors.mutedForeground }]} numberOfLines={1}>
          {tutor.focus}
        </Text>
        <View style={ui.tutorFooter}>
          <View style={[ui.sampleChip, { backgroundColor: colors.leaf, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <Ionicons name="shield-checkmark" size={10} color={colors.primary} />
            <Text style={[ui.sampleChipText, { color: colors.primary }]}>Juniper reviewed</Text>
          </View>
          <Text style={[ui.perHour, { color: colors.mutedForeground }]}>· direct rate</Text>
        </View>
      </Pressable>
    </View>
  );
});

export function EmptyState({
  icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={[ui.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[ui.emptyIcon, { backgroundColor: colors.leaf }]}>
        <Ionicons name={icon} size={25} color={colors.primary} />
      </View>
      <Text style={[ui.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[ui.emptyDescription, { color: colors.mutedForeground }]}>{description}</Text>
      {action && onAction ? <ActionButton label={action} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

export const SubjectMark = React.memo(function SubjectMark({
  label,
  icon,
  onPress,
  selected = false,
}: {
  label: string;
  icon: string;
  onPress?: () => void;
  selected?: boolean;
}) {
  const colors = useColors();
  const inner = (
    <>
      <View
        style={[
          ui.subjectIcon,
          { backgroundColor: selected ? colors.primaryForeground : colors.leaf },
        ]}
      >
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={19}
          color={colors.primary}
        />
      </View>
      <Text style={[ui.subjectText, { color: colors.foreground }]}>{label}</Text>
    </>
  );
  const style = [
    ui.subjectMark,
    {
      backgroundColor: selected ? colors.pale : colors.card,
      borderColor: selected ? colors.accent : colors.border,
    },
  ];
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        hapticLight();
        onPress?.();
      }}
      style={({ pressed }) => [style, pressed && ui.pressed]}
    >
      {inner}
    </Pressable>
  ) : (
    <View style={style}>{inner}</View>
  );
});

export function GradientPanel({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  const colors = useColors();
  return (
    <LinearGradient
      colors={[colors.primary, colors.deep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[ui.gradientPanel, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function StatusPill({
  label,
  tone = 'green',
}: {
  label: string;
  tone?: 'green' | 'clay' | 'neutral';
}) {
  const colors = useColors();
  const background =
    tone === 'clay' ? colors.softCoral : tone === 'neutral' ? colors.muted : colors.leaf;
  const foreground =
    tone === 'clay' ? colors.destructive : tone === 'neutral' ? colors.mutedForeground : colors.primary;
  return (
    <View style={[ui.statusPill, { backgroundColor: background }]}>
      <Text style={[ui.statusPillText, { color: foreground }]}>{label}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  page: { paddingHorizontal: 22 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 21, letterSpacing: -0.9 },
  brandNameCompact: { fontSize: 17 },
  previewLabel: {
    borderRadius: 99,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  previewDot: { width: 6, height: 6, borderRadius: 3 },
  previewLabelText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 0.2 },
  previewNotice: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewNoticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 16 },
  pageHeader: { alignItems: 'center', flexDirection: 'row', gap: 14, marginBottom: 23, paddingBottom: 17, borderBottomWidth: 1 },
  backButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pageHeaderText: { flex: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 3 },
  pageTitle: { fontFamily: 'serif', fontSize: 31, letterSpacing: -0.9, lineHeight: 37 },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    marginTop: 32,
  },
  sectionTitle: { fontFamily: 'serif', fontSize: 21, letterSpacing: -0.35 },
  sectionAction: { fontFamily: 'Inter_700Bold', fontSize: 13, letterSpacing: -0.1 },
  pill: {
    alignItems: 'center',
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 15,
  },
  pillText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  actionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 20,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  buttonLoadingSkeleton: { height: 16, width: 52, borderRadius: 6 },
  actionButtonText: { fontFamily: 'Inter_700Bold', fontSize: 14, letterSpacing: -0.2 },
  iconButton: {
    alignItems: 'center',
    borderRadius: 99,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  portraitFrame: { backgroundColor: 'transparent', overflow: 'hidden' },
  portraitSmall: { borderRadius: 16, height: 84, width: 74 },
  portraitMedium: { borderRadius: 20, height: 148, width: 126 },
  portraitLarge: { borderRadius: 26, height: 252, width: 200 },
  portraitImage: { height: '100%', width: '100%' },
  tutorCard: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 14,
    overflow: 'hidden',
    padding: 13,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  tutorCardCompact: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  tutorPhotoWrap: { alignSelf: 'stretch', position: 'relative' },
  tutorPhotoWrapCompact: { alignSelf: 'auto' },
  saveOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 36,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tutorInfo: { paddingHorizontal: 4, paddingTop: 12 },
  tutorInfoCompact: { flex: 1, paddingTop: 0 },
  tutorNameRow: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'space-between' },
  tutorName: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  tutorPrice: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2 },
  tutorSubject: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 4 },
  tutorFooter: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 10 },
  sampleChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  sampleChipText: { fontFamily: 'Inter_700Bold', fontSize: 9 },
  perHour: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  emptyState: {
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 1,
    marginTop: 18,
    paddingHorizontal: 26,
    paddingVertical: 32,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 52,
    justifyContent: 'center',
    marginBottom: 14,
    width: 52,
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.4, textAlign: 'center' },
  emptyDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 18,
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
  },
  subjectMark: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 102,
    paddingHorizontal: 10,
    width: 108,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  subjectIcon: { alignItems: 'center', borderRadius: 13, height: 36, justifyContent: 'center', width: 36 },
  subjectText: { fontFamily: 'Inter_700Bold', fontSize: 12, textAlign: 'center', letterSpacing: -0.2 },
  gradientPanel: { borderRadius: 28, overflow: 'hidden', padding: 23 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  statusPillText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
});
