import React, { useState, useRef, useEffect, useCallback } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { SkeletonBlock } from '@/components/LoadingSkeleton';

interface VoiceNoteRecorderProps {
  bookingId?: string;
  requestId?: string;
  onVoiceRecorded?: (voiceNote: { fileUrl: string; durationSeconds: number; audioBlob?: Blob }) => void;
  onSendVoiceMessage?: (voiceNote: { fileUrl: string; durationSeconds: number; audioBlob?: Blob }) => Promise<void>;
  disabled?: boolean;
}

type RecorderState = 'idle' | 'recording' | 'previewing' | 'uploading';

const NUM_BARS = 22;

export function VoiceNoteRecorder({
  bookingId,
  requestId,
  onVoiceRecorded,
  onSendVoiceMessage,
  disabled,
}: VoiceNoteRecorderProps) {
  const colors = useColors();
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barHeights = useRef<Animated.Value[]>(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(6))
  ).current;

  // Pulse animation for recording state
  useEffect(() => {
    if (state === 'recording') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state, pulseAnim]);

  // Waveform bars animation
  useEffect(() => {
    if (state === 'recording' || isPlaying) {
      const intervals = barHeights.map((anim, idx) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 8 + Math.random() * 26,
              duration: 250 + (idx % 4) * 80,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 4 + Math.random() * 8,
              duration: 250 + (idx % 3) * 80,
              useNativeDriver: false,
            }),
          ])
        );
        loop.start();
        return loop;
      });
      return () => intervals.forEach((l) => l.stop());
    } else {
      barHeights.forEach((anim) => anim.setValue(6));
    }
  }, [state, isPlaying, barHeights]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrlRef.current && Platform.OS === 'web') {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
    };
  }, []);

  const startRecording = async () => {
    if (disabled) return;
    setErrorMsg(null);
    setDuration(0);

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new (window as any).MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event: any) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioBlobRef.current = blob;
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          stream.getTracks().forEach((track: any) => track.stop());
          setState('previewing');
        };

        mediaRecorder.start(100);
        setState('recording');

        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      } else {
        // Fallback or simulated recording if mediaDevices not available
        setState('recording');
        timerRef.current = setInterval(() => {
          setDuration((prev) => prev + 1);
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg('Microphone access is required to record voice messages.');
      setState('idle');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    } else {
      setState('previewing');
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    if (audioUrlRef.current && Platform.OS === 'web') {
      URL.revokeObjectURL(audioUrlRef.current);
    }
    audioBlobRef.current = null;
    audioUrlRef.current = null;
    setIsPlaying(false);
    setDuration(0);
    setState('idle');
  };

  const togglePlayback = () => {
    if (!audioUrlRef.current) return;

    if (isPlaying) {
      audioElementRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio(audioUrlRef.current);
        audioElementRef.current.onended = () => setIsPlaying(false);
      }
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const sendRecording = async () => {
    if (!audioBlobRef.current && !audioUrlRef.current) return;
    setState('uploading');

    try {
      const finalBlob = audioBlobRef.current;
      const finalUrl = audioUrlRef.current || '';

      if (onSendVoiceMessage) {
        await onSendVoiceMessage({
          fileUrl: finalUrl,
          durationSeconds: duration,
          audioBlob: finalBlob ?? undefined,
        });
      } else if (onVoiceRecorded) {
        onVoiceRecorded({
          fileUrl: finalUrl,
          durationSeconds: duration,
          audioBlob: finalBlob ?? undefined,
        });
      }

      cancelRecording();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send voice note.');
      setState('previewing');
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (state === 'idle') {
    return (
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel="Record voice message"
        onPress={startRecording}
        disabled={disabled}
        style={({ pressed }) => [
          styles.micButton,
          {
            backgroundColor: pressed ? colors.leaf : 'transparent',
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      >
        <Ionicons name="mic-outline" size={21} color={colors.primary} />
      </HapticPressable>
    );
  }

  return (
    <View style={[styles.recorderCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Recording or Preview status row */}
      <View style={styles.contentRow}>
        {state === 'recording' ? (
          <Animated.View style={[styles.recordingDot, { transform: [{ scale: pulseAnim }] }]} />
        ) : (
          <HapticPressable
            onPress={togglePlayback}
            style={[styles.playButton, { backgroundColor: colors.primary }]}
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color={colors.primaryForeground} />
          </HapticPressable>
        )}

        {/* Waveform Visualization */}
        <View style={styles.waveformContainer}>
          {barHeights.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: anim,
                  backgroundColor: state === 'recording' ? '#C62828' : colors.primary,
                },
              ]}
            />
          ))}
        </View>

        {/* Duration Timer */}
        <Text style={[styles.timerText, { color: colors.foreground }]}>
          {formatTime(duration)}
        </Text>
      </View>

      {/* Control Actions */}
      <View style={styles.actionsRow}>
        <HapticPressable
          accessibilityRole="button"
          accessibilityLabel="Cancel recording"
          onPress={cancelRecording}
          style={styles.cancelButton}
        >
          <Ionicons name="trash-outline" size={17} color={colors.mutedForeground} />
        </HapticPressable>

        {state === 'recording' ? (
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Done recording"
            onPress={stopRecording}
            style={[styles.doneButton, { backgroundColor: colors.leaf }]}
          >
            <Ionicons name="stop" size={14} color={colors.primary} />
            <Text style={[styles.doneButtonText, { color: colors.primary }]}>Review</Text>
          </HapticPressable>
        ) : (
          <HapticPressable
            accessibilityRole="button"
            accessibilityLabel="Send voice message"
            onPress={sendRecording}
            disabled={state === 'uploading'}
            style={[styles.sendVoiceButton, { backgroundColor: colors.primary }]}
          >
            {state === 'uploading' ? (
              <SkeletonBlock style={styles.uploadSkeleton} />
            ) : (
              <>
                <Text style={[styles.sendVoiceText, { color: colors.primaryForeground }]}>Send</Text>
                <Ionicons name="arrow-up" size={14} color={colors.primaryForeground} />
              </>
            )}
          </HapticPressable>
        )}
      </View>

      {errorMsg ? (
        <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  micButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 38,
  },
  recorderCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    marginBottom: 8,
    padding: 12,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  contentRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  recordingDot: {
    backgroundColor: '#C62828',
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  playButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  waveformContainer: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    height: 32,
    justifyContent: 'center',
  },
  waveformBar: {
    borderRadius: 2,
    width: 3,
  },
  timerText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    minWidth: 40,
    textAlign: 'right',
  },
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cancelButton: {
    padding: 6,
  },
  doneButton: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  sendVoiceButton: {
    alignItems: 'center',
    borderRadius: 99,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  uploadSkeleton: { height: 14, width: 42, borderRadius: 6 },
  sendVoiceText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 2,
  },
});
