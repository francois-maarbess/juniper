import React, { memo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Skeleton } from 'moti/skeleton';
import { useColors } from '@/hooks/useColors';

export const SkeletonBlock = memo(function SkeletonBlock({
  style,
}: {
  style?: ViewStyle;
}) {
  const colors = useColors();
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const { width, height, borderRadius, ...rest } = flat;
  return (
    <View style={rest as any}>
      <Skeleton
        colorMode="light"
        colors={[colors.leaf, colors.cream]}
        backgroundColor={colors.leaf}
        width={(width as any) ?? '100%'}
        height={height as any}
        radius={(typeof borderRadius === 'number' ? borderRadius : 16) as any}
      />
    </View>
  );
});

export const HomeSkeleton = memo(function HomeSkeleton() {
  return (
    <View style={styles.stack}>
      <SkeletonBlock style={styles.hero} />
      <View style={styles.row}>
        <SkeletonBlock style={styles.icon} />
        <View style={styles.copy}>
          <SkeletonBlock style={styles.line} />
          <SkeletonBlock style={styles.shortLine} />
        </View>
      </View>
      <SkeletonBlock style={styles.sectionLine} />
      <View style={styles.cardRow}>
        <SkeletonBlock style={styles.subjectCard} />
        <SkeletonBlock style={styles.subjectCard} />
        <SkeletonBlock style={styles.subjectCard} />
      </View>
      <SkeletonBlock style={styles.panel} />
    </View>
  );
});

export const TutorProfileSkeleton = memo(function TutorProfileSkeleton() {
  return (
    <View style={styles.stack}>
      <View style={styles.profileRow}>
        <SkeletonBlock style={styles.profileImage} />
        <View style={styles.copy}>
          <SkeletonBlock style={styles.line} />
          <SkeletonBlock style={styles.shortLine} />
          <SkeletonBlock style={styles.rateLine} />
        </View>
      </View>
      <SkeletonBlock style={styles.panel} />
      <SkeletonBlock style={styles.sectionLine} />
      <SkeletonBlock style={styles.about} />
      <View style={styles.cardRow}>
        <SkeletonBlock style={styles.tag} />
        <SkeletonBlock style={styles.tag} />
        <SkeletonBlock style={styles.tag} />
      </View>
    </View>
  );
});

export const ChatSkeleton = memo(function ChatSkeleton() {
  return (
    <View style={styles.chatStack}>
      <SkeletonBlock style={styles.messageIncoming} />
      <SkeletonBlock style={styles.messageOutgoing} />
      <SkeletonBlock style={styles.messageIncomingShort} />
    </View>
  );
});

export const SessionDetailSkeleton = memo(function SessionDetailSkeleton() {
  return (
    <View style={styles.stack}>
      <SkeletonBlock style={styles.hero} />
      <SkeletonBlock style={styles.panel} />
      <SkeletonBlock style={styles.about} />
      <SkeletonBlock style={styles.sectionLine} />
      <SkeletonBlock style={styles.panel} />
    </View>
  );
});

const styles = StyleSheet.create({
  block: { borderRadius: 16 },
  stack: { gap: 16, marginTop: 20 },
  hero: { height: 190, borderRadius: 28 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  profileRow: { flexDirection: 'row', gap: 16 },
  icon: { height: 48, width: 48, borderRadius: 16 },
  profileImage: { height: 136, width: 110, borderRadius: 24 },
  copy: { flex: 1, gap: 10, justifyContent: 'center' },
  line: { height: 16, width: '86%' },
  shortLine: { height: 12, width: '58%' },
  rateLine: { height: 18, width: '36%' },
  sectionLine: { height: 18, width: '48%' },
  cardRow: { flexDirection: 'row', gap: 10 },
  subjectCard: { flex: 1, height: 74, borderRadius: 18 },
  panel: { height: 100, borderRadius: 20 },
  about: { height: 78, borderRadius: 16 },
  tag: { height: 30, width: 82, borderRadius: 99 },
  chatStack: { flex: 1, gap: 12, justifyContent: 'flex-end', padding: 18 },
  messageIncoming: { alignSelf: 'flex-start', height: 58, width: '68%' },
  messageOutgoing: { alignSelf: 'flex-end', height: 48, width: '54%' },
  messageIncomingShort: { alignSelf: 'flex-start', height: 42, width: '42%' },
});