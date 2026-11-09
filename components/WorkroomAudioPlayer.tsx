import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface WorkroomAudioPlayerProps {
  fileUrl: string;
  durationSeconds: number;
  senderName: string;
  senderAvatarInitial: string;
  sentAt?: string;
}

const NUM_BARS = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function WorkroomAudioPlayer({
  fileUrl,
  durationSeconds,
  senderName,
  senderAvatarInitial,
  sentAt,
}: WorkroomAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [totalSec, setTotalSec] = useState(durationSeconds);
  const [hasError, setHasError] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const barAnims = useRef<Animated.Value[]>(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(0.3)),
  ).current;

  // ── Waveform animation ──────────────────────────────────────────────────
  const startWaveform = useCallback(() => {
    barAnims.forEach((anim, i) => {
      const delay = (i % 4) * 70;
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.25 + Math.random() * 0.75,
            duration: 280 + (i % 5) * 60,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.15 + Math.random() * 0.35,
            duration: 280 + (i % 5) * 60,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });
  }, [barAnims]);

  const stopWaveform = useCallback(() => {
    barAnims.forEach((anim) => {
      anim.stopAnimation();
      Animated.timing(anim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  }, [barAnims]);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => null);
    };
  }, []);

  // ── Load & play/pause ───────────────────────────────────────────────────
  const handlePlayPause = useCallback(async () => {
    setHasError(false);

    if (soundRef.current && isPlaying) {
      // Pause
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      stopWaveform();
      return;
    }

    if (soundRef.current && !isPlaying) {
      // Resume
      await soundRef.current.playAsync();
      setIsPlaying(true);
      startWaveform();
      return;
    }

    // First load
    setIsLoading(true);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: fileUrl },
        { shouldPlay: true },
        (s) => {
          if (!s.isLoaded) return;
          setPositionSec((s.positionMillis ?? 0) / 1000);
          if (s.durationMillis) {
            setTotalSec(s.durationMillis / 1000);
          }
          if (s.didJustFinish) {
            setIsPlaying(false);
            setPositionSec(0);
            stopWaveform();
            sound.setPositionAsync(0).catch(() => null);
          }
        },
      );

      soundRef.current = sound;
      if (status.isLoaded && status.durationMillis) {
        setTotalSec(status.durationMillis / 1000);
      }
      setIsPlaying(true);
      startWaveform();
    } catch (err) {
      setHasError(true);
      console.error('WorkroomAudioPlayer load error', err);
    } finally {
      setIsLoading(false);
    }
  }, [fileUrl, isPlaying, startWaveform, stopWaveform]);

  // ── Progress ratio ───────────────────────────────────────────────────────
  const progressRatio = totalSec > 0 ? Math.min(positionSec / totalSec, 1) : 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      {/* Sender row */}
      <View style={styles.senderRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{senderAvatarInitial.toUpperCase()}</Text>
        </View>
        <View style={styles.senderInfo}>
          <Text style={styles.senderName}>{senderName}</Text>
          <Text style={styles.voiceLabel}>Voice Note</Text>
        </View>
        {sentAt && <Text style={styles.sentTime}>{formatTime(sentAt)}</Text>}
      </View>

      {/* Waveform */}
      <View style={styles.waveformRow}>
        {barAnims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.bar,
              {
                transform: [{ scaleY: anim }],
                backgroundColor:
                  i / NUM_BARS <= progressRatio ? Colors.primary : Colors.border,
              },
            ]}
          />
        ))}
      </View>

      {/* Progress track */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${Math.round(progressRatio * 100)}%` as unknown as number },
          ]}
        />
      </View>

      {/* Bottom row: play/pause + time */}
      <View style={styles.bottomRow}>
        <TouchableOpacity
          onPress={handlePlayPause}
          activeOpacity={0.75}
          style={styles.playBtn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color="#FFFFFF"
            />
          )}
        </TouchableOpacity>

        <View style={styles.timeWrap}>
          <Text style={styles.timeText}>{formatDuration(positionSec)}</Text>
          <Text style={styles.timeSep}> / </Text>
          <Text style={styles.timeText}>{formatDuration(totalSec)}</Text>
        </View>

        <Ionicons name="mic" size={16} color={Colors.textSecondary} />
      </View>

      {/* Error */}
      {hasError && (
        <Text style={styles.errorText}>Could not load audio. Please try again.</Text>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 14,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    maxWidth: 320,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarInitial: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  senderInfo: {
    flex: 1,
  },
  senderName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  voiceLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sentTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    gap: 2,
    marginBottom: 6,
  },
  bar: {
    flex: 1,
    height: 28,
    borderRadius: 2,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  timeSep: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.error,
    marginTop: 6,
    textAlign: 'center',
  },
});
