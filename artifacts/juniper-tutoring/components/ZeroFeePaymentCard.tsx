import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { HapticPressable } from '@/components/HapticPressable';
import { WhishPaymentDrawer, type SheetHandle } from '@/components/sheets/WhishPaymentDrawer';

export function ZeroFeePaymentCard() {
  const colors = useColors();
  const drawerRef = useRef<SheetHandle>(null);

  return (
    <>
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Payment is arranged between the learner and tutor. */}
      <View style={styles.headerRow}>
        <View style={[styles.shieldIconWrap, { backgroundColor: colors.leaf }]}>
          <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
        </View>
        <View style={styles.headerTextWrap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Agree on payment directly</Text>
            <View style={[styles.badge, { backgroundColor: colors.leaf }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>DIRECT</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Juniper does not collect or hold session payments.
          </Text>
        </View>
      </View>

      <Text style={[styles.description, { color: colors.foreground }]}>
        Confirm the amount, payment method, and timing with your tutor in chat before the session. Juniper does not verify transfers or provide payment protection.
      </Text>

      {/* Payment methods row */}
      <View style={styles.methodsRow}>
        {/* Whish Money */}
        <View style={[styles.methodCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.methodIconBadge, { backgroundColor: '#F0EBF8' }]}>
            <Ionicons name="phone-portrait-outline" size={16} color="#6B21A8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.methodName, { color: colors.foreground }]}>Whish Money</Text>
            <Text style={[styles.methodMeta, { color: colors.mutedForeground }]}>Ask your tutor which methods they accept</Text>
          </View>
        </View>

        {/* OMT */}
        <View style={[styles.methodCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.methodIconBadge, { backgroundColor: '#FEF9C3' }]}>
            <Ionicons name="storefront-outline" size={16} color="#854D0E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.methodName, { color: colors.foreground }]}>OMT Intra-Lebanon</Text>
            <Text style={[styles.methodMeta, { color: colors.mutedForeground }]}>Confirm details directly with your tutor</Text>
          </View>
        </View>

        {/* Direct Cash */}
        <View style={[styles.methodCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.methodIconBadge, { backgroundColor: colors.leaf }]}>
            <Ionicons name="cash-outline" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.methodName, { color: colors.foreground }]}>Direct Cash</Text>
            <Text style={[styles.methodMeta, { color: colors.mutedForeground }]}>Only if you both agree to meet in person</Text>
          </View>
        </View>
      </View>
      <HapticPressable
        onPress={() => drawerRef.current?.present()}
        style={[styles.payButton, { backgroundColor: colors.primary }]}
      >
        <Ionicons name="phone-portrait-outline" size={16} color={colors.primaryForeground} />
        <Text style={[styles.payButtonText, { color: colors.primaryForeground }]}>View Whish payment guide</Text>
      </HapticPressable>
    </View>
    <WhishPaymentDrawer ref={drawerRef} />
  </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 18,
    padding: 18,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  shieldIconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    letterSpacing: -0.3,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: 2,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  methodsRow: {
    gap: 8,
    marginTop: 4,
  },
  methodCard: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  methodIconBadge: {
    alignItems: 'center',
    borderRadius: 10,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  methodName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  methodMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  payButton: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 4,
    paddingVertical: 12,
  },
  payButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
});
