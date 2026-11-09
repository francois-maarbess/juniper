import { useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AuthButton, AuthField, AuthLink, AuthMessage, AuthShell } from '@/components/AuthUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type SignupRole = 'student' | 'tutor';

export default function SignUpScreen() {
  const router = useRouter();
  const colors = useColors();
  const { signUp } = useAuth();
  const [role, setRole] = useState<SignupRole | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!role) { setError('Choose how you’d like to use Juniper.'); return; }
    if (password !== confirmPassword) { setError('Those passwords don’t match yet.'); return; }
    setLoading(true); setError('');
    try {
      await signUp({ firstName, lastName, email, password, role });
      router.replace({ pathname: '/(auth)/verify-email', params: { email, role } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We couldn’t create your account. Try again.');
    } finally { setLoading(false); }
  };

  const title = role === 'tutor'
    ? 'Bring your expertise to Juniper.'
    : role === 'student'
    ? 'Meet the tutor who gets it.'
    : 'Here to learn or teach?';
  const description = role === 'tutor'
    ? 'Set your subjects and availability. Your profile goes live after a qualification review.'
    : role === 'student'
      ? 'School, university, languages, or exam prep. Start with the thing you want to understand.'
      : 'Choose your side. You can add more details as you go.';

  return (
    <AuthShell eyebrow="JOIN JUNIPER" title={title} description={description}>
      {error ? <AuthMessage>{error}</AuthMessage> : null}
      <View style={styles.roleChoices} accessibilityRole="radiogroup" accessibilityLabel="Choose your Juniper role">
        <RoleChoice
          selected={role === 'student'}
          icon="school-outline"
          title="I’m here to learn"
          description="Find a tutor who meets you where you are."
          onPress={() => { setRole('student'); setError(''); }}
        />
        <RoleChoice
          selected={role === 'tutor'}
          icon="leaf-outline"
          title="I’d like to teach"
          description="Share your expertise after a private review."
          onPress={() => { setRole('tutor'); setError(''); }}
        />
      </View>
      {role ? (
        <>
          <View style={[styles.stepNote, { backgroundColor: colors.pale }]}>
            <Ionicons name={role === 'tutor' ? 'shield-checkmark-outline' : 'sparkles-outline'} size={16} color={colors.primary} />
            <Text style={[styles.stepNoteText, { color: colors.mutedForeground }]}>
              {role === 'tutor' ? 'First, create your account. Then you can complete your tutor application at your own pace.' : 'You can add your learning details whenever you’re ready.'}
            </Text>
          </View>
          <AuthField label="First name" value={firstName} onChangeText={setFirstName} placeholder="Your first name" autoComplete="given-name" testID="sign-up-first-name" />
          <AuthField label="Last name · optional" value={lastName} onChangeText={setLastName} placeholder="Your last name" autoComplete="family-name" />
          <AuthField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="sign-up-email" />
          <AuthField label="Password" value={password} onChangeText={setPassword} placeholder="At least 10 characters" secureTextEntry autoCapitalize="none" autoComplete="new-password" testID="sign-up-password" />
          <AuthField label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter it once more" secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          <AuthButton label={role === 'tutor' ? 'Create tutor account' : 'Create learner account'} onPress={() => void submit()} loading={loading} disabled={!firstName || !email || password.length < 10 || !confirmPassword} testID="sign-up-submit" />
          <AuthLink onPress={() => router.push('/(auth)/sign-in')}>Already have an account? Sign in</AuthLink>
        </>
      ) : (
        <AuthLink onPress={() => router.push('/(auth)/sign-in')}>Already have an account? Sign in</AuthLink>
      )}
    </AuthShell>
  );
}

function RoleChoice({
  selected, icon, title, description, onPress,
}: {
  selected: boolean; icon: React.ComponentProps<typeof Ionicons>['name']; title: string; description: string; onPress: () => void;
}) {
  const colors = useColors();
  return (
    <HapticPressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleChoice,
        {
          backgroundColor: selected ? colors.leaf : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.78 : 1,
        },
      ]}
    >
      <View style={[styles.roleIcon, { backgroundColor: selected ? colors.card : colors.pale }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.roleCopy}>
        <Text style={[styles.roleTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.roleDescription, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
      <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.border }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
      </View>
    </HapticPressable>
  );
}

const styles = StyleSheet.create({
  roleChoices: { gap: 9 },
  roleChoice: { alignItems: 'center', borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 72, paddingHorizontal: 12, paddingVertical: 11 },
  roleIcon: { alignItems: 'center', borderRadius: 12, height: 38, justifyContent: 'center', width: 38 },
  roleCopy: { flex: 1, gap: 3 },
  roleTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  roleDescription: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  radio: { alignItems: 'center', borderRadius: 10, borderWidth: 1.5, height: 19, justifyContent: 'center', width: 19 },
  radioDot: { borderRadius: 5, height: 9, width: 9 },
  stepNote: { alignItems: 'flex-start', borderRadius: 14, flexDirection: 'row', gap: 9, paddingHorizontal: 11, paddingVertical: 10 },
  stepNoteText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
});
