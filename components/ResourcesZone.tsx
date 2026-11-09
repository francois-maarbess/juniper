import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ResourceFile {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

interface ResourcesZoneProps {
  authToken: string;
  apiBaseUrl: string;
  /** If provided, an "Attach" button appears on each card */
  onAttach?: (resource: ResourceFile) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mimeToIcon(mimeType: string): keyof typeof Ionicons.glyphMap {
  if (mimeType === 'application/pdf') return 'document-text';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'videocam';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'grid';
  return 'attach';
}

function mimeToColor(mimeType: string): string {
  if (mimeType === 'application/pdf') return '#E53935';
  if (mimeType.startsWith('image/')) return '#7B1FA2';
  if (mimeType.startsWith('video/')) return '#1565C0';
  if (mimeType.includes('word') || mimeType.includes('document')) return '#1976D2';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '#2E7D32';
  return Colors.primary;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ResourceCard({
  resource,
  onAttach,
}: {
  resource: ResourceFile;
  onAttach?: (r: ResourceFile) => void;
}) {
  const iconName = mimeToIcon(resource.mimeType);
  const iconColor = mimeToColor(resource.mimeType);

  return (
    <View style={cardStyles.card}>
      <View style={[cardStyles.iconWrap, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={iconName} size={28} color={iconColor} />
      </View>
      <Text style={cardStyles.fileName} numberOfLines={2}>
        {resource.fileName}
      </Text>
      <Text style={cardStyles.meta}>
        {formatBytes(resource.sizeBytes)} · {formatDate(resource.createdAt)}
      </Text>
      {onAttach && (
        <TouchableOpacity
          style={cardStyles.attachBtn}
          onPress={() => onAttach(resource)}
          activeOpacity={0.75}
        >
          <Ionicons name="link-outline" size={14} color={Colors.primary} />
          <Text style={cardStyles.attachText}>Attach</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: 148,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  fileName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.text,
    marginBottom: 4,
    lineHeight: 18,
  },
  meta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  attachText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.primary,
  },
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function ResourcesZone({
  authToken,
  apiBaseUrl,
  onAttach,
}: ResourcesZoneProps) {
  const [resources, setResources] = useState<ResourceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Fetch user's resources ───────────────────────────────────────────────
  const fetchResources = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${apiBaseUrl}/marketplace/resources`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: ResourceFile[] = await res.json();
      setResources(data);
    } catch (err) {
      setErrorMsg('Failed to load resources.');
      console.error('fetchResources error', err);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, authToken]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // ── Upload a new resource ────────────────────────────────────────────────
  const handleUpload = useCallback(async () => {
    let result: DocumentPicker.DocumentPickerResult;
    try {
      result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
    } catch {
      return;
    }

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    setUploading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        formData.append('file', blob, asset.name ?? 'resource');
      } else {
        formData.append('file', {
          uri: asset.uri,
          name: asset.name ?? 'resource',
          type: asset.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
      }

      const res = await fetch(`${apiBaseUrl}/marketplace/resources`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Upload failed (${res.status}): ${body}`);
      }

      const uploaded: ResourceFile = await res.json();
      setResources((prev) => [uploaded, ...prev]);
    } catch (err) {
      const msg = (err as Error).message ?? 'Upload failed.';
      setErrorMsg(msg);
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  }, [apiBaseUrl, authToken]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="folder-open" size={20} color={Colors.primary} />
          <Text style={styles.headerTitle}>Study Resources</Text>
        </View>
        <TouchableOpacity
          style={styles.uploadIconBtn}
          onPress={handleUpload}
          disabled={uploading}
          activeOpacity={0.75}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {/* Error */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : resources.length === 0 ? (
        /* Empty state */
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={handleUpload}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-upload-outline" size={32} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>Drop your PDFs & past exams here</Text>
          <Text style={styles.emptySubtitle}>Tap to browse files</Text>
        </TouchableOpacity>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        >
          {/* "Add more" card at start */}
          <TouchableOpacity
            style={styles.addMoreCard}
            onPress={handleUpload}
            disabled={uploading}
            activeOpacity={0.75}
          >
            {uploading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                <View style={styles.addMoreIcon}>
                  <Ionicons name="add" size={28} color={Colors.primary} />
                </View>
                <Text style={styles.addMoreText}>Add file</Text>
              </>
            )}
          </TouchableOpacity>

          {resources.map((r) => (
            <ResourceCard key={r.id} resource={r} onAttach={onAttach} />
          ))}
        </ScrollView>
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
  uploadIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.errorLight,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  loader: {
    marginVertical: 24,
  },
  emptyCard: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  listContent: {
    paddingVertical: 4,
    paddingRight: 4,
  },
  addMoreCard: {
    width: 100,
    height: 148,
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  addMoreIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.primary,
  },
});
