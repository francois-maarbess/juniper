import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthButton, AuthLink, AuthMessage, AuthShell } from '@/components/AuthUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { Text, View } from 'react-native';

export default function VerifyEmailScreen() {
  const colors = useColors();
  const router = useRouter();
  const { token, email } = useLocalSearchParams<{ token?: string; email?: string }>();
  const { verifyEmail, resendVerification, user } = useAuth();
  const tutorSignup = user?.signupRole === 'tutor';
  const [status, setStatus] = useState<'checking' | 'waiting' | 'success' | 'error'>(token ? 'checking' : 'waiting');
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);

  const resend = async () => {
    if (!email) return;
    setResending(true); setError(''); setResendMessage('');
    try { setResendMessage(await resendVerification(email)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'We couldn’t send a fresh link.'); }
    finally { setResending(false); }
  };

  useEffect(() => {
    if (!token) return;
    let active = true;
    void verifyEmail(token).then(() => {
      if (active) setStatus('success');
    }).catch((caught: unknown) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : 'That link may have expired.');
      setStatus('error');
    });
    return () => { active = false; };
  }, [token, verifyEmail]);

  return (
    <AuthShell eyebrow="Almost there" title={status === 'success' ? 'You’re all set.' : 'Check your inbox.'} description={status === 'success' ? 'Your email is verified, and your Juniper account is ready.' : `We sent a verification link${email ? ` to ${email}` : ''}. Open it on this device to finish setting up your account.`}>
      {status === 'checking' ? <AuthMessage kind="success">We’re confirming your email securely…</AuthMessage> : null}
      {status === 'error' ? <AuthMessage>{error}</AuthMessage> : null}
      {resendMessage ? <AuthMessage kind="success">{resendMessage}</AuthMessage> : null}
      {status === 'waiting' ? (
        <View style={{ alignItems: 'center', paddingVertical: 12, gap: 10 }}>
          <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="mail-open-outline" size={25} color={colors.primary} />
          </View>
          <Text style={{ textAlign: 'center', color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 }}>
            The link expires after 24 hours. If it’s not there, take a look in your spam folder.
          </Text>
        </View>
      ) : null}
      {status === 'success' ? <AuthButton label={tutorSignup ? 'Continue your tutor application' : 'Go to Juniper'} onPress={() => router.replace(tutorSignup ? '/become-tutor' : '/(tabs)')} /> : null}
      {status === 'error' ? <AuthButton label="Back to sign in" variant="secondary" onPress={() => router.replace('/(auth)/sign-in')} /> : null}
      {status === 'waiting' ? <AuthLink onPress={() => router.replace('/(auth)/sign-in')}>Back to sign in</AuthLink> : null}
      {status !== 'success' && email ? <AuthButton label="Send a fresh verification link" variant="secondary" onPress={() => void resend()} loading={resending} /> : null}
    </AuthShell>
  );
}
