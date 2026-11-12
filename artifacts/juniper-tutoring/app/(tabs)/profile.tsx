import React, { useEffect, useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SAMPLE_TUTORS } from '@/constants/juniper-data';
import { useJuniper } from '@/context/JuniperContext';
import {
  ActionButton,
  BrandMark,
  PageHeader,
  PreviewNotice,
  Screen,
  SectionHeading,
  TutorPortrait,
} from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';

export default function ProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { state, setRole, setTutorProfileId } = useJuniper();
  const { user, signOut, request, setActiveRole } = useAuth();
  const [accountTutorProfile, setAccountTutorProfile] = useState<{
    displayName: string; hourlyRateCents: number; approval: string; subjects: Array<{ name: string }>;
  } | null>(null);
  const [isAdministrator, setIsAdministrator] = useState(false);
  const [accountRequestCount, setAccountRequestCount] = useState(0);
  useEffect(() => {
    if (!user) { setAccountTutorProfile(null); return; }
    let active = true;
    void request<typeof accountTutorProfile>('/marketplace/tutor-profile').then((profile) => {
      if (active) setAccountTutorProfile(profile);
    }).catch(() => undefined);
    void request<{ isAdministrator: boolean }>('/marketplace/admin/status').then((result) => {
      if (active) setIsAdministrator(result.isAdministrator);
    }).catch(() => undefined);
    void request<Array<{ id: string }>>('/marketplace/requests/mine').then((items) => {
      if (active) setAccountRequestCount(items.length);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user, request]);
  const activeRole = user?.activeRole ?? state.role;
  const supportEmail = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ?? '';
  const tutorApplication = user ? accountTutorProfile : state.tutorApplication;
  const currentTutor =
    SAMPLE_TUTORS.find((tutor) => tutor.id === state.tutorProfileId) ?? SAMPLE_TUTORS[0];

  return (
    <Screen>
      <View style={styles.topLine}>
        <BrandMark />
        <View style={[styles.localChip, { backgroundColor: colors.pale }]}>
          <Text style={[styles.localChipText, { color: colors.deep }]}>Account</Text>
        </View>
      </View>
      <PageHeader title="Your profile" eyebrow={user ? 'YOUR JUNIPER ACCOUNT' : 'A JUNIPER PREVIEW'} />
      {!user ? <PreviewNotice /> : null}

      {!user ? <View style={[styles.rolePanel, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={[styles.roleEyebrow, { color: colors.accent }]}>EXPLORE THE PREVIEW</Text>
        <Text style={[styles.roleTitle, { color: colors.foreground }]}>
          {state.role === 'student' ? 'A learner' : 'A tutor'}
        </Text>
          <Text style={[styles.roleDescription, { color: colors.mutedForeground }]}>
          Sample profiles and activity are for exploring the design. Your real account stays yours.
        </Text>
        <View style={[styles.roleSwitch, { backgroundColor: colors.deep }]}>
          {(['student', 'tutor'] as const).map((role) => (
            <HapticPressable
              key={role}
              accessibilityRole="button"
              accessibilityState={{ selected: state.role === role }}
              onPress={() => setRole(role)}
              style={[
                styles.roleOption,
                state.role === role && { backgroundColor: colors.cream },
              ]}
              testID={`role-${role}`}
            >
              <Text
                style={[
                  styles.roleOptionText,
                  { color: state.role === role ? colors.accent : colors.foreground },
                ]}
              >
                {role === 'student' ? 'Learner' : 'Tutor'}
              </Text>
            </HapticPressable>
          ))}
        </View>
      </View> : null}

      {activeRole === 'student' ? (
        <>
          <View style={[styles.identityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.identityAvatar, { backgroundColor: colors.iconCircle }]}>
              <Ionicons name="person-outline" size={23} color={colors.accent} />
            </View>
            <View style={styles.identityCopy}>
              <Text style={[styles.identityName, { color: colors.foreground }]}>{user ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}` : 'Your Juniper account'}</Text>
              <Text style={[styles.identityCaption, { color: colors.mutedForeground }]}>
                {user?.email ?? 'Sign in to keep your account with you'}
              </Text>
            </View>
            <Ionicons name={user?.emailVerifiedAt ? 'checkmark-circle' : 'person-circle-outline'} size={20} color={user?.emailVerifiedAt ? '#B9D8B1' : colors.mutedForeground} />
          </View>
          <SectionHeading title="Your learning" />
          {!user ? <HapticPressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/find')}
            style={({ pressed }) => [
              styles.menuRow,
              { borderBottomColor: colors.border, opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <Ionicons name="heart-outline" size={19} color={colors.primary} />
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>Saved tutors</Text>
            <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>
              {state.savedTutorIds.length}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </HapticPressable> : null}
          <HapticPressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/activity')}
            style={({ pressed }) => [
              styles.menuRow,
              { borderBottomColor: colors.border, opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <Ionicons name="document-text-outline" size={19} color={colors.primary} />
            <Text style={[styles.menuLabel, { color: colors.foreground }]}>My requests</Text>
            <Text style={[styles.menuValue, { color: colors.mutedForeground }]}>
              {user ? accountRequestCount : state.requests.length}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </HapticPressable>
          <View style={[styles.applicationCard, { backgroundColor: colors.pale }]}>
            <View style={[styles.applicationIcon, { backgroundColor: colors.card }]}>
              <Ionicons name="school-outline" size={19} color={colors.primary} />
            </View>
            <Text style={[styles.applicationTitle, { color: colors.foreground }]}>
              {tutorApplication ? 'Your tutor setup' : 'Share what you know'}
            </Text>
            <Text style={[styles.applicationCopy, { color: colors.mutedForeground }]}>
              {tutorApplication
                ? `${accountTutorProfile?.subjects[0]?.name ?? state.tutorApplication?.subject ?? 'Tutor profile'} · $${accountTutorProfile ? accountTutorProfile.hourlyRateCents / 100 : state.tutorApplication?.hourlyRate}/hour · ${accountTutorProfile?.approval ?? 'saved to your account'}`
                : user ? 'Share your subject, approach, and experience. You can use tutor tools once your profile is approved.' : 'Set up a teaching profile and preview the tutor side of Juniper.'}
            </Text>
            <ActionButton
              label={tutorApplication ? 'Edit tutor setup' : 'Set up a tutor profile'}
              icon="arrow-forward"
              variant="secondary"
              onPress={() => router.push('/become-tutor')}
              testID="become-tutor"
            />
            {user && accountTutorProfile?.approval === 'approved' ? (
              <View style={{ marginTop: 12 }}>
                <ActionButton
                  label="Open Tutor Studio"
                  icon="briefcase"
                  onPress={() => void setActiveRole('tutor')}
                />
              </View>
            ) : !user ? (
              <HapticPressable
                accessibilityRole="button"
                onPress={() => setRole('tutor')}
                style={({ pressed }) => [styles.switchPreview, { opacity: pressed ? 0.65 : 1 }]}
              >
                <Text style={[styles.switchPreviewText, { color: colors.primary }]}>
                  Switch to tutor preview
                </Text>
              </HapticPressable>
            ) : null}
          </View>
        </>
      ) : (
        <>
          <SectionHeading title={user ? 'Your tutor profile' : 'Tutor preview profile'} />
          {user ? <ActionButton label="Switch to learner space" icon="school-outline" variant="secondary" onPress={() => void setActiveRole('student')} /> : null}
          {!user ? <Text style={[styles.settingHint, { color: colors.mutedForeground }]}>
            These fictional profiles are for preview only. No real tutor has been verified.
          </Text> : null}
          {!user ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tutorPicker}>
            {SAMPLE_TUTORS.map((tutor) => {
              const selected = tutor.id === state.tutorProfileId;
              return (
                <HapticPressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={tutor.id}
                  onPress={() => setTutorProfileId(tutor.id)}
                  style={[
                    styles.tutorOption,
                    {
                      backgroundColor: selected ? colors.leaf : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <TutorPortrait tutor={tutor} size="small" />
                  <Text style={[styles.tutorOptionName, { color: colors.foreground }]}>
                    {tutor.name.split(' ')[0]}
                  </Text>
                  <Text style={[styles.tutorOptionSubject, { color: colors.mutedForeground }]}>
                    {tutor.subject}
                  </Text>
                </HapticPressable>
              );
            })}
          </ScrollView> : null}
          {tutorApplication ? (
            <View style={[styles.applicationSummary, { backgroundColor: colors.pale }]}>
              <View style={styles.applicationSummaryTop}>
                <View style={styles.applicationCopyBlock}>
                  <Text style={[styles.applicationTitle, { color: colors.foreground }]}>
                    Tutor application
                  </Text>
                  <Text style={[styles.applicationCopy, { color: colors.mutedForeground }]}>
                    {accountTutorProfile?.displayName ?? state.tutorApplication?.displayName} · {accountTutorProfile?.subjects[0]?.name ?? state.tutorApplication?.subject} · ${accountTutorProfile ? accountTutorProfile.hourlyRateCents / 100 : state.tutorApplication?.hourlyRate}/hour
                  </Text>
                </View>
                <Ionicons name="document-text-outline" size={19} color={colors.primary} />
              </View>
              <Text style={[styles.applicationDisclaimer, { color: colors.mutedForeground }]}>
                {accountTutorProfile?.approval === 'approved' ? 'Your reviewed tutor profile is visible to learners in your approved subjects.' : `Your account profile is ${accountTutorProfile?.approval ?? 'submitted for review'}. It appears publicly only after approval.`}
              </Text>
              <ActionButton
                label="Edit tutor setup"
                variant="secondary"
                onPress={() => router.push('/become-tutor')}
              />
            </View>
          ) : null}
        </>
      )}

      {isAdministrator ? <ActionButton label="Review tutor applications" icon="shield-checkmark-outline" variant="secondary" onPress={() => router.push('/admin/tutors' as never)} /> : null}

      <SectionHeading title="Support & arrangements" />
      <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.aboutTitle, { color: colors.foreground }]}>Payment is between you and your tutor.</Text>
        <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>
          Juniper connects learners and tutors but doesn’t collect, send, hold, or refund payments. Before a session, agree directly on the amount, payment method, and cancellation expectations.
        </Text>
        <View style={[styles.aboutDivider, { backgroundColor: colors.border }]} />
        <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>
          If something feels unsafe or a session doesn’t go as agreed, contact Juniper. We can review activity on the platform, but we can’t reverse a direct payment.
        </Text>
        {supportEmail ? (
          <View style={{ marginTop: 14 }}>
            <ActionButton label="Contact Juniper support" icon="mail-outline" variant="secondary" onPress={() => void Linking.openURL(`mailto:${supportEmail}?subject=${encodeURIComponent('Juniper beta support')}`).catch(() => undefined)} />
          </View>
        ) : (
          <Text style={[styles.applicationDisclaimer, { color: colors.mutedForeground, marginTop: 12 }]}>Support contact is being set up for this beta. If you joined through an invitation, contact the person who invited you.</Text>
        )}
      </View>

      <SectionHeading title="About Juniper" />
      <View style={[styles.aboutCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.aboutTitle, { color: colors.foreground }]}>Reviewed before they go live.</Text>
        <Text style={[styles.aboutText, { color: colors.mutedForeground }]}>
          Juniper checks tutor qualifications before showing profiles to learners. Your requests and conversations stay with your account.
        </Text>
        <View style={[styles.aboutDivider, { backgroundColor: colors.border }]} />
        <View style={styles.aboutFoot}>
          <Ionicons name="shield-checkmark-outline" size={17} color={colors.primary} />
          <Text style={[styles.aboutFootText, { color: colors.primary }]}>
            Every public tutor profile has been reviewed.
          </Text>
        </View>
      </View>

      <ActionButton
        label="Sign out of this account"
        icon="log-out-outline"
        variant="secondary"
        onPress={() => void signOut().then(() => router.replace('/(auth)/welcome'))}
        testID="sign-out"
      />
      <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
        Juniper · One-to-one learning
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  localChip: { borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  localChipText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.4 },
  rolePanel: { borderRadius: 24, marginTop: 18, padding: 20, shadowColor: '#183B31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
  roleEyebrow: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.3, opacity: 0.8 },
  roleTitle: { fontFamily: 'Inter_700Bold', fontSize: 26, letterSpacing: -0.8, lineHeight: 32, marginTop: 8 },
  roleDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 6, opacity: 0.88 },
  roleSwitch: { borderRadius: 16, flexDirection: 'row', gap: 6, marginTop: 18, padding: 5 },
  roleOption: { alignItems: 'center', borderRadius: 12, flex: 1, minHeight: 40, justifyContent: 'center' },
  roleOptionText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  identityCard: { alignItems: 'center', borderRadius: 22, borderWidth: 1, borderTopColor: '#2A5240', flexDirection: 'row', gap: 14, padding: 18 },
  identityAvatar: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  identityCopy: { flex: 1 },
  identityName: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.35 },
  identityCaption: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 4 },
  menuRow: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 14, minHeight: 54 },
  menuLabel: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  menuValue: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  settingHint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginBottom: 12 },
  tutorPicker: { gap: 10, paddingBottom: 6 },
  tutorOption: { alignItems: 'center', borderRadius: 18, borderWidth: 1, gap: 7, padding: 10, width: 110 },
  tutorOptionName: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  tutorOptionSubject: { fontFamily: 'Inter_400Regular', fontSize: 10, textAlign: 'center' },
  feeCard: { alignItems: 'center', borderRadius: 22, flexDirection: 'row', gap: 14, marginTop: 18, padding: 16 },
  feeIcon: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  feeCopy: { flex: 1 },
  feeTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  feeDetail: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17, marginTop: 4 },
  aboutCard: { borderRadius: 22, borderWidth: 1, borderTopColor: '#2A5240', padding: 18 },
  aboutTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, letterSpacing: -0.4 },
  aboutText: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 8 },
  aboutDivider: { height: 1, marginVertical: 14 },
  aboutFoot: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  aboutFootText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16 },
  footerNote: { fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 24, textAlign: 'center' },
  applicationCard: { borderRadius: 22, gap: 11, marginTop: 18, padding: 18 },
  applicationIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  applicationTitle: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  applicationCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
  switchPreview: { alignSelf: 'center', paddingVertical: 10 },
  switchPreviewText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  applicationSummary: { borderRadius: 20, gap: 12, marginTop: 16, padding: 16 },
  applicationSummaryTop: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  applicationCopyBlock: { flex: 1, gap: 5 },
  applicationDisclaimer: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16 },
});
