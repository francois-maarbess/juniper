import React, { useCallback, useEffect, useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { ActionButton, PageHeader, Screen } from '@/components/JuniperUI';
import { CourseCodeSelector, UniversityCourse } from '@/components/CourseCodeSelector';
import { WeeklyScheduler, AvailabilitySlot, DayOfWeek } from '@/components/WeeklyScheduler';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';

type Subject = { id: string; name: string };
type Doc = { id: string; category: string; fileName: string; sizeBytes: number; reviewStatus: string; reviewerNote?: string | null };
type ApplicantType = 'student' | 'graduate' | 'professional';
type Application = {
  legalName: string; applicantType: ApplicantType; country: string | null; degreeLevel: string | null; institution: string | null; fieldOfStudy: string | null;
  graduationYear: number | null; gradeValue: string | null; gradeScale: string | null; yearsExperience: number | null;
  languages: string[]; status: string; applicantMessage: string | null; documents: Doc[];
  profile: null | { displayName: string; headline: string | null; biography: string | null; educationSummary: string | null;
    hourlyRateCents: number; availability: string[]; timezone: string; levels: string[]; subjects: Subject[]; customSubjects?: string[]; customCourses?: string[]; customUniversities?: string[] };
};
const STUDY_WINDOWS = ['Weekday mornings', 'Weekday evenings', 'Weekend'];
const LEVELS = ['Primary', 'Middle school', 'High school', 'University', 'Adult learning'];
const DOCUMENTS = [
  { key: 'transcript', title: 'Academic transcript', hint: 'Your grades or academic record', required: true },
  { key: 'enrollment_proof', title: 'Proof of current enrollment', hint: 'A current student card or enrollment letter', required: false },
  { key: 'degree_certificate', title: 'Degree certificate', hint: 'Your completed degree or diploma', required: false },
  { key: 'teaching_certificate', title: 'Teaching certificate', hint: 'If you have one', required: false },
  { key: 'cv', title: 'CV or résumé', hint: 'A concise view of your experience', required: false },
  { key: 'portfolio_evidence', title: 'Teaching samples', hint: 'Lesson notes, portfolio, or references', required: false },
  { key: 'other', title: 'Other supporting document', hint: 'Anything else that helps us understand your work', required: false },
];

export default function BecomeTutorScreen() {
  const colors = useColors(); const insets = useSafeAreaInsets(); const router = useRouter();
  const { request, upload, user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]); const [application, setApplication] = useState<Application | null>(null);
  const [legalName, setLegalName] = useState(''); const [country, setCountry] = useState(''); const [degreeLevel, setDegreeLevel] = useState('');
  const [institution, setInstitution] = useState(''); const [fieldOfStudy, setFieldOfStudy] = useState(''); const [graduationYear, setGraduationYear] = useState('');
  const [gradeValue, setGradeValue] = useState(''); const [gradeScale, setGradeScale] = useState(''); const [yearsExperience, setYearsExperience] = useState('0');
  const [languages, setLanguages] = useState('English'); const [displayName, setDisplayName] = useState(''); const [headline, setHeadline] = useState('');
  const [biography, setBiography] = useState(''); const [educationSummary, setEducationSummary] = useState(''); const [rate, setRate] = useState('28');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]); const [levels, setLevels] = useState<string[]>(['High school']);
  const [applicantType, setApplicantType] = useState<ApplicantType>('graduate');
  const [customSubjectsText, setCustomSubjectsText] = useState('');
  const [customCoursesText, setCustomCoursesText] = useState('');
  const [customUniversitiesText, setCustomUniversitiesText] = useState('');
  const [availability, setAvailability] = useState<string[]>(['Weekday evenings', 'Weekend']);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [knownCourses, setKnownCourses] = useState<UniversityCourse[]>([]);
  const [weeklySlots, setWeeklySlots] = useState<AvailabilitySlot[]>([
    { dayOfWeek: 'monday', startTime: '16:00', endTime: '20:00', isActive: true },
    { dayOfWeek: 'wednesday', startTime: '16:00', endTime: '20:00', isActive: true },
    { dayOfWeek: 'saturday', startTime: '10:00', endTime: '16:00', isActive: true },
  ]);
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Beirut');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, available, savedCourses, savedSlots] = await Promise.all([
        request<Application>('/marketplace/tutor-application/me'),
        request<Subject[]>('/marketplace/subjects'),
        request<UniversityCourse[]>('/marketplace/tutor-profile/courses').catch(() => []),
        request<AvailabilitySlot[]>('/marketplace/tutor-profile/availability').catch(() => []),
      ]);
      setApplication(data); setSubjects(available); setLegalName(data.legalName); setCountry(data.country ?? '');
      setApplicantType(data.applicantType ?? 'graduate');
      setDegreeLevel(data.degreeLevel ?? ''); setInstitution(data.institution ?? ''); setFieldOfStudy(data.fieldOfStudy ?? '');
      setGraduationYear(data.graduationYear ? String(data.graduationYear) : ''); setGradeValue(data.gradeValue ?? ''); setGradeScale(data.gradeScale ?? '');
      setYearsExperience(String(data.yearsExperience ?? 0)); setLanguages(data.languages.join(', ') || 'English');
      setDisplayName(data.profile?.displayName ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
      setHeadline(data.profile?.headline ?? 'Patient, encouraging support in'); setBiography(data.profile?.biography ?? '');
      setEducationSummary(data.profile?.educationSummary ?? ''); setRate(String((data.profile?.hourlyRateCents ?? 2800) / 100));
      setSelectedSubjects(data.profile?.subjects.map((item) => item.id) ?? []);
      setCustomSubjectsText(data.profile?.customSubjects?.join(', ') ?? '');
      setCustomCoursesText(data.profile?.customCourses?.join(', ') ?? '');
      setCustomUniversitiesText(data.profile?.customUniversities?.join(', ') ?? '');
      setLevels(data.profile?.levels?.length ? data.profile.levels : ['High school']);
      setAvailability(data.profile?.availability?.length ? data.profile.availability : ['Weekday evenings', 'Weekend']);
      setTimezone(data.profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Beirut');
      if (savedCourses && savedCourses.length > 0) {
        setSelectedCourseIds(savedCourses.map((c) => c.id));
        setKnownCourses(savedCourses);
      }
      if (savedSlots && savedSlots.length > 0) {
        setWeeklySlots(savedSlots);
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Your application could not be opened.'); }
    finally { setLoading(false); }
  }, [request, user?.firstName, user?.lastName]);
  useEffect(() => { void load(); }, [load]);

  const payload = () => ({ legalName, applicantType, country, degreeLevel, institution, fieldOfStudy, graduationYear: graduationYear ? Number(graduationYear) : null,
    gradeValue, gradeScale, yearsExperience: Number(yearsExperience), languages: languages.split(',').map((v) => v.trim()).filter(Boolean),
    displayName, headline, biography, educationSummary, hourlyRateCents: Math.round(Number(rate) * 100),
    subjectIds: selectedSubjects.length ? selectedSubjects : customSubjectsText.trim() && subjects.find((item) => item.name === 'Other subject') ? [subjects.find((item) => item.name === 'Other subject')!.id] : [], customSubjects: customSubjectsText.split(',').map((v) => v.trim()).filter(Boolean),
    customCourses: customCoursesText.split(',').map((v) => v.trim()).filter(Boolean),
    customUniversities: customUniversitiesText.split(',').map((v) => v.trim()).filter(Boolean), levels, availability, timezone });

  const save = async (quiet = false) => {
    setBusy(true); setError(''); if (!quiet) setSuccess('');
    let profileSaved = false;
    let failedPart = 'your changes';
    try {
      const updated = await request<Application>('/marketplace/tutor-application/me', { method: 'PUT', body: payload() });
      setApplication(updated);
      profileSaved = true;

      // Persist selected catalog courses.
      failedPart = 'course matches';
      await request('/marketplace/tutor-profile/courses', {
        method: 'PUT',
        body: { courseIds: selectedCourseIds },
      });

      // Persist recurring availability slots
      failedPart = 'your weekly schedule';
      await request('/marketplace/tutor-profile/availability', {
        method: 'PUT',
        body: {
          slots: weeklySlots.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        },
      });

      if (!quiet) setSuccess('Your progress, course codes, and weekly schedule are safely saved.');
      return true;
    }
    catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Please try again.';
      setError(profileSaved ? `Your profile details were saved, but ${failedPart} could not be saved. ${message}` : message);
      return false;
    }
    finally { setBusy(false); }
  };

  const addDocument = async (category: string) => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], multiple: false, copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0]; if (asset.size && asset.size > 10 * 1024 * 1024) { setError('Choose a file smaller than 10 MB.'); return; }
    setBusy(true); setError(''); setSuccess('');
    try {
      const form = new FormData(); form.append('category', category);
      if (asset.file) form.append('file', asset.file);
      else form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as unknown as Blob);
      const document = await upload<Doc>('/marketplace/tutor-application/documents', form);
      setApplication((current) => current ? { ...current, documents: [...current.documents, document] } : current);
      setSuccess('Document added to your private application.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'That document could not be added.'); }
    finally { setBusy(false); }
  };

  const removeDocument = async (id: string) => {
    setBusy(true); setError('');
    try { await request(`/marketplace/tutor-application/documents/${id}`, { method: 'DELETE' }); setApplication((current) => current ? { ...current, documents: current.documents.filter((doc) => doc.id !== id) } : current); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'That document could not be removed.'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!await save(true)) return;
    setBusy(true); setError(''); setSuccess('');
    try { const updated = await request<Application>('/marketplace/tutor-application/me/submit', { method: 'POST', body: {} }); setApplication(updated); setSuccess('Your application is with our review team. We’ll let you know when there’s an update.'); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Your application needs a little more information.'); }
    finally { setBusy(false); }
  };

  const toggle = (items: string[], setter: (value: string[]) => void, item: string) => setter(items.includes(item) ? items.filter((v) => v !== item) : [...items, item]);
  const submitted = application?.status === 'in_review' || application?.status === 'submitted';
  const approved = application?.status === 'approved';

  return <Screen scroll={false} contentStyle={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}>
    <KeyboardAwareScrollViewCompat style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + (insets.top < 12 ? 67 : 8), paddingBottom: Math.max(insets.bottom, 18) + 30 }]} keyboardShouldPersistTaps="handled" bottomOffset={72}>
      <PageHeader title={approved ? 'Your tutor profile' : 'Apply to teach on Juniper'} eyebrow="Tutor application" onBack={() => router.back()} />
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
        <View style={styles.heroTop}><View style={[styles.heroIcon, { backgroundColor: colors.iconCircle }]}><Ionicons name="school-outline" size={20} color={colors.accent} /></View><Text style={[styles.eyebrow, { color: colors.accent }]}>Share what you can teach</Text></View>
        <Text style={[styles.heroTitle, { color: colors.foreground }]}>Teach the subjects you know best.</Text>
        <Text style={[styles.heroCopy, { color: colors.mutedForeground }]}>Tell learners what you teach, how you teach, and when you’re free. Juniper reviews every application before your profile goes live.</Text>
        <View style={styles.progress}><View style={[styles.progressLine, { backgroundColor: colors.orange }]} /><View style={[styles.progressLine, { backgroundColor: application?.documents.length ? colors.orange : 'rgba(255,255,255,0.22)' }]} /><View style={[styles.progressLine, { backgroundColor: submitted || approved ? colors.orange : 'rgba(255,255,255,0.22)' }]} /></View>
        <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>{submitted ? 'Application in review' : approved ? 'Tutor profile approved' : `${application?.documents.length ? '2' : '1'} of 3 · Your application`}</Text>
      </View>

      {(submitted || approved || application?.status === 'needs_info') ? <View style={[styles.statusCard, { backgroundColor: colors.pale }]}><Ionicons name={approved ? 'checkmark-circle-outline' : 'time-outline'} size={20} color={colors.primary} /><View style={{ flex: 1, gap: 4 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{approved ? 'Your tutor profile is approved.' : submitted ? 'Your application is in review.' : 'Additional details requested.'}</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>{approved ? 'Your profile is visible to learners, and you can respond to requests.' : application?.applicantMessage ?? 'Juniper will notify you when there’s an update.'}</Text></View></View> : null}
      <SectionTitle number="01" title="Your credentials" copy="We use these details to review your qualifications." colors={colors} />
      <Field label="Full legal name" value={legalName} onChangeText={setLegalName} placeholder="As shown on your documents" colors={colors} />
      <Field label="Country or region" value={country} onChangeText={setCountry} placeholder="Where you’re based" colors={colors} />
      <ChipGroup label="Your current pathway" items={[{ id: 'student', label: 'Currently studying' }, { id: 'graduate', label: 'Graduate' }, { id: 'professional', label: 'Professional' }]} selected={[applicantType]} onToggle={(value) => setApplicantType(value as ApplicantType)} colors={colors} />
      <Field label="Highest degree or current study" value={degreeLevel} onChangeText={setDegreeLevel} placeholder="For example, Bachelor’s degree" colors={colors} />
      <Field label="School or institution" value={institution} onChangeText={setInstitution} placeholder="University, college, or school" colors={colors} />
      <View style={styles.twoColumns}><View style={styles.column}><Field label="Field of study" value={fieldOfStudy} onChangeText={setFieldOfStudy} placeholder="Mathematics" colors={colors} /></View>{applicantType !== 'student' ? <View style={styles.column}><Field label="Graduation year" value={graduationYear} onChangeText={setGraduationYear} placeholder="2024" keyboardType="number-pad" colors={colors} /></View> : null}</View>
      <View style={styles.twoColumns}><View style={styles.column}><Field label="Grade or GPA" value={gradeValue} onChangeText={setGradeValue} placeholder="3.8" colors={colors} /></View><View style={styles.column}><Field label="Scale" value={gradeScale} onChangeText={setGradeScale} placeholder="out of 4.0" colors={colors} /></View></View>
      <Field label="Years teaching or relevant experience" value={yearsExperience} onChangeText={setYearsExperience} placeholder="0" keyboardType="number-pad" colors={colors} />
      <Field label="Languages you can teach in" value={languages} onChangeText={setLanguages} placeholder="English, French" hint="Separate languages with a comma." colors={colors} />

      <SectionTitle number="02" title="Your teaching profile" copy="Your subjects, teaching style, and experience." colors={colors} />
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Your name or academic title" colors={colors} />
      <Field label="Profile headline" value={headline} onChangeText={setHeadline} placeholder="For example, ‘Patient biology tutor for university students’" colors={colors} />
      <Field label="How you teach" value={biography} onChangeText={setBiography} placeholder="Describe how you explain ideas, answer questions, and help learners practise." multiline colors={colors} />
      <Field label="Education and experience" value={educationSummary} onChangeText={setEducationSummary} placeholder="Share relevant study, teaching, or professional experience." multiline colors={colors} />
      <Field label="Hourly rate (USD)" value={rate} onChangeText={setRate} placeholder="28" keyboardType="decimal-pad" colors={colors} />
      <ChipGroup label="Subjects you teach" items={subjects.map((item) => ({ id: item.id, label: item.name }))} selected={selectedSubjects} onToggle={(id) => toggle(selectedSubjects, setSelectedSubjects, id)} colors={colors} />
      <Field label="Other subjects or languages" value={customSubjectsText} onChangeText={setCustomSubjectsText} placeholder="For example, Haitian Creole, actuarial science" hint="Add any subject Juniper doesn’t list yet. Separate entries with commas." colors={colors} />
      <Field label="Courses or course codes you can teach" value={customCoursesText} onChangeText={setCustomCoursesText} placeholder="For example, BIO 201, organic chemistry" hint="Optional. Add codes or course names even if they aren’t in the Juniper catalogue." colors={colors} />
      <Field label="Institutions you know well" value={customUniversitiesText} onChangeText={setCustomUniversitiesText} placeholder="Any university, college, or institution" hint="Optional. Separate entries with commas." colors={colors} />
      <ChipGroup label="Learner levels" items={LEVELS.map((label) => ({ id: label, label }))} selected={levels} onToggle={(id) => toggle(levels, setLevels, id)} colors={colors} />
      <ChipGroup label="When you’re generally available" items={STUDY_WINDOWS.map((label) => ({ id: label, label }))} selected={availability} onToggle={(id) => toggle(availability, setAvailability, id)} colors={colors} />
      <View style={[styles.timezoneNote, { backgroundColor: colors.pale }]}><Ionicons name="time-outline" size={15} color={colors.primary} /><Text style={[styles.hint, { color: colors.foreground }]}>Availability is shown in your local time · {timezone}</Text></View>

      {/* Optional course catalogue matches across institutions */}
      <CourseCodeSelector
        selectedCourseIds={selectedCourseIds}
        onChangeSelectedCourseIds={setSelectedCourseIds}
        initialCourses={knownCourses}
        title="Optional university course matches"
        subtitle="Add listed course codes when available. Learners can also find you by subject, institution, and course details you enter."
      />

      {/* Epic 2: Direct Weekly Availability Scheduler */}
      <WeeklyScheduler
        slots={weeklySlots}
        onChangeSlots={setWeeklySlots}
        timezone={timezone}
      />

      <SectionTitle number="03" title="Your qualifications" copy="Clear, legible files help us make a careful and timely decision." colors={colors} />
      <View style={[styles.privacyNote, { backgroundColor: colors.pale }]}><Ionicons name="lock-closed-outline" size={17} color={colors.primary} /><Text style={[styles.privacyCopy, { color: colors.foreground }]}>Private by design. Only Juniper reviewers can access your files. They never appear on your public tutor profile.</Text></View>
      {DOCUMENTS.map((document) => {
        const isRequired = document.key === 'transcript' || (applicantType === 'student' ? document.key === 'enrollment_proof' : document.key === 'degree_certificate');
        const attached = application?.documents.filter((item) => item.category === document.key) ?? [];
        return <View key={document.key} style={[styles.documentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.documentHeading}><View style={[styles.documentIcon, { backgroundColor: colors.leaf }]}><Ionicons name={attached.length ? 'document-text-outline' : 'cloud-upload-outline'} size={17} color={colors.primary} /></View><View style={styles.documentCopy}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{document.title}{isRequired ? <Text style={{ color: colors.orange }}> · Required</Text> : null}</Text><Text style={[styles.hint, { color: colors.mutedForeground }]}>{document.hint}</Text></View></View>
          {attached.map((doc) => <View key={doc.id} style={[styles.fileRow, { borderColor: colors.border }]}><Ionicons name="attach-outline" size={15} color={colors.primary} /><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.fileName, { color: colors.foreground }]}>{doc.fileName}</Text><Text style={[styles.hint, { color: colors.mutedForeground }]}>{doc.reviewStatus === 'verified' ? 'Verified by Juniper' : doc.reviewStatus === 'replace_requested' ? doc.reviewerNote ?? 'Please replace this file' : 'Ready for private review'} · {formatSize(doc.sizeBytes)}</Text></View>{!submitted && !approved ? <HapticPressable accessibilityRole="button" accessibilityLabel={`Remove ${doc.fileName}`} onPress={() => void removeDocument(doc.id)}><Ionicons name="close-circle-outline" size={20} color={colors.mutedForeground} /></HapticPressable> : null}</View>)}
          {!submitted && !approved ? <HapticPressable accessibilityRole="button" onPress={() => void addDocument(document.key)} style={[styles.uploadButton, { borderColor: colors.border }]}><Ionicons name="add-outline" size={18} color={colors.primary} /><Text style={[styles.uploadText, { color: colors.primary }]}>{attached.length ? 'Add another file' : 'Choose a file'}</Text><Text style={[styles.hint, { color: colors.mutedForeground }]}>PDF, JPG or PNG · up to 10 MB</Text></HapticPressable> : null}
        </View>;
      })}

      {error ? <View style={[styles.message, { backgroundColor: colors.softCoral }]}><Ionicons name="alert-circle-outline" size={17} color={colors.destructive} /><Text style={[styles.messageText, { color: colors.destructive }]}>{error}</Text></View> : null}
      {success ? <View style={[styles.message, { backgroundColor: colors.pale }]}><Ionicons name="checkmark-circle-outline" size={17} color={colors.primary} /><Text style={[styles.messageText, { color: colors.foreground }]}>{success}</Text></View> : null}
      <View style={styles.actions}>
        {!submitted && !approved ? <><ActionButton label="Save and come back later" variant="secondary" onPress={() => void save()} loading={busy || loading} disabled={loading} /><ActionButton label="Send for review" icon="arrow-forward" onPress={() => void submit()} loading={busy || loading} disabled={loading} /></> : null}
        {approved ? <ActionButton label="Back to Juniper" icon="arrow-forward" onPress={() => router.replace('/(tabs)')} /> : null}
        <Text style={[styles.footer, { color: colors.mutedForeground }]}>By submitting, you confirm that the information is accurate and the documents belong to you.</Text>
      </View>
    </KeyboardAwareScrollViewCompat>
  </Screen>;
}

function SectionTitle({ number, title, copy, colors }: { number: string; title: string; copy: string; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.sectionTitle}><Text style={[styles.sectionNumber, { color: colors.primary }]}>{number}</Text><View style={{ flex: 1, gap: 4 }}><Text style={[styles.sectionHeading, { color: colors.foreground }]}>{title}</Text><Text style={[styles.sectionCopy, { color: colors.mutedForeground }]}>{copy}</Text></View></View>;
}
function Field({ label, value, onChangeText, placeholder, colors, hint, multiline, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; colors: ReturnType<typeof useColors>; hint?: string; multiline?: boolean; keyboardType?: 'default' | 'number-pad' | 'decimal-pad' }) {
  return <View style={styles.field}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={keyboardType} multiline={multiline} maxLength={multiline ? 3000 : 180} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.textarea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]} />{hint ? <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text> : null}</View>;
}
function ChipGroup({ label, items, selected, onToggle, colors }: { label: string; items: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void; colors: ReturnType<typeof useColors> }) {
  return <View style={styles.chipGroup}><Text style={[styles.label, { color: colors.foreground }]}>{label}</Text><View style={styles.chips}>{items.map((item) => { const active = selected.includes(item.id); return <HapticPressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => onToggle(item.id)} style={[styles.chip, { backgroundColor: active ? colors.leaf : colors.card, borderColor: active ? colors.primary : colors.border }]}><Text style={[styles.chipText, { color: active ? colors.primary : colors.foreground }]}>{item.label}</Text></HapticPressable>; })}</View></View>;
}
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

const styles = StyleSheet.create({
  scroll: { flex: 1 }, content: { paddingHorizontal: 22 },
  hero: { borderRadius: 24, gap: 12, marginTop: 16, padding: 22, shadowColor: '#183B31', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3 },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  heroIcon: { alignItems: 'center', borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  eyebrow: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 25, letterSpacing: -0.7, lineHeight: 31, marginTop: 4 },
  heroCopy: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, opacity: 0.88 },
  progress: { flexDirection: 'row', gap: 6, marginTop: 8 },
  progressLine: { borderRadius: 4, flex: 1, height: 4 },
  progressLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 10, opacity: 0.85 },
  statusCard: { alignItems: 'flex-start', borderRadius: 18, flexDirection: 'row', gap: 12, marginTop: 14, padding: 16 },
  cardTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, lineHeight: 18 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 17 },
  sectionTitle: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, marginBottom: 2, marginTop: 30 },
  sectionNumber: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 1.2, paddingTop: 3 },
  sectionHeading: { fontFamily: 'Inter_700Bold', fontSize: 22, letterSpacing: -0.5 },
  sectionCopy: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  field: { gap: 8, marginTop: 16 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 12, letterSpacing: -0.1 },
  input: { borderRadius: 14, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 14, minHeight: 48, paddingHorizontal: 14 },
  textarea: { minHeight: 110, paddingTop: 13 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 14 },
  twoColumns: { flexDirection: 'row', gap: 12 },
  column: { flex: 1 },
  chipGroup: { gap: 10, marginTop: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 14, borderWidth: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  privacyNote: { alignItems: 'flex-start', borderRadius: 16, flexDirection: 'row', gap: 10, marginTop: 14, padding: 14 },
  timezoneNote: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 8, marginTop: 9, padding: 11 },
  privacyCopy: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16 },
  documentCard: { borderRadius: 20, borderWidth: 1, gap: 12, marginTop: 12, padding: 15, shadowColor: '#183B31', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  documentHeading: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  documentIcon: { alignItems: 'center', borderRadius: 14, height: 38, justifyContent: 'center', width: 38 },
  documentCopy: { flex: 1, gap: 3 },
  fileRow: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', gap: 9, paddingTop: 11 },
  fileName: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  uploadButton: { alignItems: 'center', borderRadius: 14, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center', minHeight: 48, padding: 10 },
  uploadText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  message: { alignItems: 'flex-start', borderRadius: 14, flexDirection: 'row', gap: 9, marginTop: 16, padding: 13 },
  messageText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17 },
  actions: { gap: 10, marginTop: 24 },
  footer: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15, textAlign: 'center' },
});
