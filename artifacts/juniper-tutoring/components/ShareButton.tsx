import React, { useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { SkeletonBlock } from '@/components/LoadingSkeleton';

export interface ShareButtonProps {
  tutorId: string;
  tutorName: string;
  headline?: string | null;
  subjects?: string[];
  hourlyRate?: number;
  variant?: 'primary' | 'secondary' | 'pill' | 'iconOnly';
  label?: string;
}

export function ShareButton({
  tutorId,
  tutorName,
  headline,
  subjects = [],
  hourlyRate,
  variant = 'secondary',
  label = 'Share profile',
}: ShareButtonProps) {
  const colors = useColors();
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/tutor/${tutorId}`;
    }
    const publicUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://junipertutoring.com';
    return `${publicUrl}/tutor/${tutorId}`;
  };

  const getShareMessage = () => {
    const subText = subjects.length > 0 ? ` (${subjects.slice(0, 3).join(', ')})` : '';
    const rateText = hourlyRate ? ` · $${Math.round(hourlyRate)}/hr` : '';
    const headText = headline ? ` - ${headline}` : '';
    const shareUrl = getShareUrl();

    return `Hey! Found a verified tutor on Juniper: ${tutorName}${subText}${rateText}${headText}.\nPay directly via Whish Money, OMT, or Cash (0% platform fee).\n\nCheck their profile: ${shareUrl}`;
  };

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);

    const shareUrl = getShareUrl();
    const shareMessage = getShareMessage();

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          try {
            await navigator.share({
              title: `${tutorName} - Juniper Tutor`,
              text: shareMessage,
              url: shareUrl,
            });
            setSharing(false);
            return;
          } catch (err: unknown) {
            // User cancelled or share failed, fallback to copy
            if ((err as { name?: string }).name === 'AbortError') {
              setSharing(false);
              return;
            }
          }
        }

        // Web clipboard copy fallback
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(`${shareMessage}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
      } else {
        // Native mobile sharing
        const result = await Share.share({
          message: shareMessage,
          url: shareUrl,
          title: `${tutorName} · Juniper Tutoring`,
        });

        if (result.action === Share.sharedAction) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
      }
    } catch {
      // Fallback: try opening direct WhatsApp URL
      try {
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
        const canOpen = await Linking.canOpenURL(whatsappUrl);
        if (canOpen) {
          await Linking.openURL(whatsappUrl);
        }
      } catch {
        // Ignore fallback errors
      }
    } finally {
      setSharing(false);
    }
  };

  if (variant === 'iconOnly') {
    return (
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel={`Share ${tutorName}'s profile on WhatsApp`}
        onPress={() => void handleShare()}
        style={({ pressed }) => [
          styles.iconOnlyButton,
          {
            backgroundColor: copied ? colors.leaf : colors.card,
            borderColor: copied ? colors.primary : colors.border,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        {sharing ? (
          <SkeletonBlock style={{ height: 14, width: 14, borderRadius: 7 }} />
        ) : (
          <Ionicons
            name={copied ? 'checkmark-circle' : 'logo-whatsapp'}
            size={18}
            color={copied ? colors.primary : '#25D366'}
          />
        )}
      </HapticPressable>
    );
  }

  if (variant === 'pill') {
    return (
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel={`Share ${tutorName}'s profile`}
        onPress={() => void handleShare()}
        style={({ pressed }) => [
          styles.pillButton,
          {
            backgroundColor: copied ? colors.leaf : colors.card,
            borderColor: copied ? colors.primary : colors.border,
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        {sharing ? (
          <SkeletonBlock style={{ height: 14, width: 14, borderRadius: 7 }} />
        ) : (
          <Ionicons
            name={copied ? 'checkmark-circle' : 'share-social-outline'}
            size={15}
            color={colors.primary}
          />
        )}
        <Text style={[styles.pillText, { color: colors.primary }]}>
          {copied ? 'Link copied!' : label}
        </Text>
      </HapticPressable>
    );
  }

  const isPrimary = variant === 'primary';

  return (
    <HapticPressable
      accessibilityRole="button"
      accessibilityLabel={`Share ${tutorName}'s profile`}
      onPress={() => void handleShare()}
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: isPrimary ? colors.primary : colors.leaf,
          borderColor: isPrimary ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {sharing ? (
        <SkeletonBlock style={{ height: 14, width: 14, borderRadius: 7 }} />
      ) : (
        <Ionicons
          name={copied ? 'checkmark-circle' : 'logo-whatsapp'}
          size={18}
          color={isPrimary ? '#25D366' : '#128C7E'}
        />
      )}
      <Text
        style={[
          styles.actionButtonText,
          { color: isPrimary ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {copied ? 'Profile Link Copied!' : label}
      </Text>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  pillButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  pillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  iconOnlyButton: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
});
