import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { HapticPressable } from '@/components/HapticPressable';
import type { MessageAttachment } from '@/store/chatStore';

export type SheetHandle = { present: () => void; dismiss: () => void };

export function FileUploadSheet({
  sheetRef,
  uploading,
  pendingAttachments,
  onPickFile,
  onRemoveFile,
}: {
  sheetRef: React.RefObject<SheetHandle>;
  uploading: boolean;
  pendingAttachments: MessageAttachment[];
  onPickFile: () => void;
  onRemoveFile: (id: string) => void;
}) {
  const colors = useColors();
  const innerRef = useRef<BottomSheetModal>(null);

  // expose imperative handle via ref object
  React.useEffect(() => {
    (sheetRef as any).current = {
      present: () => innerRef.current?.present(),
      dismiss: () => innerRef.current?.dismiss(),
    };
  }, [sheetRef]);

  return (
    <BottomSheetModal
      ref={innerRef}
      snapPoints={['45%']}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetView style={[styles.content, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Attach study material</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          PDF, JPG or PNG · up to 10 MB · max 5 files
        </Text>
        <HapticPressable
          onPress={onPickFile}
          disabled={uploading || pendingAttachments.length >= 5}
          style={[styles.pickButton, { backgroundColor: colors.primary, opacity: uploading ? 0.6 : 1 }]}
        >
          <Ionicons name={uploading ? 'hourglass-outline' : 'cloud-upload-outline'} size={18} color={colors.primaryForeground} />
          <Text style={[styles.pickText, { color: colors.primaryForeground }]}>
            {uploading ? 'Uploading…' : 'Choose a file'}
          </Text>
        </HapticPressable>

        {pendingAttachments.length ? (
          <ScrollView style={styles.list}>
            {pendingAttachments.map((file) => (
              <View key={file.id} style={[styles.fileRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Ionicons name="document-outline" size={16} color={colors.primary} />
                <Text numberOfLines={1} style={[styles.fileName, { color: colors.foreground }]}>{file.fileName}</Text>
                <HapticPressable onPress={() => onRemoveFile(file.id)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </HapticPressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No files attached yet.</Text>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, padding: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  pickButton: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 12 },
  pickText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  list: { maxHeight: 160 },
  fileRow: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, marginBottom: 8, padding: 10 },
  fileName: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 12, textAlign: 'center' },
});