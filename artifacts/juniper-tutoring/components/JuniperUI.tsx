import React, { type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
      <LinearGradient
        colors={[colors.deep, colors.background, colors.deep]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
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
        <Ionicons name="leaf" size={compact ? 16 : 19} color={inverted ? colors.primaryForeground : colors.primaryForeground} />
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
    <View style={[ui.previewLabel, { backgroundColor: colors.leaf, borderColor: colors.border }]}>
      <View style={[ui.previewDot, { backgroundColor: colors.accent }]} />
      <Text style={[ui.previewLabelText, { color: colors.foreground }]}>{text}</Text>
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
        { backgroundColor: persistenceError ? colors.softCoral : colors.card, borderColor: colors.border },
      ]}
    >
      <Ionicons
        name={persistenceError ? 'alert-circle-outline' : 'sparkles-outline'}
        size={16}
        color={persistenceError ? colors.destructive : colors.accent}
      />
      <Text
        style={[
          ui.previewNoticeText,
          { color: persistenceError ? colors.destructive : colors.foreground },
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
          style={({ pressed }) => [
            ui.backButton,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && ui.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={19} color={colors.foreground} />
        </Pressable>
      ) : null}
      <View style={ui.pageHeaderText}>
        {eyebrow ? (
          <Text style={[ui.eyebrow, { color: colors.accent }]}>{eyebrow}</Text>
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
          <Text style={[ui.sectionAction, { color: colors.accent }]}>{action} →</Text>
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
          size={14}
          color={selected ? colors.primaryForeground : colors.mutedForeground}
        />
      ) : null}
      <Text
        style={[
          ui.pillText,
          { color: selected ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </>
  );
  const style = [
    ui.pill,
    {
      backgroundColor: selected ? colors.accent : colors.card,
      borderColor: selected ? colors.accent : colors.border,
      borderTopColor: selected ? colors.accent : 'rgba(255, 255, 255, 0.12)',
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
      backgroundColor: colors.accent,
      borderColor: colors.accent,
      color: colors.accentForeground,
    },
    secondary: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      color: colors.foreground,
    },
    outline: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
      color: colors.foreground,
    },
    quiet: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      color: colors.accent,
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
            borderTopColor: variant === 'secondary' ? 'rgba(255, 255, 255, 0.12)' : palette.borderColor,
            opacity: disabled ? 0.45 : 1,
          },
        ]}
      >
        {loading ? (
          <SkeletonBlock style={ui.buttonLoadingSkeleton} />
        ) : (
          <>
            <Text style={[ui.actionButtonText, { color: palette.color }]}>{label}</Text>
            {icon ? <Ionicons name={icon} size={16} color={palette.color} /> : null}
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
      style={({ pressed }) => [
        ui.iconButton,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && ui.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={19}
        color={selected ? colors.accent : colors.mutedForeground}
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
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderTopColor: '#2A5240',
        },
      ]}
    >
      <View style={[ui.tutorPhotoWrap, compact && ui.tutorPhotoWrapCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${tutor.name}'s profile`}
          onPress={onPress}
          style={({ pressed }) => ({ opacity: pressed ? 0.94 : 1 })}
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
          <Text style={[ui.tutorPrice, { color: colors.accent }]}>${tutor.hourlyRate}</Text>
        </View>
        <Text style={[ui.tutorSubject, { color: colors.mutedForeground }]} numberOfLines={1}>
          {tutor.focus}
        </Text>
        <View style={ui.tutorFooter}>
          <View style={[ui.sampleChip, { backgroundColor: colors.leaf, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <Ionicons name="shield-checkmark" size={11} color={colors.accent} />
            <Text style={[ui.sampleChipText, { color: colors.foreground }]}>Juniper reviewed</Text>
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
    <View style={[ui.emptyState, { backgroundColor: colors.card, borderColor: colors.border, borderTopColor: '#2A5240' }]}>
      <View style={[ui.emptyIcon, { backgroundColor: colors.leaf }]}>
        <Ionicons name={icon} size={24} color={colors.accent} />
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
          { backgroundColor: selected ? colors.accent : colors.leaf },
        ]}
      >
        <Ionicons
          name={icon as keyof typeof Ionicons.glyphMap}
          size={18}
          color={selected ? colors.accentForeground : colors.accent}
        />
      </View>
      <Text style={[ui.subjectText, { color: colors.foreground }]}>{label}</Text>
    </>
  );
  const style = [
    ui.subjectMark,
    {
      backgroundColor: selected ? colors.card : colors.card,
      borderColor: selected ? colors.accent : colors.border,
      borderTopColor: selected ? colors.accent : 'rgba(255, 255, 255, 0.12)',
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
      colors={[colors.card, colors.bgElevated]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[ui.gradientPanel, { borderColor: colors.border }, style]}
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
    tone === 'clay' ? colors.destructive : tone === 'neutral' ? colors.mutedForeground : colors.accent;
  return (
    <View style={[ui.statusPill, { backgroundColor: background, borderColor: colors.border }]}>
      <Text style={[ui.statusPillText, { color: foreground }]}>{label}</Text>
    </View>
  );
}

/**
 * Benchmark Component: Vertical Soundwave / Bar Equalizer
 * Extracted directly from world-class dark botanical design reference.
 */
export function SoundwaveBarProgress({
  totalBars = 22,
  activeBarIndex = 11,
  height = 34,
}: {
  totalBars?: number;
  activeBarIndex?: number;
  height?: number;
}) {
  const colors = useColors();
  const bars = Array.from({ length: totalBars });

  return (
    <View style={[ui.equalizerWrap, { height }]}>
      {bars.map((_, i) => {
        const isCurrent = i === activeBarIndex;
        const isCompleted = i < activeBarIndex;
        const barHeightFraction = 0.5 + 0.5 * Math.sin(((i + 1) / (totalBars + 1)) * Math.PI);
        const barHeight = isCurrent ? height : Math.max(10, Math.round(height * barHeightFraction * 0.85));

        return (
          <View
            key={i}
            style={[
              ui.equalizerBar,
              {
                height: barHeight,
                backgroundColor: isCurrent
                  ? '#FFFFFF'
                  : isCompleted
                  ? colors.accent
                  : colors.secondary,
                width: isCurrent ? 4 : 3,
                borderRadius: isCurrent ? 2 : 1.5,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * Benchmark Component: Metric Stat Tile (Streak / Hours)
 * High-contrast numbers, clean tabular layout, circular icon container.
 */
export function MetricStatCard({
  icon,
  label,
  value,
  unit,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  unit: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const content = (
    <View style={[ui.metricStatCard, { backgroundColor: colors.card, borderColor: colors.border, borderTopColor: '#2A5240' }]}>
      <View style={ui.metricStatHeader}>
        <View style={[ui.metricStatIconCircle, { backgroundColor: 'rgba(255, 255, 255, 0.07)' }]}>
          <Ionicons name={icon} size={15} color={colors.accent} />
        </View>
        <Text style={[ui.metricStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
      <View style={ui.metricStatValueRow}>
        <Text style={[ui.metricStatValue, { color: colors.foreground }]}>{value}</Text>
        <Text style={[ui.metricStatUnit, { color: colors.mutedForeground }]}>{unit}</Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={() => { hapticLight(); onPress(); }} style={({ pressed }) => [ui.metricStatPressable, pressed && ui.pressed]}>
        {content}
      </Pressable>
    );
  }
  return content;
}

/**
 * Benchmark Component: Frosted Glass Container with Hairline Bevel
 */
export function GlassCard({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: object;
  onPress?: () => void;
}) {
  const colors = useColors();
  const containerStyle = [
    ui.glassCard,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderTopColor: '#2A5240',
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          hapticLight();
          onPress();
        }}
        style={({ pressed }) => [containerStyle, pressed && ui.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={containerStyle}>{children}</View>;
}

export const ui = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  page: { paddingHorizontal: 20 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.7 },
  brandNameCompact: { fontSize: 16 },
  previewLabel: {
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  previewDot: { width: 6, height: 6, borderRadius: 3 },
  previewLabelText: { fontFamily: 'Inter_600SemiBold', fontSize: 11, letterSpacing: 0.1 },
  previewNotice: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  previewNoticeText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  pageHeader: { alignItems: 'center', flexDirection: 'row', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1 },
  backButton: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  pageHeaderText: { flex: 1 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  pageTitle: { fontFamily: 'Inter_700Bold', fontSize: 28, letterSpacing: -0.8, lineHeight: 34 },
  sectionHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 13,
    marginTop: 26,
  },
  sectionTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.4 },
  sectionAction: { fontFamily: 'Inter_600SemiBold', fontSize: 13, letterSpacing: -0.1 },
  pill: {
    alignItems: 'center',
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 14,
  },
  pillText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  actionButton: {
    alignItems: 'center',
    borderRadius: 99,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonLoadingSkeleton: { height: 16, width: 52, borderRadius: 6 },
  actionButtonText: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2 },
  iconButton: {
    alignItems: 'center',
    borderRadius: 99,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  portraitFrame: { backgroundColor: 'transparent', overflow: 'hidden' },
  portraitSmall: { borderRadius: 16, height: 84, width: 74 },
  portraitMedium: { borderRadius: 20, height: 144, width: 124 },
  portraitLarge: { borderRadius: 24, height: 240, width: 190 },
  portraitImage: { height: '100%', width: '100%' },
  tutorCard: {
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    padding: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  tutorCardCompact: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  tutorPhotoWrap: { alignSelf: 'stretch', position: 'relative' },
  tutorPhotoWrapCompact: { alignSelf: 'auto' },
  saveOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(14, 42, 28, 0.88)',
    borderRadius: 20,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 36,
  },
  tutorInfo: { paddingHorizontal: 4, paddingTop: 10 },
  tutorInfoCompact: { flex: 1, paddingTop: 0 },
  tutorNameRow: { alignItems: 'center', flexDirection: 'row', gap: 9, justifyContent: 'space-between' },
  tutorName: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  tutorPrice: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  tutorSubject: { fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 },
  tutorFooter: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 10 },
  sampleChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  sampleChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  perHour: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  emptyState: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    marginBottom: 12,
    width: 48,
  },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 17, letterSpacing: -0.3, textAlign: 'center' },
  emptyDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
    marginTop: 6,
    maxWidth: 280,
    textAlign: 'center',
  },
  subjectMark: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 96,
    paddingHorizontal: 10,
    width: 104,
  },
  subjectIcon: { alignItems: 'center', borderRadius: 14, height: 36, justifyContent: 'center', width: 36 },
  subjectText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, textAlign: 'center', letterSpacing: -0.2 },
  gradientPanel: { borderRadius: 24, borderWidth: 1, overflow: 'hidden', padding: 20 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 99, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  statusPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 10 },
  glassCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
  equalizerWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginVertical: 12,
  },
  equalizerBar: {
    borderRadius: 2,
  },
  metricStatCard: {
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    padding: 14,
  },
  metricStatPressable: { flex: 1 },
  metricStatHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  metricStatIconCircle: {
    alignItems: 'center',
    borderRadius: 12,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  metricStatLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  metricStatValueRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
  },
  metricStatValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.7,
  },
  metricStatUnit: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
});
