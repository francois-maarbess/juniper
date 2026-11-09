import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AuthButton, AuthField, AuthLink, AuthMessage, AuthShell } from '@/components/AuthUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colors = useColors();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true); setMessage(''); setError('');
    try { setMessage(await requestPasswordReset(email)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'We couldn’t send that request just now. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell
      eyebrow="PASSWORD RESET"
      title={message ? 'Check your inbox' : 'Let’s get you back in.'}
      description={message ? 'We’ve received your request.' : 'Enter the email address you use for Juniper and we’ll help you get back in.'}
    >
      {error ? <AuthMessage>{error}</AuthMessage> : null}
      {message ? (
        <>
          <View style={[styles.confirmation, { backgroundColor: colors.leaf, borderColor: colors.border }]}>
            <View style={[styles.confirmationIcon, { backgroundColor: colors.card }]}>
              <Ionicons name="mail-open-outline" size={21} color={colors.primary} />
            </View>
            <View style={styles.confirmationCopy}>
              <Text style={[styles.confirmationTitle, { color: colors.foreground }]}>Reset request received</Text>
              <Text style={[styles.confirmationDescription, { color: colors.mutedForeground }]}>{message}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.nextStepsTitle, { color: colors.foreground }]}>If you don’t see an email</Text>
            <NextStep icon="folder-open-outline" text="Check your spam or junk folder." />
            <NextStep icon="at-outline" text="Make sure this is the address you used to join Juniper." />
          </View>
          <AuthLink onPress={() => { setMessage(''); setError(''); }}>Use a different email</AuthLink>
          <AuthLink onPress={() => router.push('/(auth)/sign-up')}>New to Juniper? Create an account</AuthLink>
        </>
      ) : (
        <>
          <AuthField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <AuthButton label="Send reset link" onPress={() => void submit()} loading={loading} disabled={!email} />
        </>
      )}
      <AuthLink onPress={() => router.replace('/(auth)/sign-in')}>Back to sign in</AuthLink>
    </AuthShell>
  );
}

function NextStep({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const colors = useColors();
  return (
    <View style={styles.nextStep}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={[styles.nextStepText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmation: { borderWidth: 1, borderRadius: 18, gap: 12, padding: 16 },
  confirmationIcon: { alignItems: 'center', borderRadius: 14, height: 42, justifyContent: 'center', width: 42 },
  confirmationCopy: { gap: 5 },
  confirmationTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, lineHeight: 21 },
  confirmationDescription: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  divider: { height: 1, marginVertical: 1 },
  nextStepsTitle: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  nextStep: { alignItems: 'flex-start', flexDirection: 'row', gap: 9 },
  nextStepText: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
});
