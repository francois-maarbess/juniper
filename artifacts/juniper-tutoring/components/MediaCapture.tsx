import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { HapticPressable } from '@/components/HapticPressable';

export interface CapturedMedia { uri: string; type: 'image' | 'video'; }

export function MediaCapture({ onCapture, label = 'Take photo' }: { onCapture: (media: CapturedMedia) => void; label?: string }) {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const pickFromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) {
      onCapture({ uri: res.assets[0].uri, type: 'image' });
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        onCapture({ uri: photo.uri, type: 'image' });
        setShowCamera(false);
      }
    } catch {
      // ignore
    }
  };

  if (Platform.OS === 'web') {
    return (
      <HapticPressable onPress={pickFromLibrary} style={[styles.button, { backgroundColor: colors.leaf }]}>
        <Ionicons name="image-outline" size={18} color={colors.primary} />
        <Text style={[styles.text, { color: colors.primary }]}>{label}</Text>
      </HapticPressable>
    );
  }

  if (!permission) {
    return <View style={styles.loading} />;
  }

  if (!permission.granted) {
    return (
      <HapticPressable onPress={requestPermission} style={[styles.button, { backgroundColor: colors.leaf }]}>
        <Ionicons name="camera-outline" size={18} color={colors.primary} />
        <Text style={[styles.text, { color: colors.primary }]}>Grant camera access</Text>
      </HapticPressable>
    );
  }

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <View style={styles.cameraControls}>
          <HapticPressable onPress={() => setShowCamera(false)} style={styles.camBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </HapticPressable>
          <HapticPressable onPress={takePhoto} style={[styles.captureBtn, { borderColor: colors.primaryForeground }]}>
            <View style={[styles.captureInner, { backgroundColor: colors.primaryForeground }]} />
          </HapticPressable>
          <HapticPressable onPress={pickFromLibrary} style={styles.camBtn}>
            <Ionicons name="images-outline" size={24} color="#fff" />
          </HapticPressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <HapticPressable onPress={() => setShowCamera(true)} style={[styles.button, { backgroundColor: colors.leaf }]}>
        <Ionicons name="camera-outline" size={18} color={colors.primary} />
        <Text style={[styles.text, { color: colors.primary }]}>{label}</Text>
      </HapticPressable>
      <HapticPressable onPress={pickFromLibrary} style={[styles.button, { backgroundColor: colors.leaf }]}>
        <Ionicons name="images-outline" size={18} color={colors.primary} />
        <Text style={[styles.text, { color: colors.primary }]}>Library</Text>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  button: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  text: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  loading: { height: 40 },
  cameraContainer: { borderRadius: 16, height: 300, overflow: 'hidden', width: '100%' },
  camera: { flex: 1 },
  cameraControls: { alignItems: 'center', bottom: 16, flexDirection: 'row', justifyContent: 'space-around', left: 0, position: 'absolute', right: 0 },
  camBtn: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  captureBtn: { alignItems: 'center', borderRadius: 36, borderWidth: 4, height: 72, justifyContent: 'center', width: 72 },
  captureInner: { borderRadius: 28, height: 56, width: 56 },
});