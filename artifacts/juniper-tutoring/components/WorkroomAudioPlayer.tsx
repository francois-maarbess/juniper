import React, { useState, useRef, useEffect } from 'react';
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

interface WorkroomAudioPlayerProps {
  audioUrl: string;
  durationSeconds?: number;
  outgoing?: boolean;
}

const NUM_BARS = 18;

export function WorkroomAudioPlayer({
  audioUrl,
  durationSeconds = 0,
  outgoing = false,
}: WorkroomAudioPlayerProps) {
  const colors = useColors();
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const barHeights = useRef<Animated.Value[]>(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(6))
  ).current;

  // Animated bars while playing
  useEffect(() => {
    if (isPlaying) {
      const loops = barHeights.map((anim, idx) => {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 6 + Math.random() * 18,
              duration: 200 + (idx % 3) * 60,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 4 + Math.random() * 5,
              duration: 200 + (idx % 2) * 60,
              useNativeDriver: false,
            }),
          ])
        );
        loop.start();
        return loop;
      });
      return () => loops.forEach((l) => l.stop());
    } else {
      barHeights.forEach((anim) => anim.setValue(6));
    }
  }, [isPlaying, barHeights]);

  const nativeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (nativeIntervalRef.current) {
        clearInterval(nativeIntervalRef.current);
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioUrl) return;

    if (isPlaying) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      if (nativeIntervalRef.current) {
        clearInterval(nativeIntervalRef.current);
      }
      setIsPlaying(false);
    } else {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof (window as any).Audio !== 'undefined') {
        if (!audioElementRef.current) {
          audioElementRef.current = new (window as any).Audio(audioUrl);
        }
        const audio = audioElementRef.current!;
        audio.ontimeupdate = () => {
          setPositionSec(Math.floor(audio.currentTime));
        };
        audio.onended = () => {
          setIsPlaying(false);
          setPositionSec(0);
        };
        audio.play().catch(() => setIsPlaying(false));
      } else {
        // Native fallback timer progression
        if (nativeIntervalRef.current) clearInterval(nativeIntervalRef.current);
        const totalDuration = durationSeconds > 0 ? durationSeconds : 10;
        nativeIntervalRef.current = setInterval(() => {
          setPositionSec((prev) => {
            if (prev >= totalDuration) {
              if (nativeIntervalRef.current) clearInterval(nativeIntervalRef.current);
              setIsPlaying(false);
              return 0;
            }
            return prev + 1;
          });
        }, 1000);
      }
      setIsPlaying(true);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const displayTime = isPlaying
    ? formatTime(positionSec)
    : formatTime(durationSeconds);

  return (
    <View style={[styles.playerContainer, outgoing ? styles.outgoingPlayer : styles.incomingPlayer]}>
      <HapticPressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause audio note' : 'Play audio note'}
        onPress={togglePlay}
        style={[
          styles.playBtn,
          {
            backgroundColor: outgoing ? 'rgba(255,255,255,0.2)' : colors.leaf,
          },
        ]}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={16}
          color={outgoing ? colors.primaryForeground : colors.primary}
        />
      </HapticPressable>

      <View style={styles.waveWrap}>
        {barHeights.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.waveBar,
              {
                height: anim,
                backgroundColor: outgoing ? 'rgba(255,255,255,0.85)' : colors.primary,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.timeTag}>
        <Ionicons
          name="mic-outline"
          size={11}
          color={outgoing ? colors.primaryForeground : colors.mutedForeground}
        />
        <Text
          style={[
            styles.timeText,
            { color: outgoing ? colors.primaryForeground : colors.mutedForeground },
          ]}
        >
          {displayTime}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  playerContainer: {
    alignItems: 'center',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    minWidth: 190,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  outgoingPlayer: {
    backgroundColor: 'transparent',
  },
  incomingPlayer: {
    backgroundColor: 'transparent',
  },
  playBtn: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  waveWrap: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    height: 24,
    justifyContent: 'center',
  },
  waveBar: {
    borderRadius: 2,
    width: 3,
  },
  timeTag: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  timeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
});
