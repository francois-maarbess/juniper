import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthButton, AuthField, AuthLink, AuthMessage, AuthShell } from '@/components/AuthUI';
import { useAuth } from '@/context/AuthContext';

export default function SignInScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setError('');
    try {
      const account = await signIn(email, password);
      if (account.signupRole === 'tutor' && account.activeRole !== 'tutor') {
        router.replace('/become-tutor');
        return;
      }
      const target = next?.startsWith('/') && !next.startsWith('/(auth)') ? next : '/(tabs)';
      router.replace(target as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We couldn’t sign you in. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <AuthShell
      eyebrow="ACADEMIC HELP PLATFORM"
      title="Welcome back to Juniper."
      description="Find tutoring requests, compare offers, message tutors, and keep your sessions in one place."
    >
      {error ? <AuthMessage>{error}</AuthMessage> : null}
      <AuthField label="Email address" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="sign-in-email" />
      <AuthField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry autoCapitalize="none" autoComplete="password" testID="sign-in-password" />
      <AuthLink onPress={() => router.push('/(auth)/forgot-password')}>Forgot your password?</AuthLink>
      <AuthButton label="Sign In to Account" onPress={() => void submit()} loading={loading} disabled={!email || !password} testID="sign-in-submit" />
      <AuthLink onPress={() => router.push('/(auth)/sign-up')}>New to Juniper? Create an account</AuthLink>
    </AuthShell>
  );
}
