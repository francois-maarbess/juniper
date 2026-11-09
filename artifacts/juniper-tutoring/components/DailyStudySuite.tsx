import React, { useEffect, useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export function DailyStudySuite() {
  const colors = useColors();
  const router = useRouter();

  // Streak state
  const [streakDays, setStreakDays] = useState(4);
  const [streakCelebrated, setStreakCelebrated] = useState(false);

  // Pomodoro state
  const [timerMode, setTimerMode] = useState<'focus25' | 'sprint15' | 'break5'>('focus25');
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(1);

  // Timer mode duration helper
  const getDurationForMode = (mode: 'focus25' | 'sprint15' | 'break5') => {
    if (mode === 'sprint15') return 15 * 60;
    if (mode === 'break5') return 5 * 60;
    return 25 * 60;
  };

  const handleSelectMode = (mode: 'focus25' | 'sprint15' | 'break5') => {
    setTimerMode(mode);
    setIsActive(false);
    setSecondsRemaining(getDurationForMode(mode));
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isActive && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((current) => current - 1);
      }, 1000);
    } else if (secondsRemaining === 0 && isActive) {
      setIsActive(false);
      if (timerMode !== 'break5') {
        setCompletedSessions((c) => c + 1);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, secondsRemaining, timerMode]);

  const toggleTimer = () => {
    if (secondsRemaining === 0) {
      setSecondsRemaining(getDurationForMode(timerMode));
    }
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setSecondsRemaining(getDurationForMode(timerMode));
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct =
    100 - (secondsRemaining / getDurationForMode(timerMode)) * 100;

  return (
    <View style={styles.container}>
      {/* Daily Study Streak Banner */}
      <View style={[styles.streakCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.streakLeft}>
          <View style={[styles.fireBadge, { backgroundColor: colors.leaf, borderColor: colors.border }]}>
            <Ionicons name="flame" size={22} color={colors.primary} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.streakTitle, { color: colors.foreground }]}>
                {streakDays}-Day Study Streak
              </Text>
              <View style={[styles.activePill, { backgroundColor: colors.leaf }]}>
                <Text style={[styles.activePillText, { color: colors.primary }]}>Active today</Text>
              </View>
            </View>
            <Text style={[styles.streakSub, { color: colors.mutedForeground }]}>
              {completedSessions} focus session{completedSessions === 1 ? '' : 's'} completed today
            </Text>
          </View>
        </View>

        <HapticPressable
          onPress={() => {
            if (!streakCelebrated) {
              setStreakDays((d) => d + 1);
              setStreakCelebrated(true);
            }
          }}
          style={({ pressed }) => [
            styles.checkInBtn,
            { backgroundColor: streakCelebrated ? colors.leaf : colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons
            name={streakCelebrated ? 'checkmark' : 'flame'}
            size={14}
            color={streakCelebrated ? colors.primary : colors.primaryForeground}
          />
          <Text
            style={[
              styles.checkInBtnText,
              { color: streakCelebrated ? colors.primary : colors.primaryForeground },
            ]}
          >
            {streakCelebrated ? 'Kept alive!' : 'Check in'}
          </Text>
        </HapticPressable>
      </View>

      {/* Focus Timer Suite */}
      <View style={[styles.timerCard, { backgroundColor: colors.timerBg, borderColor: colors.timerBorder }]}>
        <View style={styles.timerTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="timer-outline" size={18} color={colors.timerSubtle} />
            <Text style={styles.timerHeaderTitle}>Daily Focus Timer</Text>
          </View>

          {/* Mode Switcher */}
          <View style={styles.modeRow}>
            {[
              { id: 'focus25', label: '25m Focus' },
              { id: 'sprint15', label: '15m Sprint' },
              { id: 'break5', label: '5m Break' },
            ].map((m) => (
              <HapticPressable
                key={m.id}
                onPress={() => handleSelectMode(m.id as never)}
                style={[
                  styles.modeTab,
                  timerMode === m.id && styles.modeTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    timerMode === m.id && styles.modeTabTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </HapticPressable>
            ))}
          </View>
        </View>

        {/* Timer Countdown Display */}
        <View style={styles.displayRow}>
          <View>
            <Text style={styles.timeBig}>{formatTime(secondsRemaining)}</Text>
            <Text style={styles.timeModeCaption}>
              {isActive
                ? timerMode === 'break5'
                  ? 'Rest & recharge'
                  : 'Deep focus mode'
                : 'Paused — ready when you are'}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controlsRow}>
            <HapticPressable
              onPress={toggleTimer}
              style={({ pressed }) => [
                styles.mainControlBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons
                name={isActive ? 'pause' : 'play'}
                size={22}
                color={colors.timerBg}
              />
            </HapticPressable>

            <HapticPressable
              onPress={resetTimer}
              style={({ pressed }) => [
                styles.resetBtn,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="refresh" size={17} color={colors.timerSubtle} />
            </HapticPressable>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
      </View>

      {/* Learning support promise, grounded in clear expectations */}
      <View style={[styles.guaranteeBanner, { backgroundColor: colors.leaf, borderColor: colors.primary }]}>
        <View style={styles.guaranteeTop}>
          <Ionicons name="book-outline" size={18} color={colors.primary} />
          <Text style={[styles.guaranteeTitle, { color: colors.foreground }]}>
            Learn it with support
          </Text>
        </View>
        <Text style={[styles.guaranteeText, { color: colors.mutedForeground }]}>
          Bring a question, assignment, or project. Work through the ideas with a tutor, then leave with a clearer understanding and practical next steps.
        </Text>
        <HapticPressable
          onPress={() => router.push('/request')}
          style={({ pressed }) => [
            styles.guaranteeAction,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[styles.guaranteeActionText, { color: colors.primary }]}>
            Find thoughtful tutor support →
          </Text>
        </HapticPressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 14,
  },
  streakCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  streakLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  fireBadge: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  streakTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  activePill: {
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  activePillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  streakSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  checkInBtn: {
    alignItems: 'center',
    borderRadius: 99,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  checkInBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 0.1,
  },
  timerCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 14,
    padding: 18,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
  timerTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  timerHeaderTitle: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  modeRow: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 99,
    flexDirection: 'row',
    padding: 3,
  },
  modeTab: {
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  modeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modeTabText: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  displayRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeBig: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 38,
    letterSpacing: -1,
  },
  timeModeCaption: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 2,
  },
  controlsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  mainControlBtn: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    height: 48,
    justifyContent: 'center',
    width: 48,
    shadowColor: '#183B31',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  resetBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 99,
    height: 5,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 99,
    height: '100%',
  },
  guaranteeBanner: {
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 6,
    padding: 14,
  },
  guaranteeTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  guaranteeTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: -0.2,
  },
  guaranteeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  guaranteeAction: {
    marginTop: 4,
  },
  guaranteeActionText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
});
