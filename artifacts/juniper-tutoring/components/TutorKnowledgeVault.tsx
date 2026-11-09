import React, { useState, useEffect, useCallback } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { hapticMedium } from '@/lib/haptics';
import { useAuth } from '@/context/AuthContext';
import { ActionButton, SectionHeading } from '@/components/JuniperUI';
import { SkeletonBlock } from '@/components/LoadingSkeleton';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface VaultItem {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  mimeType: string;
  isPublic: boolean;
  priceCents: number;
  purchaseCount: number;
  purchased?: boolean;
  createdAt: string;
}

interface TutorKnowledgeVaultProps {
  tutorUserId: string;
  isOwner?: boolean;
}

export function TutorKnowledgeVault({ tutorUserId, isOwner = false }: TutorKnowledgeVaultProps) {
  const colors = useColors();
  const { request, upload, download } = useAuth();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadItems = useCallback(async () => {
    if (!tutorUserId) return;
    setLoading(true);
    try {
      const rows = await request<VaultItem[]>(`/marketplace/tutors/${encodeURIComponent(tutorUserId)}/vault`);
      setItems(rows || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tutorUserId, request]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        setSelectedAsset(res.assets[0]);
        if (!title.trim()) {
          const rawName = res.assets[0].name.replace(/\.[^/.]+$/, '');
          setTitle(rawName);
        }
      }
    } catch {
      // Ignored
    }
  };

  const handleSaveItem = async () => {
    if (!title.trim() || !selectedAsset) {
      setErrorMsg('Please provide a title and select a document.');
      return;
    }
    setBusy(true);
    setErrorMsg('');

    try {
      const form = new FormData();
      if (Platform.OS === 'web' && selectedAsset.file) {
        form.append('file', selectedAsset.file, selectedAsset.name);
      } else {
        form.append('file', {
          uri: selectedAsset.uri,
          name: selectedAsset.name,
          type: selectedAsset.mimeType ?? 'application/pdf',
        } as unknown as Blob);
      }
      form.append('title', title.trim());
      if (description.trim()) form.append('description', description.trim());
      form.append('priceCents', '0');

      const created = await upload<VaultItem>('/marketplace/tutor-vault', form);
      setItems((prev) => [created, ...prev]);
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setSelectedAsset(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add study note.');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenItem = async (item: VaultItem) => {
    try {
      const { blob } = await download(`/marketplace/tutor-vault/${item.id}/download`);
      const safeName = item.title.replace(/[\\/\0-\x1f]/g, '_').slice(0, 120) || 'study-material';
      const ext = item.mimeType === 'image/png' ? 'png' : item.mimeType === 'image/jpeg' ? 'jpg' : 'pdf';
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${safeName}.${ext}`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const file = new File(Paths.cache, `${item.id}-${safeName}.${ext}`);
        await file.write(new Uint8Array(await blob.arrayBuffer()));
        await Sharing.shareAsync(file.uri, { dialogTitle: 'Open study material' });
      }
      hapticMedium();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not open this study material.');
    }
  };

  return (
    <View style={styles.vaultWrapper}>
      <View style={styles.headerRow}>
        <SectionHeading title={`Study resources (${items.length})`} />
        {isOwner && (
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Add a free study resource"
            onPress={() => setModalOpen(true)}
            style={[styles.addBtn, { backgroundColor: colors.leaf }]}
          >
            <Ionicons name="add" size={14} color={colors.primary} />
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Add resource</Text>
          </HapticPressable>
        )}
      </View>

      <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
        Materials this tutor has chosen to share with learners.
      </Text>

      {loading ? (
        <View style={styles.loadingSkeleton}>
          <SkeletonBlock style={styles.loadingSkeletonThumb} />
          <View style={styles.loadingSkeletonCopy}>
            <SkeletonBlock style={styles.loadingSkeletonLine} />
            <SkeletonBlock style={styles.loadingSkeletonShortLine} />
          </View>
        </View>
      ) : items.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="book-outline" size={24} color={colors.mutedForeground} />
          <Text style={[styles.emptyBoxText, { color: colors.mutedForeground }]}>
            {isOwner
              ? 'Share a useful study guide, worked example, or lesson recap.'
              : 'This tutor has not shared public study recaps yet.'}
          </Text>
          {isOwner && (
            <ActionButton
              label="Share a resource"
              icon="cloud-upload-outline"
              variant="secondary"
              onPress={() => setModalOpen(true)}
            />
          )}
        </View>
      ) : (
        <View style={styles.gridContainer}>
          {items.map((item) => (
            <HapticPressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open free study resource: ${item.title}`}
              onPress={() => handleOpenItem(item)}
              style={[styles.vaultCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.previewThumb, { backgroundColor: colors.leaf }]}>
                <Ionicons name="document-text-outline" size={24} color={colors.primary} />
              </View>
              <Text numberOfLines={2} style={[styles.itemTitle, { color: colors.foreground }]}>
                {item.title}
              </Text>
              {item.description ? (
                <Text numberOfLines={2} style={[styles.itemDesc, { color: colors.mutedForeground }]}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.cardFooter}>
                <View style={[styles.verifiedPill, { backgroundColor: colors.pale }]}>
                  <Ionicons name="shield-checkmark" size={10} color={colors.primary} />
                  <Text style={[styles.verifiedText, { color: colors.primary }]}>Tutor shared</Text>
                </View>
                <Text style={[styles.priceText, { color: colors.mutedForeground }]}>Free resource</Text>
              </View>
            </HapticPressable>
          ))}
        </View>
      )}


      {/* Add Sample Material Modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Share a study resource</Text>
              <HapticPressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={20} color={colors.foreground} />
              </HapticPressable>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Upload a PDF or image learners can use while studying with you.
            </Text>

            <HapticPressable
              onPress={handlePickFile}
              style={[
                styles.filePickerBox,
                {
                  borderColor: selectedAsset ? colors.primary : colors.border,
                  backgroundColor: selectedAsset ? colors.leaf : colors.background,
                },
              ]}
            >
              <Ionicons
                name={selectedAsset ? 'checkmark-circle' : 'cloud-upload-outline'}
                size={22}
                color={colors.primary}
              />
              <Text style={[styles.filePickerText, { color: colors.foreground }]}>
                {selectedAsset ? selectedAsset.name : 'Choose PDF or image file'}
              </Text>
            </HapticPressable>

            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title (e.g. MATH201 Midterm Cheat Sheet)"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Short description or topics covered"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textarea, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
            />

            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 }}>Shared materials are free for learners to open.</Text>

            {errorMsg ? <Text style={[styles.modalError, { color: colors.destructive }]}>{errorMsg}</Text> : null}

            <View style={styles.modalActions}>
              <ActionButton
                label={busy ? 'Saving…' : 'Share resource'}
                icon="checkmark"
                loading={busy}
                onPress={handleSaveItem}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  vaultWrapper: {
    marginTop: 18,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 10,
  },
  loadingSkeleton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  loadingSkeletonThumb: { height: 64, width: 64, borderRadius: 14 },
  loadingSkeletonCopy: { flex: 1, gap: 8 },
  loadingSkeletonLine: { height: 14, width: '72%', borderRadius: 6 },
  loadingSkeletonShortLine: { height: 11, width: '42%', borderRadius: 6 },
  addBtn: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  emptyBox: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 20,
    marginTop: 6,
  },
  emptyBoxText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vaultCard: {
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 6,
    padding: 12,
  },
  previewThumb: {
    alignItems: 'center',
    borderRadius: 12,
    height: 48,
    justifyContent: 'center',
    width: '100%',
  },
  itemTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: -0.2,
    lineHeight: 18,
  },
  itemDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  verifiedPill: {
    alignItems: 'center',
    borderRadius: 99,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  modalOverlay: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
  },
  modalSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
  },
  filePickerBox: {
    alignItems: 'center',
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  filePickerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textarea: {
    minHeight: 65,
    textAlignVertical: 'top',
  },
  modalError: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  modalActions: {
    marginTop: 6,
  },
  priceText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  pendingSales: {
    borderRadius: 14,
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  pendingSalesTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  pendingSaleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  pendingSaleText: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
});
