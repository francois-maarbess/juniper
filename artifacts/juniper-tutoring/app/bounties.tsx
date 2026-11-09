import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, EmptyState, PageHeader, Screen, SectionHeading } from '@/components/JuniperUI';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { HapticPressable } from '@/components/HapticPressable';
import { hapticMedium } from '@/lib/haptics';

type Bounty = {
  id: string;
  learnerId: string;
  courseTag: string;
  description: string;
  imageUrl: string | null;
  bountyAmountCents: number;
  status: string;
  createdAt: string;
  learnerName?: string;
};

export default function BountiesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, request, upload } = useAuth();
  const [mode, setMode] = useState<'radar' | 'post'>('radar');
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Post form
  const [courseTag, setCourseTag] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('3');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const [claimingId, setClaimingId] = useState<string | null>(null);

  const loadBounties = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await request<Bounty[]>('/marketplace/bounties');
      setBounties(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load bounties.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadBounties();
  }, [loadBounties]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const postBounty = async () => {
    const cents = Math.round(Number(amount) * 100);
    if (!courseTag.trim() || !description.trim()) {
      setError('Course tag and description are required.');
      return;
    }
    if (!Number.isFinite(cents) || cents < 200 || cents > 500) {
      setError('Bounty must be between $2 and $5.');
      return;
    }
    setPosting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('courseTag', courseTag.trim());
      form.append('description', description.trim());
      form.append('bountyAmountCents', String(cents));
      if (imageUri) {
        if (Platform.OS === 'web') {
          const res = await fetch(imageUri);
          const blob = await res.blob();
          form.append('image', blob, 'problem.jpg');
        } else {
          form.append('image', { uri: imageUri, name: 'problem.jpg', type: 'image/jpeg' } as any);
        }
      }
      await upload('/marketplace/bounties', form);
      setCourseTag('');
      setDescription('');
      setImageUri(null);
      setMode('radar');
      await loadBounties();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post bounty.');
    } finally {
      setPosting(false);
    }
  };

  const claimBounty = async (id: string) => {
    setClaimingId(id);
    setError('');
    try {
      await request(`/marketplace/bounties/${id}/claim`, { method: 'POST' });
      hapticMedium();
      await loadBounties();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not claim bounty.');
    } finally {
      setClaimingId(null);
    }
  };

  if (!user) {
    return (
      <Screen>
        <PageHeader title="Micro-Bounties" onBack={() => router.back()} />
        <EmptyState
          icon="cash-outline"
          title="Sign in to use bounties"
          description="Post a hard problem or solve one for a quick $2–$5."
          action="Sign in"
          onAction={() => router.push('/(auth)/welcome')}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <PageHeader title="Micro-Bounty Board" onBack={() => router.back()} />
      <View style={styles.tabs}>
        <HapticPressable
          onPress={() => setMode('radar')}
          style={[styles.tab, mode === 'radar' && { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.tabText, { color: mode === 'radar' ? colors.primaryForeground : colors.foreground }]}>Bounty Radar</Text>
        </HapticPressable>
        <HapticPressable
          onPress={() => setMode('post')}
          style={[styles.tab, mode === 'post' && { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.tabText, { color: mode === 'post' ? colors.primaryForeground : colors.foreground }]}>Post a Bounty</Text>
        </HapticPressable>
      </View>

      {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

      {mode === 'radar' ? (
        <ScrollView contentContainerStyle={styles.list}>
          {loading ? <Text style={{ color: colors.mutedForeground }}>Loading bounties…</Text> : null}
          {!loading && bounties.length === 0 ? (
            <EmptyState icon="cash-outline" title="No open bounties" description="Be the first to post a hard problem." />
          ) : null}
          {bounties.map((b) => (
            <View key={b.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={[styles.tag, { backgroundColor: colors.leaf }]}>
                  <Text style={[styles.tagText, { color: colors.primary }]}>{b.courseTag}</Text>
                </View>
                <Text style={[styles.amount, { color: colors.primary }]}>${(b.bountyAmountCents / 100).toFixed(2)}</Text>
              </View>
              <Text style={[styles.desc, { color: colors.foreground }]}>{b.description}</Text>
              {b.imageUrl ? (
                <Image source={{ uri: b.imageUrl.startsWith('http') ? b.imageUrl : `http://localhost:3001${b.imageUrl}` }} style={styles.image} />
              ) : null}
              {b.status === 'open' && user?.activeRole === 'tutor' ? (
                <ActionButton
                  label={claimingId === b.id ? 'Claiming…' : 'Claim bounty'}
                  variant="secondary"
                  onPress={() => void claimBounty(b.id)}
                  disabled={claimingId === b.id}
                />
              ) : (
                <Text style={[styles.status, { color: colors.mutedForeground }]}>{b.status}</Text>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={[styles.label, { color: colors.foreground }]}>Course tag</Text>
          <TextInput
            value={courseTag}
            onChangeText={setCourseTag}
            placeholder="e.g. AUB MATH201"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Describe the problem</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What are you stuck on?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.input, styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          />
          <Text style={[styles.label, { color: colors.foreground }]}>Bounty amount ($2–$5)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          />
          <HapticPressable onPress={pickImage} style={[styles.imagePicker, { borderColor: colors.border }]}>
            <Ionicons name="image-outline" size={20} color={colors.primary} />
            <Text style={[styles.imagePickerText, { color: colors.primary }]}>
              {imageUri ? 'Change photo' : 'Attach problem photo'}
            </Text>
          </HapticPressable>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.preview} /> : null}
          <ActionButton
            label={posting ? 'Posting…' : 'Post bounty'}
            onPress={() => void postBounty()}
            disabled={posting}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { borderRadius: 12, flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabText: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  list: { gap: 12, paddingBottom: 24 },
  card: { borderRadius: 18, borderWidth: 1, gap: 8, padding: 14 },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  tag: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  amount: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  desc: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 18 },
  image: { borderRadius: 12, height: 160, width: '100%' },
  status: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 8 },
  input: { borderRadius: 12, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  imagePicker: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 10, paddingVertical: 12 },
  imagePickerText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  preview: { borderRadius: 12, height: 160, marginTop: 10, width: '100%' },
  error: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 8 },
});