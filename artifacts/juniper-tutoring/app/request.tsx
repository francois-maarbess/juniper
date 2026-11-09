import React, { useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ActionButton, EmptyState, PageHeader, Screen, Pill } from '@/components/JuniperUI';
import { SUBJECTS, getLearningPathForSubject, subjectsForLearningPath, type LearningPathId } from '@/constants/juniper-data';
import { LearningPathPicker } from '@/components/LearningPathPicker';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/context/AuthContext';
import { hapticMedium, hapticSuccess } from '@/lib/haptics';
import { HELP_TYPES, type HelpTypeId } from '@/components/HelpTypeGrid';

const URGENT_DEADLINES = [
  { id: 'Today', label: 'Today', icon: 'sunny-outline' as const, hours: 12 },
  { id: 'Tomorrow', label: 'Tomorrow', icon: 'flash-outline' as const, hours: 36 },
  { id: 'This week', label: 'This week', icon: 'calendar-outline' as const, hours: 7 * 24 },
  { id: 'Flexible', label: 'Flexible', icon: 'time-outline' as const, hours: 30 * 24 },
];

const BUDGET_PRESETS = [15, 25, 40, 60];
const LEARNER_LEVELS = ['High school', 'University', 'Adult learning'];

export default function CreateRequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ tutorId?: string; tutorName?: string; subject?: string; learningPath?: string; helpType?: string; draftTitle?: string; draftDetails?: string; requestedTime?: string }>();
  const { request, upload, user } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [aiAssisting, setAiAssisting] = useState(false);
  const initialPath = params.learningPath as LearningPathId | undefined;
  const initialHelpType = HELP_TYPES.find((item) => item.id === params.helpType)?.id
    ?? (initialPath === 'languages' ? 'language' : initialPath === 'exams' ? 'exam_prep' : 'tutoring');
  const [helpType, setHelpType] = useState<HelpTypeId>(initialHelpType);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [learningPath, setLearningPath] = useState<LearningPathId>(initialPath ?? (params.subject ? getLearningPathForSubject(params.subject) : 'university'));
  const [subject, setSubject] = useState(params.subject || '');
  const [customSubject, setCustomSubject] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [showAllSubjects, setShowAllSubjects] = useState(false);
  const [title, setTitle] = useState(params.draftTitle ?? '');
  const [details, setDetails] = useState(params.draftDetails ?? '');
  const [deadline, setDeadline] = useState('Tomorrow');
  const requestedTime = params.requestedTime?.trim() ?? '';
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [learnerLevel, setLearnerLevel] = useState('University');
  const [institution, setInstitution] = useState('');
  const [courseName, setCourseName] = useState('');
  const [instructionLanguage, setInstructionLanguage] = useState('');
  const [budget, setBudget] = useState(35);
  const [customBudget, setCustomBudget] = useState('35');
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);
  const [uploadedFileUris, setUploadedFileUris] = useState<string[]>([]);
  const pathSubjects = subjectsForLearningPath(learningPath, SUBJECTS);
  const matchingSubjects = pathSubjects.filter((item) => item.name.toLowerCase().includes(subjectSearch.trim().toLowerCase()));
  const visibleSubjects = subjectSearch.trim() || showAllSubjects ? matchingSubjects : matchingSubjects.slice(0, 6);
  const invalidBudget = !Number.isFinite(Number(customBudget)) || Number(customBudget) < 5 || Number(customBudget) > 20000;

  const handleAiAssist = async () => {
    const promptText = (details || title || subject).trim();
    if (!promptText || promptText.length < 3) {
      setError('Add a few words about the topic you want help with.');
      return;
    }
    setAiAssisting(true);
    setError('');
    try {
      const result = await request<{
        title: string; details: string; serviceType: 'assignment_project' | 'exam_prep' | 'live_session';
      }>('/marketplace/requests/assist', {
        method: 'POST',
        body: { prompt: promptText, subjectName: subject },
      });
      if (result.title) setTitle(result.title);
      if (result.details) setDetails(result.details);
      hapticMedium();
    } catch {
      setError('AI assistant is temporarily busy. You can write your description directly.');
    } finally {
      setAiAssisting(false);
    }
  };

  const pickMaterials = async () => {
    if (createdRequestId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        multiple: true,
        copyToCacheDirectory: true,
        base64: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const available = 5 - selectedFiles.length;
      if (available <= 0 || result.assets.length > available) {
        setError(`You can attach up to five files. ${Math.max(0, available)} slot${available === 1 ? '' : 's'} remain.`);
        return;
      }
      if (result.assets.some((asset) => (asset.size ?? 0) > 10 * 1024 * 1024)) {
        setError('Each file needs to be smaller than 10 MB.');
        return;
      }
      setSelectedFiles((current) => [
        ...current,
        ...result.assets!.filter((asset) => !current.some((item) => item.uri === asset.uri)).slice(0, available),
      ]);
      setError('');
      hapticMedium();
    } catch {
      setError('Your files could not be opened. Please choose them again.');
    }
  };

  const removeFile = (uri: string) => {
    setSelectedFiles((current) => current.filter((file) => file.uri !== uri));
    hapticMedium();
  };

  const submit = async () => {
    if (!createdRequestId && invalidBudget) {
      setError('Choose a session budget between $5 and $20,000.');
      return;
    }
    if (!createdRequestId && title.trim().length < 5) {
      setError('Add a short title for the topic you want to learn.');
      return;
    }
    if (!createdRequestId && !subject && !customSubject.trim()) {
      setError('Choose a subject or enter the topic you want help with.');
      return;
    }
    const finalDetails = details.trim() || title.trim();

    let savedRequestId = createdRequestId;
    try {
      setSubmitting(true);
      setError('');

      if (!savedRequestId) {
        const subjects = await request<Array<{ id: string; name: string }>>('/marketplace/subjects');
        const requestedSubject = customSubject.trim() ? 'Other subject' : subject;
        const subjectId = subjects.find((item) => item.name === requestedSubject)?.id;
        if (!subjectId) {
          setError('The subject catalogue is temporarily unavailable. Try again in a moment.');
          setSubmitting(false);
          return;
        }

        const selectedDl = URGENT_DEADLINES.find((d) => d.id === deadline) || URGENT_DEADLINES[1];
        const deadlineAt = new Date(Date.now() + selectedDl.hours * 60 * 60 * 1000);

        const saved = await request<{ id: string }>('/marketplace/requests', {
          body: {
            subjectId,
            ...(customSubject.trim() ? { customSubject: customSubject.trim() } : {}),
            ...(courseName.trim() ? { customCourse: courseName.trim() } : {}),
            ...(institution.trim() ? { university: institution.trim() } : {}),
            ...(instructionLanguage.trim() ? { instructionLanguage: instructionLanguage.trim() } : {}),
            title: title.trim(),
            details: finalDetails,
            serviceType: HELP_TYPES.find((item) => item.id === helpType)?.serviceType ?? 'live_session',
            helpType,
            level: learnerLevel,
            deadline: deadlineAt.toISOString(),
            budgetCents: budget * 100,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            preferredTimes: [...(requestedTime ? [`Requested time: ${requestedTime}`] : []), ...preferredTimes],
            sessionDurationMinutes: 60,
            ...(params.tutorId ? { targetTutorId: params.tutorId } : {}),
          },
        });
        savedRequestId = saved.id;
        setCreatedRequestId(saved.id);
      }

      for (const asset of selectedFiles) {
        if (uploadedFileUris.includes(asset.uri)) continue;
        const form = new FormData();
        if (Platform.OS === 'web' && asset.file) {
          form.append('file', asset.file, asset.name);
        } else {
          form.append('file', {
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType ?? 'application/octet-stream',
          } as unknown as Blob);
        }
        await upload(`/marketplace/requests/${savedRequestId}/attachments`, form);
        setUploadedFileUris((current) => [...current, asset.uri]);
      }

      hapticSuccess();
      setBroadcasting(true);

      router.replace(`/requests/${savedRequestId}`);
    } catch (caught) {
      setError(
        savedRequestId
          ? `Your request was created, but a file could not be uploaded: ${caught instanceof Error ? caught.message : 'error'}`
          : caught instanceof Error
          ? caught.message
          : 'Your request could not be sent. Check your connection and try again.'
      );
      setSubmitting(false);
    }
  };

  const continueWizard = () => {
    setError('');
    if (wizardStep === 1) {
      if (!subject && !customSubject.trim()) { setError('Choose a subject or enter the topic you want help with.'); return; }
      if (title.trim().length < 5) { setError('Add a short title with at least five characters.'); return; }
      if ((details.trim() || title.trim()).length < 10) { setError('Add a little more detail about what you want the tutor to explain.'); return; }
    }
    setWizardStep((step) => (step < 3 ? (step + 1) as 1 | 2 | 3 : step));
  };

  if (!user) {
    return (
      <Screen>
        <PageHeader title={params.tutorName ? `Request a session with ${params.tutorName}` : 'Tell tutors what you need'} eyebrow="Request tutoring" onBack={() => router.back()} />
        <EmptyState
          icon="chatbubbles-outline"
          title="Sign in to contact tutors"
          description="Create a Juniper account to send your learning request, compare tutor offers, and keep your conversations and sessions together."
          action="Sign in or create account"
          onAction={() => router.push('/(auth)/welcome')}
        />
      </Screen>
    );
  }

  if (broadcasting) {
    return (
      <Screen scroll={false} contentStyle={styles.broadcastingCenter}>
        <View style={[styles.broadcastingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.broadcastingRadar, { backgroundColor: colors.leaf }]}>
            <Ionicons name="radio" size={44} color={colors.primary} />
          </View>
          <Text style={[styles.broadcastingTitle, { color: colors.foreground }]}>
            Your request is ready
          </Text>
          <Text style={[styles.broadcastingSub, { color: colors.mutedForeground }]}>
            Eligible tutors can review your <Text style={{ fontFamily: 'Inter_700Bold', color: colors.primary }}>{subject}</Text> request. Replies will appear in your activity.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
      <KeyboardAwareScrollViewCompat
        style={styles.formScroll}
        contentContainerStyle={[
          styles.formContent,
          {
            paddingTop: insets.top + (insets.top < 12 ? 67 : 8),
            paddingBottom: Math.max(insets.bottom, 18) + 26,
          },
        ]}
        bottomOffset={74}
        keyboardShouldPersistTaps="handled"
      >
        <PageHeader
          title={params.tutorName ? `Request a session with ${params.tutorName}` : 'Tell tutors what you need'}
          eyebrow={params.tutorName ? 'Contact a tutor' : 'Request tutoring'}
          onBack={() => router.back()}
        />

        <View style={{ gap: 8, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.stepLabel, { color: colors.primary }]}>STEP {wizardStep} OF 3</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11 }}>{['Your topic', 'Session details', 'Review request'][wizardStep - 1]}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3].map((step) => <View key={step} style={{ backgroundColor: step <= wizardStep ? colors.primary : colors.border, borderRadius: 99, flex: 1, height: 4 }} />)}
          </View>
          <View style={{ alignSelf: 'flex-start', backgroundColor: colors.leaf, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 11 }}>{HELP_TYPES.find((item) => item.id === helpType)?.title ?? 'Online tutoring'}</Text>
          </View>
        </View>

        {/* 1. SUBJECT & TOPIC */}
        <View style={[styles.sectionBlock, wizardStep !== 1 && styles.hiddenStep]}>
          <Text style={[styles.stepLabel, { color: colors.primary }]}>STEP 1 · YOUR LEARNING AREA</Text>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>What kind of help do you need?</Text>
          <View style={styles.subjectChoices}>
            {HELP_TYPES.map((item) => <Pill key={item.id} label={item.title} selected={helpType === item.id} onPress={() => {
              setHelpType(item.id);
              if (item.learningPath && item.learningPath !== learningPath) {
                setLearningPath(item.learningPath as LearningPathId);
                setSubject('');
                setCustomSubject('');
                setSubjectSearch('');
              }
            }} />)}
          </View>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Where does your learning fit?</Text>
          <Text style={[styles.subLabel, { color: colors.mutedForeground, marginBottom: 10 }]}>Choose a path so tutors see the right context. You can still enter any course or topic.</Text>
          <LearningPathPicker
            selected={learningPath}
            onChange={(path) => {
              setLearningPath(path);
              setSubject('');
              setCustomSubject('');
              setSubjectSearch('');
              setShowAllSubjects(false);
              if (path === 'school') setLearnerLevel('High school');
              else if (path === 'university') setLearnerLevel('University');
              else if (path === 'professional') setLearnerLevel('Adult learning');
            }}
          />
          <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>Choose a subject, language, or skill</Text>
          <TextInput
            value={subjectSearch}
            onChangeText={setSubjectSearch}
            placeholder={learningPath === 'languages' ? 'Search languages' : 'Search subjects and topics'}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            accessibilityLabel="Search subjects"
            returnKeyType="search"
          />
          <View style={styles.subjectChoices}>
            {visibleSubjects.map((item) => (
              <Pill
                key={item.name}
                label={item.name}
                selected={subject === item.name}
                onPress={() => { setSubject(item.name); setCustomSubject(''); }}
              />
            ))}
          </View>
          {subjectSearch.trim() && matchingSubjects.length === 0 ? <HapticPressable accessibilityRole="button" onPress={() => { setCustomSubject(subjectSearch.trim()); setSubject('Other subject'); }} style={[styles.customSubjectChoice, { borderColor: colors.primary, backgroundColor: colors.leaf }]}><Ionicons name="add-circle-outline" size={18} color={colors.primary} /><Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 13 }}>Request help with “{subjectSearch.trim()}”</Text></HapticPressable> : null}
          {customSubject ? <View style={[styles.customSubjectChoice, { borderColor: colors.border, backgroundColor: colors.card }]}><Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Subject: {customSubject}</Text><HapticPressable accessibilityRole="button" accessibilityLabel="Clear custom subject" onPress={() => setCustomSubject('')}><Ionicons name="close-circle-outline" size={18} color={colors.mutedForeground} /></HapticPressable></View> : null}
          {learningPath === 'university' ? <>
            <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 16 }]}>University or college <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>· optional</Text></Text>
            <TextInput value={institution} onChangeText={setInstitution} maxLength={160} placeholder="Type any university or college" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} accessibilityLabel="University or college, optional" />
          </> : null}
          {learningPath === 'university' || learningPath === 'school' ? <>
            <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 12 }]}>{learningPath === 'school' ? 'Topic or curriculum' : 'Course name or code'} <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>· optional</Text></Text>
            <TextInput value={courseName} onChangeText={setCourseName} maxLength={160} placeholder={learningPath === 'school' ? 'For example, algebra or IB Biology' : 'Type a course title or code'} placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} accessibilityLabel="Course name or topic, optional" />
          </> : null}
          <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 12 }]}>Language for tutoring <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular' }}>· optional</Text></Text>
          <TextInput value={instructionLanguage} onChangeText={setInstructionLanguage} maxLength={80} placeholder="For example, English, Arabic, or French" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} accessibilityLabel="Language for tutoring, optional" />
          {!subjectSearch.trim() && matchingSubjects.length > 6 ? (
            <HapticPressable accessibilityRole="button" onPress={() => setShowAllSubjects((shown) => !shown)} style={{ minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' }}>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 13 }}>{showAllSubjects ? 'Show fewer subjects' : `See all ${matchingSubjects.length} subjects`}</Text>
            </HapticPressable>
          ) : null}

          <View style={styles.labelWithAction}>
            <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>Give your request a short title</Text>
            <HapticPressable
              accessibilityRole="button"
              onPress={() => void handleAiAssist()}
              style={({ pressed }) => [
                styles.aiBtn,
                { backgroundColor: colors.leaf, borderColor: colors.primary, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="sparkles" size={13} color={colors.primary} />
              <Text style={[styles.aiBtnText, { color: colors.primary }]}>
                {aiAssisting ? 'Working…' : 'Help me describe it'}
              </Text>
            </HapticPressable>
          </View>
          <TextInput
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            placeholder="e.g. I want to understand integration by parts"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            returnKeyType="next"
            testID="request-title"
          />

          <TextInput
            value={details}
            onChangeText={setDetails}
            maxLength={5000}
            multiline
            placeholder="What have you tried? What would you like the tutor to explain?"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
            textAlignVertical="top"
            testID="request-details"
          />
        </View>

        <View style={[styles.sectionBlock, wizardStep !== 2 && styles.hiddenStep]}>
          <Text style={[styles.stepLabel, { color: colors.primary }]}>SESSION DETAILS</Text>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Who is this session for?</Text>
          <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>Choose a level so tutors can tailor the session.</Text>
          <View style={styles.subjectChoices}>
            {LEARNER_LEVELS.map((level) => (
              <Pill key={level} label={level} selected={learnerLevel === level} onPress={() => setLearnerLevel(level)} />
            ))}
          </View>
        </View>

        {/* Optional learning materials */}
        <View style={[styles.sectionBlock, wizardStep !== 2 && styles.hiddenStep]}>
          <Text style={[styles.stepLabel, { color: colors.primary }]}>OPTIONAL · LEARNING MATERIALS</Text>
          <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>
            Share a relevant page or image if it helps explain what you’re learning. Only share material you’re allowed to share.
          </Text>

          <HapticPressable
            accessibilityRole="button"
            onPress={() => void pickMaterials()}
            style={[styles.dropzone, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.dropIcon, { backgroundColor: colors.leaf }]}>
              <Ionicons name="cloud-upload-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.dropTitle, { color: colors.foreground }]}>Add a study page or image</Text>
            <Text style={[styles.dropSub, { color: colors.mutedForeground }]}>PDF, PNG, JPG (up to 10MB each)</Text>
          </HapticPressable>

          {selectedFiles.length > 0 && (
            <View style={styles.filesList}>
              {selectedFiles.map((file) => (
                <View key={file.uri} style={[styles.fileChip, { backgroundColor: colors.leaf, borderColor: colors.primary }]}>
                  <Ionicons name="document-text" size={16} color={colors.primary} />
                  <Text numberOfLines={1} style={[styles.fileName, { color: colors.foreground }]}>
                    {file.name}
                  </Text>
                  <HapticPressable onPress={() => removeFile(file.uri)} style={styles.removeFileBtn}>
                    <Ionicons name="close-circle" size={18} color={colors.destructive} />
                  </HapticPressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Session timing */}
        <View style={[styles.sectionBlock, wizardStep !== 2 && styles.hiddenStep]}>
          <Text style={[styles.stepLabel, { color: colors.primary }]}>DEADLINE & AVAILABILITY</Text>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>When do you need help by?</Text>
          <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>This helps tutors understand how soon you need a response.</Text>
          <View style={styles.deadlinesGrid}>
            {URGENT_DEADLINES.map((item) => {
              const isSelected = deadline === item.id;
              return (
                <HapticPressable
                  key={item.id}
                  onPress={() => {
                    setDeadline(item.id);
                    hapticMedium();
                  }}
                  style={[
                    styles.deadlineCard,
                    {
                      backgroundColor: isSelected ? colors.leaf : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderWidth: isSelected ? 2 : 1,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={item.icon}
                      size={14}
                      color={isSelected ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.deadlineCardText,
                        {
                          color: colors.foreground,
                          fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_600SemiBold',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                </HapticPressable>
              );
            })}
          </View>
          <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 10 }]}>When are you usually free?</Text>
          <Text style={[styles.subLabel, { color: colors.mutedForeground }]}>Pick any that fit. You’ll agree on an exact time in chat.</Text>
          <View style={styles.deadlinesGrid}>
            {(['Weekday mornings', 'Weekday evenings', 'Weekend'] as const).map((window) => {
              const selected = preferredTimes.includes(window);
              return <HapticPressable key={window} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setPreferredTimes((current) => selected ? current.filter((value) => value !== window) : [...current, window])} style={[styles.deadlineCard, { backgroundColor: selected ? colors.leaf : colors.card, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 }]}><Text style={{ color: colors.foreground, fontFamily: selected ? 'Inter_700Bold' : 'Inter_600SemiBold', fontSize: 12 }}>{window}</Text></HapticPressable>;
            })}
            <HapticPressable accessibilityRole="button" accessibilityState={{ selected: preferredTimes.length === 0 }} onPress={() => setPreferredTimes([])} style={[styles.deadlineCard, { backgroundColor: preferredTimes.length === 0 ? colors.leaf : colors.card, borderColor: preferredTimes.length === 0 ? colors.primary : colors.border, borderWidth: preferredTimes.length === 0 ? 2 : 1 }]}><Text style={{ color: colors.foreground, fontFamily: preferredTimes.length === 0 ? 'Inter_700Bold' : 'Inter_600SemiBold', fontSize: 12 }}>Flexible</Text></HapticPressable>
          </View>
        </View>

        {/* 4. BUDGET TARGET */}
        <View style={[styles.sectionBlock, wizardStep !== 3 && styles.hiddenStep]}>
          <Text style={[styles.stepLabel, { color: colors.primary }]}>SESSION BUDGET · USD</Text>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>What budget should tutors keep in mind?</Text>
          <View style={styles.budgetRow}>
            {BUDGET_PRESETS.map((amount) => {
              const isSelected = budget === amount;
              return (
                <HapticPressable
                  key={amount}
                  onPress={() => {
                    setBudget(amount);
                    setCustomBudget(String(amount));
                    hapticMedium();
                  }}
                  style={[
                    styles.budgetChip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.budgetChipText, { color: isSelected ? colors.primaryForeground : colors.foreground }]}>
                    ${amount}
                  </Text>
                </HapticPressable>
              );
            })}
          </View>
          <View style={[styles.customBudgetWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.currencyPrefix, { color: colors.foreground }]}>$</Text>
            <TextInput
              value={customBudget}
              onChangeText={(text) => {
                if (!/^\d{0,5}(\.\d{0,2})?$/.test(text)) return;
                setCustomBudget(text);
                const val = Number(text);
                if (Number.isFinite(val)) setBudget(val);
              }}
              keyboardType="decimal-pad"
              placeholder="Custom budget"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.customBudgetInput, { color: colors.foreground }]}
            />
            <Text style={[styles.budgetNote, { color: colors.mutedForeground }]}>Agree on terms directly with your tutor.</Text>
          </View>
          {invalidBudget ? <Text style={[styles.budgetNote, { color: colors.destructive, marginTop: 6 }]}>Enter an amount from $5 to $20,000.</Text> : null}
        </View>

        {wizardStep === 3 ? (
          <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }}>Review your request</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }}>
              {customSubject || subject}{courseName.trim() ? ` · ${courseName.trim()}` : ''}{institution.trim() ? ` · ${institution.trim()}` : ''}
            </Text>
            {requestedTime ? <Text style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 }}>Requested time: {requestedTime} · local time</Text> : null}
            <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>{title.trim()}</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 }}>{details.trim() || 'The tutor will start from your title and discuss the topic with you.'}</Text>
            <View style={{ borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10 }}>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12 }}>{deadline} · {learnerLevel}</Text>
              <Text style={{ color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 13 }}>${Number(customBudget || 0).toFixed(2)} budget</Text>
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.errorLight, borderColor: colors.error }]}>
            <Ionicons name="alert-circle" size={16} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.submitWrap}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {wizardStep > 1 ? <HapticPressable accessibilityRole="button" disabled={submitting} onPress={() => { setError(''); setWizardStep((step) => (step - 1) as 1 | 2 | 3); }} style={[styles.wizardBack, { borderColor: colors.border, backgroundColor: colors.card }]}><Text style={{ color: colors.foreground, fontFamily: 'Inter_700Bold', fontSize: 13 }}>Back</Text></HapticPressable> : null}
            <View style={{ flex: 1 }}>
              {wizardStep < 3 ? <ActionButton label="Continue" icon="arrow-forward" onPress={continueWizard} /> : <ActionButton label={submitting ? 'Sending request…' : 'Send request to tutors'} icon="arrow-forward" onPress={() => void submit()} disabled={submitting} testID="submit-task-btn" />}
            </View>
          </View>
          {wizardStep === 3 ? <Text style={[styles.guaranteeText, { color: colors.mutedForeground }]}>Tutors can review your request and send an offer. Use messages to agree on the session details.</Text> : null}
        </View>
      </KeyboardAwareScrollViewCompat>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formScroll: { flex: 1 },
  formContent: { paddingHorizontal: 16, gap: 16 },
  sectionBlock: { gap: 8 },
  hiddenStep: { display: 'none' },
  reviewCard: { borderRadius: 18, borderWidth: 1, gap: 9, padding: 15 },
  wizardBack: { alignItems: 'center', borderRadius: 14, borderWidth: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 18 },
  stepLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.2 },
  fieldLabel: { fontFamily: 'Inter_700Bold', fontSize: 15, letterSpacing: -0.2 },
  subLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, marginBottom: 4 },
  labelWithAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subjectChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  customSubjectChoice: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 8, minHeight: 42, paddingHorizontal: 12 },
  aiBtn: { alignItems: 'center', borderRadius: 99, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 5 },
  aiBtnText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  input: { borderRadius: 14, borderWidth: 1, fontFamily: 'Inter_500Medium', fontSize: 14, paddingHorizontal: 14, paddingVertical: 12 },
  textArea: { borderRadius: 14, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 14, minHeight: 90, paddingHorizontal: 14, paddingVertical: 12 },
  dropzone: { alignItems: 'center', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, gap: 6, justifyContent: 'center', paddingVertical: 20 },
  dropIcon: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  dropTitle: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  dropSub: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  filesList: { gap: 6, marginTop: 6 },
  fileChip: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  fileName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  removeFileBtn: { padding: 4 },
  deadlinesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  deadlineCard: { borderRadius: 12, flexBasis: '48%', flexGrow: 1, paddingHorizontal: 12, paddingVertical: 12, alignItems: 'center' },
  deadlineCardText: { fontSize: 13 },
  budgetRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  budgetChip: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flex: 1, paddingVertical: 10 },
  budgetChipText: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  customBudgetWrap: { alignItems: 'center', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 6, paddingHorizontal: 14, paddingVertical: 10 },
  currencyPrefix: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  customBudgetInput: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  budgetNote: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  errorBox: { alignItems: 'center', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 12 },
  errorText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 12 },
  submitWrap: { gap: 8, marginTop: 8 },
  guaranteeText: { fontFamily: 'Inter_500Medium', fontSize: 11, textAlign: 'center' },
  broadcastingCenter: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  broadcastingCard: { alignItems: 'center', borderRadius: 24, borderWidth: 1, gap: 12, maxWidth: 360, padding: 28, width: '100%', shadowColor: '#183B31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 4 },
  broadcastingRadar: { alignItems: 'center', borderRadius: 36, height: 72, justifyContent: 'center', width: 72 },
  livePill: { alignItems: 'center', borderRadius: 99, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { borderRadius: 4, height: 7, width: 7 },
  livePillText: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.6 },
  broadcastingTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, textAlign: 'center', letterSpacing: -0.3 },
  broadcastingSub: { fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' },
  broadcastingStatBox: { borderRadius: 16, flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, paddingVertical: 12, width: '100%' },
  broadcastingStat: { alignItems: 'center' },
  statStat: { alignItems: 'center' },
  statNum: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  statLbl: { fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 2 },
  statLine: { width: 1, height: 28 },
});
