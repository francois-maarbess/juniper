import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

export type PermissionState = 'undetermined' | 'granted' | 'denied';

export function useMediaPermissions() {
  const [camera, setCamera] = useState<PermissionState>('undetermined');
  const [microphone, setMicrophone] = useState<PermissionState>('undetermined');
  const [mediaLibrary, setMediaLibrary] = useState<PermissionState>('undetermined');
  const [photoLibrary, setPhotoLibrary] = useState<PermissionState>('undetermined');

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') {
      setCamera('granted');
      setMicrophone('granted');
      setMediaLibrary('granted');
      setPhotoLibrary('granted');
      return;
    }
    const [cam, mic, media, photo] = await Promise.all([
      Camera.getCameraPermissionsAsync(),
      Camera.getMicrophonePermissionsAsync(),
      MediaLibrary.getPermissionsAsync(),
      ImagePicker.getMediaLibraryPermissionsAsync(),
    ]);
    setCamera(cam.granted ? 'granted' : cam.canAskAgain ? 'undetermined' : 'denied');
    setMicrophone(mic.granted ? 'granted' : mic.canAskAgain ? 'undetermined' : 'denied');
    setMediaLibrary(media.granted ? 'granted' : media.canAskAgain ? 'undetermined' : 'denied');
    setPhotoLibrary(photo.granted ? 'granted' : photo.canAskAgain ? 'undetermined' : 'denied');
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const requestCamera = useCallback(async () => {
    if (Platform.OS === 'web') { setCamera('granted'); return true; }
    const res = await Camera.requestCameraPermissionsAsync();
    setCamera(res.granted ? 'granted' : 'denied');
    return res.granted;
  }, []);

  const requestMicrophone = useCallback(async () => {
    if (Platform.OS === 'web') { setMicrophone('granted'); return true; }
    const res = await Camera.requestMicrophonePermissionsAsync();
    setMicrophone(res.granted ? 'granted' : 'denied');
    return res.granted;
  }, []);

  const requestMediaLibrary = useCallback(async () => {
    if (Platform.OS === 'web') { setMediaLibrary('granted'); return true; }
    const res = await MediaLibrary.requestPermissionsAsync();
    setMediaLibrary(res.granted ? 'granted' : 'denied');
    return res.granted;
  }, []);

  const requestPhotoLibrary = useCallback(async () => {
    if (Platform.OS === 'web') { setPhotoLibrary('granted'); return true; }
    const res = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setPhotoLibrary(res.granted ? 'granted' : 'denied');
    return res.granted;
  }, []);

  const requestAll = useCallback(async () => {
    const results = await Promise.all([requestCamera(), requestMicrophone(), requestMediaLibrary(), requestPhotoLibrary()]);
    return results.every(Boolean);
  }, [requestCamera, requestMicrophone, requestMediaLibrary, requestPhotoLibrary]);

  return {
    camera, microphone, mediaLibrary, photoLibrary,
    refresh, requestCamera, requestMicrophone, requestMediaLibrary, requestPhotoLibrary, requestAll,
    allGranted: camera === 'granted' && microphone === 'granted' && mediaLibrary === 'granted' && photoLibrary === 'granted',
  };
}