import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthButton, AuthField, AuthLink, AuthMessage, AuthShell } from '@/components/AuthUI';
import { useAuth } from '@/context/AuthContext';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError('');
    if (!token) { setError('This reset link is missing or expired. Request a new one to continue.'); return; }
    if (password !== confirmPassword) { setError('Those passwords don’t match yet.'); return; }
    setLoading(true);
    try { await resetPassword(token, password); router.replace('/(auth)/sign-in'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'That reset link may have expired.'); }
    finally { setLoading(false); }
  };

  return (
    <AuthShell eyebrow="A secure new start" title="Choose a new password." description="Use at least 10 characters. Resetting your password signs out your other devices.">
      {error ? <AuthMessage>{error}</AuthMessage> : null}
      <AuthField label="New password" value={password} onChangeText={setPassword} placeholder="At least 10 characters" secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      <AuthField label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Enter it once more" secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      <AuthButton label="Update password" onPress={() => void submit()} loading={loading} disabled={password.length < 10 || !confirmPassword} />
      <AuthLink onPress={() => router.replace('/(auth)/sign-in')}>Back to sign in</AuthLink>
    </AuthShell>
  );
}
