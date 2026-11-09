import React, { useState, useEffect, useCallback } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { SkeletonBlock } from '@/components/LoadingSkeleton';

export interface ResourceItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

interface ResourcesZoneProps {
  bookingId?: string;
  isCollapsible?: boolean;
}

export function ResourcesZone({ bookingId, isCollapsible = true }: ResourcesZoneProps) {
  const colors = useColors();
  const { request, upload, download } = useAuth();
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadResources = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const rows = await request<ResourceItem[]>(`/marketplace/resources?bookingId=${encodeURIComponent(bookingId)}`);
      setResources(rows || []);
    } catch {
      // Keep empty if none yet
      setResources([]);
    } finally {
      setLoading(false);
    }
  }, [bookingId, request]);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  const handleUpload = async () => {
    if (uploading || !bookingId) return;
    try {
      const selected = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (selected.canceled || !selected.assets?.[0]) return;
      const asset = selected.assets[0];

      if (asset.size && asset.size > 25 * 1024 * 1024) {
        setErrorMsg('Please select a file smaller than 25 MB.');
        return;
      }

      setUploading(true);
      setErrorMsg('');

      const form = new FormData();
      if (Platform.OS === 'web' && asset.file) {
        form.append('file', asset.file, asset.name);
      } else {
        form.append('file', {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType ?? 'application/octet-stream',
        } as unknown as Blob);
      }
      form.append('bookingId', bookingId);

      const created = await upload<ResourceItem>('/marketplace/resources', form);
      setResources((current) => [created, ...current]);
    } catch (err: any) {
      setErrorMsg(err.message || 'File upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const openResource = async (item: ResourceItem) => {
    try {
      const { blob } = await download(`/marketplace/resources/${item.id}/download`);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.fileName;
        link.target = '_blank';
        link.rel = 'noopener';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        const safeName = item.fileName.replace(/[\\/\0-\x1f]/g, '_').slice(0, 120) || 'resource';
        const file = new File(Paths.cache, `${item.id}-${safeName}`);
        file.write(new Uint8Array(await blob.arrayBuffer()));
        await Sharing.shareAsync(file.uri, {
          mimeType: item.mimeType,
          dialogTitle: 'Open shared material',
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not open file.');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={[styles.zoneContainer, { backgroundColor: colors.pale, borderColor: colors.border }]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <HapticPressable
          onPress={() => isCollapsible && setCollapsed(!collapsed)}
          style={styles.titleWrap}
        >
          <View style={[styles.zoneIcon, { backgroundColor: colors.leaf }]}>
            <Ionicons name="folder-outline" size={15} color={colors.primary} />
          </View>
          <Text style={[styles.zoneTitle, { color: colors.foreground }]}>
            Shared Resources & Past Exams
          </Text>
          {resources.length > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.leaf }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{resources.length}</Text>
            </View>
          )}
          {isCollapsible && (
            <Ionicons
              name={collapsed ? 'chevron-down' : 'chevron-up'}
              size={15}
              color={colors.mutedForeground}
            />
          )}
        </HapticPressable>

        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Add study material"
          disabled={uploading}
          onPress={handleUpload}
          style={[styles.uploadBtn, { backgroundColor: colors.primary }]}
        >
          {uploading ? (
            <SkeletonBlock style={styles.uploadSkeleton} />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={13} color={colors.primaryForeground} />
              <Text style={[styles.uploadBtnText, { color: colors.primaryForeground }]}>Add File</Text>
            </>
          )}
        </HapticPressable>
      </View>

      {errorMsg ? (
        <Text style={[styles.errorNotice, { color: colors.destructive }]}>{errorMsg}</Text>
      ) : null}

      {/* Horizontal Resource List */}
      {!collapsed && (
        <View style={styles.listContainer}>
          {loading ? (
            <View style={styles.loadingRow}>
              <SkeletonBlock style={styles.resourceSkeleton} />
              <SkeletonBlock style={styles.resourceSkeletonShort} />
            </View>
          ) : resources.length === 0 ? (
            <HapticPressable onPress={handleUpload} style={[styles.emptyCard, { borderColor: colors.border }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
              <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
                Drop past exams, slides, or assignment PDFs here
              </Text>
            </HapticPressable>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {resources.map((res) => {
                const isPdf = res.mimeType === 'application/pdf';
                return (
                  <HapticPressable
                    key={res.id}
                    onPress={() => void openResource(res)}
                    style={[styles.resourceCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    <View style={[styles.cardTop, { backgroundColor: isPdf ? colors.leaf : colors.background }]}>
                      <Ionicons
                        name={isPdf ? 'document-text' : 'image'}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text numberOfLines={1} style={[styles.fileName, { color: colors.foreground }]}>
                        {res.fileName}
                      </Text>
                      <View style={styles.cardMeta}>
                        <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
                          {formatSize(res.sizeBytes)}
                        </Text>
                        <Ionicons name="download-outline" size={12} color={colors.primary} />
                      </View>
                    </View>
                  </HapticPressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zoneContainer: {
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 8,
  },
  zoneIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  zoneTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: -0.2,
  },
  badge: {
    borderRadius: 99,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  uploadBtn: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  uploadBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  uploadSkeleton: { height: 14, width: 58, borderRadius: 6 },
  errorNotice: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 6,
  },
  listContainer: {
    marginTop: 10,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
  },
  resourceSkeleton: { height: 42, width: 180, borderRadius: 12 },
  resourceSkeletonShort: { height: 12, width: 80, borderRadius: 6 },
  emptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 9,
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  emptyCardText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  scrollContent: {
    gap: 10,
  },
  resourceCard: {
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    maxWidth: 220,
    minWidth: 160,
    padding: 8,
  },
  cardTop: {
    alignItems: 'center',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  fileMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
  },
});
