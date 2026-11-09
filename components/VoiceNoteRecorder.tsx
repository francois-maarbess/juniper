import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface VoiceNoteRecorderProps {
  requestId: string;
  authToken: string;
  apiBaseUrl: string;
  onUploaded?: (voiceNote: { id: string; fileUrl: string; durationSeconds: number }) => void;
}

type RecorderState = 'idle' | 'recording' | 'recorded' | 'playing' | 'uploading' | 'done';

const NUM_BARS = 20;
const API_TIMEOUT = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function VoiceNoteRecorder({
  requestId,
  authToken,
  apiBaseUrl,
  onUploaded,
}: VoiceNoteRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [playbackPos, setPlaybackPos] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingUriRef = useRef<string | null>(null);

  // Animated values for pulsing record button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  // Animated values for waveform bars
  const barAnims = useRef<Animated.Value[]>(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.3)),
  ).current;

  // ── Animation helpers ───────────────────────────────────────────────────
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  const startWaveform = useCallback((active: boolean) => {
    barAnims.forEach((anim, i) => {
      if (active) {
        const delay = (i % 5) * 80;
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.8,
              duration: 300 + Math.random() * 400,
              delay,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.2 + Math.random() * 0.4,
              duration: 300 + Math.random() * 400,
              useNativeDriver: true,
            }),
          ]),
        ).start();
      } else {
        anim.stopAnimation();
        anim.setValue(0.3);
      }
    });
  }, [barAnims]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => null);
      soundRef.current?.unloadAsync().catch(() => null);
    };
  }, []);

  // ── Audio permission ────────────────────────────────────────────────────
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow microphone access to record voice notes.');
      return false;
    }
    return true;
  }, []);

  // ── Start recording ─────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    const permitted = await requestPermission();
    if (!permitted) return;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;

      setDuration(0);
      setState('recording');
      startPulse();

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      setErrorMsg('Could not start recording. Please try again.');
      console.error('startRecording error', err);
    }
  }, [requestPermission, startPulse]);

  // ── Stop recording ──────────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopPulse();

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingUriRef.current = uri ?? null;
      recordingRef.current = null;

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (uri) {
        // Load sound for playback duration
        const { sound, status } = await Audio.Sound.createAsync({ uri });
        soundRef.current = sound;
        if (status.isLoaded) {
          setPlaybackDuration((status.durationMillis ?? 0) / 1000);
        }
      }

      setState('recorded');
    } catch (err) {
      setErrorMsg('Failed to stop recording.');
      console.error('stopRecording error', err);
    }
  }, [stopPulse]);

  // ── Playback toggle ─────────────────────────────────────────────────────
  const togglePlayback = useCallback(async () => {
    if (!soundRef.current) return;

    if (state === 'playing') {
      await soundRef.current.pauseAsync();
      startWaveform(false);
      setState('recorded');
    } else {
      await soundRef.current.playAsync();
      startWaveform(true);
      setState('playing');

      soundRef.current.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        setPlaybackPos((status.positionMillis ?? 0) / 1000);
        if (status.didJustFinish) {
          startWaveform(false);
          setState('recorded');
          setPlaybackPos(0);
          soundRef.current?.setPositionAsync(0).catch(() => null);
        }
      });
    }
  }, [state, startWaveform]);

  // ── Delete recording ────────────────────────────────────────────────────
  const deleteRecording = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    recordingUriRef.current = null;
    setDuration(0);
    setPlaybackPos(0);
    setPlaybackDuration(0);
    startWaveform(false);
    setState('idle');
  }, [startWaveform]);

  // ── Upload ──────────────────────────────────────────────────────────────
  const uploadVoiceNote = useCallback(async () => {
    const uri = recordingUriRef.current;
    if (!uri) {
      setErrorMsg('No recording to upload.');
      return;
    }

    setState('uploading');
    setErrorMsg(null);

    try {
      const formData = new FormData();

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, 'voice-note.m4a');
      } else {
        // React Native FormData accepts the { uri, name, type } shape
        formData.append('file', {
          uri,
          name: 'voice-note.m4a',
          type: 'audio/m4a',
        } as unknown as Blob);
      }

      formData.append('durationSeconds', String(Math.round(duration)));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

      const res = await fetch(`${apiBaseUrl}/marketplace/requests/${requestId}/voice-note`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Upload failed (${res.status}): ${body}`);
      }

      const data = await res.json();
      setState('done');
      onUploaded?.(data);
    } catch (err) {
      const msg = (err as Error).message ?? 'Upload failed. Please try again.';
      setErrorMsg(msg);
      setState('recorded');
      console.error('uploadVoiceNote error', err);
    }
  }, [apiBaseUrl, authToken, duration, onUploaded, requestId]);

  // ── Derived display values ───────────────────────────────────────────────
  const isRecording = state === 'recording';
  const isRecorded = state === 'recorded' || state === 'playing';
  const isUploading = state === 'uploading';
  const isDone = state === 'done';

  const progressRatio =
    playbackDuration > 0 ? Math.min(playbackPos / playbackDuration, 1) : 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Voice Note</Text>

      {/* ── Record / Stop button ── */}
      {!isRecorded && !isDone && (
        <View style={styles.recordSection}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity
              style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.8}
              disabled={isUploading}
            >
              {isRecording ? (
                <Ionicons name="stop" size={28} color="#FFFFFF" />
              ) : (
                <Ionicons name="mic" size={28} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </Animated.View>

          <Text style={styles.timerText}>{formatDuration(duration)}</Text>
          <Text style={styles.hint}>
            {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
          </Text>
        </View>
      )}

      {/* ── Playback bar & waveform ── */}
      {isRecorded && (
        <View style={styles.playbackCard}>
          {/* Waveform bars */}
          <View style={styles.waveformRow}>
            {barAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.bar,
                  {
                    transform: [{ scaleY: anim }],
                    backgroundColor:
                      i / NUM_BARS <= progressRatio
                        ? Colors.primary
                        : Colors.border,
                  },
                ]}
              />
            ))}
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progressRatio * 100}%` as unknown as number }]}
            />
          </View>

          {/* Duration labels */}
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>{formatDuration(playbackPos)}</Text>
            <Text style={styles.timeLabel}>{formatDuration(playbackDuration)}</Text>
          </View>

          {/* Controls */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={togglePlayback}
              activeOpacity={0.7}
            >
              <Ionicons
                name={state === 'playing' ? 'pause-circle' : 'play-circle'}
                size={44}
                color={Colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.uploadBtn, isUploading && styles.uploadBtnDisabled]}
              onPress={uploadVoiceNote}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.uploadBtnText}>Send Note</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={deleteRecording}
              activeOpacity={0.7}
              disabled={isUploading}
            >
              <Ionicons name="trash-outline" size={26} color={Colors.error} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Done state ── */}
      {isDone && (
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
          <Text style={styles.doneText}>Voice note sent!</Text>
          <TouchableOpacity onPress={() => setState('idle')} style={styles.recordAgainBtn}>
            <Text style={styles.recordAgainText}>Record another</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Error ── */}
      {errorMsg && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
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
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  recordSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  pulseRing: {
    borderRadius: 40,
  },
  recordBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  recordBtnActive: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  timerText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 32,
    color: Colors.text,
    marginTop: 16,
    letterSpacing: 2,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  playbackCard: {
    paddingVertical: 8,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    gap: 3,
    marginBottom: 8,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    height: 32,
  },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  iconBtn: {
    padding: 4,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
    gap: 8,
  },
  uploadBtnDisabled: {
    opacity: 0.6,
  },
  uploadBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  doneCard: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  doneText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.success,
  },
  recordAgainBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  recordAgainText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    backgroundColor: Colors.errorLight,
    padding: 10,
    borderRadius: 10,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
});
