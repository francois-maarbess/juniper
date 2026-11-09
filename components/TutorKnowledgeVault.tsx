import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VaultItem {
  id: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  mimeType: string;
  isPublic: boolean;
  createdAt: string;
}

interface TutorKnowledgeVaultProps {
  tutorUserId: string;
  viewerUserId: string;
  apiBaseUrl: string;
  authToken: string;
  items: VaultItem[];
  onItemAdded?: (item: VaultItem) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mimeColor(mimeType: string): string {
  if (mimeType === 'application/pdf') return '#E53935';
  if (mimeType.startsWith('image/')) return '#7B1FA2';
  if (mimeType.startsWith('video/')) return '#1565C0';
  return Colors.primary;
}

function mimeIconName(mimeType: string): keyof typeof Ionicons.glyphMap {
  if (mimeType === 'application/pdf') return 'document-text';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'videocam';
  return 'document';
}

// ---------------------------------------------------------------------------
// Vault Item Card
// ---------------------------------------------------------------------------
function VaultCard({
  item,
  isOwner,
}: {
  item: VaultItem;
  isOwner: boolean;
}) {
  const iconColor = mimeColor(item.mimeType);
  const iconName = mimeIconName(item.mimeType);

  const handlePreview = useCallback(async () => {
    try {
      const supported = await Linking.canOpenURL(item.fileUrl);
      if (supported) {
        await Linking.openURL(item.fileUrl);
      } else {
        Alert.alert('Cannot open this file on your device.');
      }
    } catch {
      Alert.alert('Failed to open file.');
    }
  }, [item.fileUrl]);

  return (
    <View style={vaultCardStyles.card}>
      {/* Icon thumbnail */}
      <View style={[vaultCardStyles.iconWrap, { backgroundColor: iconColor + '1A' }]}>
        <Ionicons name={iconName} size={32} color={iconColor} />
      </View>

      {/* Info */}
      <Text style={vaultCardStyles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {item.description ? (
        <Text style={vaultCardStyles.description} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      {/* Actions */}
      <TouchableOpacity
        style={vaultCardStyles.previewBtn}
        onPress={handlePreview}
        activeOpacity={0.75}
      >
        <Ionicons name="eye-outline" size={14} color={Colors.primary} />
        <Text style={vaultCardStyles.previewText}>Preview</Text>
      </TouchableOpacity>
    </View>
  );
}

const vaultCardStyles = StyleSheet.create({
  card: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 18,
  },
  description: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    marginTop: 'auto',
  },
  previewText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.primary,
  },
});

// ---------------------------------------------------------------------------
// Add Sample Modal
// ---------------------------------------------------------------------------
interface AddSampleModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, file: DocumentPicker.DocumentPickerAsset) => Promise<void>;
}

function AddSampleModal({ visible, onClose, onSubmit }: AddSampleModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      setSelectedFile(result.assets[0]);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) {
      Alert.alert('Please enter a title.');
      return;
    }
    if (!selectedFile) {
      Alert.alert('Please select a file.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(title.trim(), description.trim(), selectedFile);
      setTitle('');
      setDescription('');
      setSelectedFile(null);
      onClose();
    } catch {
      Alert.alert('Upload failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [description, onClose, onSubmit, selectedFile, title]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.sheetTitle}>Add Study Sample</Text>

          <Text style={modalStyles.fieldLabel}>Title *</Text>
          <TextInput
            style={modalStyles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. MATH 201 Midterm Notes"
            placeholderTextColor={Colors.textSecondary}
          />

          <Text style={modalStyles.fieldLabel}>Description</Text>
          <TextInput
            style={[modalStyles.input, modalStyles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Brief description of this resource..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <Text style={modalStyles.fieldLabel}>File *</Text>
          <TouchableOpacity style={modalStyles.filePickerBtn} onPress={handlePickFile}>
            <Ionicons
              name={selectedFile ? 'document-attach' : 'cloud-upload-outline'}
              size={20}
              color={Colors.primary}
            />
            <Text style={modalStyles.filePickerText}>
              {selectedFile ? selectedFile.name : 'Browse files'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[modalStyles.submitBtn, submitting && modalStyles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={modalStyles.submitBtnText}>Upload Sample</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose}>
            <Text style={modalStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.text,
    marginBottom: 20,
  },
  fieldLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.text,
  },
  textarea: {
    minHeight: 80,
    paddingTop: 12,
  },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  filePickerText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.primary,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  cancelBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 10,
  },
  cancelText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
  },
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function TutorKnowledgeVault({
  tutorUserId,
  viewerUserId,
  apiBaseUrl,
  authToken,
  items,
  onItemAdded,
}: TutorKnowledgeVaultProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const isOwner = tutorUserId === viewerUserId;

  const handleAddSample = useCallback(
    async (
      title: string,
      description: string,
      file: DocumentPicker.DocumentPickerAsset,
    ) => {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const resp = await fetch(file.uri);
        const blob = await resp.blob();
        formData.append('file', blob, file.name ?? 'resource');
      } else {
        formData.append('file', {
          uri: file.uri,
          name: file.name ?? 'resource',
          type: file.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
      }
      formData.append('title', title);
      formData.append('description', description);

      const res = await fetch(`${apiBaseUrl}/marketplace/vault`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Upload failed (${res.status}): ${body}`);
      }

      const newItem: VaultItem = await res.json();
      onItemAdded?.(newItem);
    },
    [apiBaseUrl, authToken, onItemAdded],
  );

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="school" size={20} color={Colors.primary} />
          <Text style={styles.headerTitle}>Study Notes & Recaps</Text>
        </View>
        {isOwner && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="add" size={16} color={Colors.primary} />
            <Text style={styles.addBtnText}>Add Sample</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Learner access notice (non-owner) */}
      {!isOwner && (
        <View style={styles.accessPill}>
          <Ionicons name="lock-closed-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.accessPillText}>
            Get full access by booking a session
          </Text>
        </View>
      )}

      {/* Grid */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="documents-outline" size={40} color={Colors.border} />
          <Text style={styles.emptyText}>
            {isOwner
              ? 'Share your notes to attract students'
              : 'No samples uploaded yet'}
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {items.map((item) => (
            <VaultCard key={item.id} item={item} isOwner={isOwner} />
          ))}
        </View>
      )}

      {/* Add Sample Modal (owner only) */}
      {isOwner && (
        <AddSampleModal
          visible={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSample}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.text,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.primary,
  },
  accessPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  accessPillText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 10,
  },
  emptyText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
