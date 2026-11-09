import { useRouter } from 'expo-router';
import { AuthButton, AuthLink, AuthShell } from '@/components/AuthUI';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <AuthShell
      eyebrow="LEARN WITH JUNIPER"
      title="Whatever the subject, start here."
      description="High school, university, languages, exam prep. Start with what’s on your mind."
    >
      <AuthButton label="Create your account" onPress={() => router.push('/(auth)/sign-up')} testID="auth-create-account" />
      <AuthButton label="Sign In to Your Account" variant="secondary" onPress={() => router.push('/(auth)/sign-in')} testID="auth-sign-in" />
      <AuthLink onPress={() => router.replace('/(tabs)/find')}>Explore tutors first</AuthLink>
    </AuthShell>
  );
}
