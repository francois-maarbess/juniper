import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

export type SheetHandle = { present: () => void; dismiss: () => void };

export const WhishPaymentDrawer = forwardRef<SheetHandle>(function WhishPaymentDrawer(_, ref) {
  const colors = useColors();
  const innerRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    present: () => innerRef.current?.present(),
    dismiss: () => innerRef.current?.dismiss(),
  }));

  return (
    <BottomSheetModal
      ref={innerRef}
      snapPoints={['55%']}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={[styles.content, { backgroundColor: colors.card }]}>
        <View style={styles.header}>
          <View style={[styles.icon, { backgroundColor: colors.leaf }]}>
            <Ionicons name="phone-portrait-outline" size={20} color="#6B21A8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>Pay with Whish Money</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Instant transfer in USD or LBP</Text>
          </View>
        </View>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Agree on the final amount in chat, then send the payment directly to your tutor’s Whish account.
          Juniper never holds or moves money.
        </Text>
        <View style={[styles.step, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>1. Confirm amount & tutor details</Text>
          <Text style={[styles.stepCopy, { color: colors.mutedForeground }]}>Double-check the session price and the tutor’s name before sending.</Text>
        </View>
        <View style={[styles.step, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>2. Send via Whish Money app</Text>
          <Text style={[styles.stepCopy, { color: colors.mutedForeground }]}>Use your tutor’s shared phone number or Whish handle. Save the receipt.</Text>
        </View>
        <View style={[styles.step, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>3. Confirm in chat</Text>
          <Text style={[styles.stepCopy, { color: colors.mutedForeground }]}>Tell your tutor once the transfer is sent so they can mark it received.</Text>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  content: { gap: 12, padding: 20 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  icon: { alignItems: 'center', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  step: { borderRadius: 14, borderWidth: 1, gap: 4, padding: 12 },
  stepTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  stepCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
});