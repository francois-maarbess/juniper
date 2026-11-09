import React, { useCallback, useEffect, useState } from 'react';
import { HapticPressable } from '@/components/HapticPressable';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, EmptyState, PageHeader, Screen, StatusPill } from '@/components/JuniperUI';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { RequireAdminAuth } from '@/components/RequireAdminAuth';

type Document = { id: string; category: string; fileName: string; mimeType: string; sizeBytes: number; reviewStatus: string; reviewerNote: string | null };
type Application = {
  userId: string; legalName: string; applicantType: 'student' | 'graduate' | 'professional'; country: string | null; degreeLevel: string | null; institution: string | null;
  fieldOfStudy: string | null; graduationYear: number | null; gradeValue: string | null; gradeScale: string | null;
  yearsExperience: number | null; languages: string[]; status: string; submittedAt: string | null; applicantMessage: string | null;
  displayName: string | null; headline: string | null; biography: string | null; educationSummary: string | null;
  hourlyRateCents: number | null; availability: string[] | null; levels: string[] | null; email: string; firstName: string;
  lastName: string | null; subjects: string[]; customSubjects?: string[]; customCourses?: string[]; customUniversities?: string[]; documents: Document[];
};

export default function TutorReviewScreen() {
  const colors = useColors(); const router = useRouter(); const { request, download } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try { setApplications(await request<Application[]>('/marketplace/admin/tutor-applications/complete')); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The private review queue could not be opened.'); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { void load(); }, [load]);

  const reviewFile = async (application: Application, document: Document, status: 'verified' | 'replace_requested') => {
    if (status === 'replace_requested' && note.trim().length < 8) { setError('Add a short note describing what the applicant should replace.'); return; }
    setBusy(true); setError('');
    try {
      await request(`/marketplace/admin/tutor-applications/${application.userId}/documents/${document.id}/review`, { method: 'PATCH', body: { status, note } });
      setNote(''); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'That document review could not be saved.'); }
    finally { setBusy(false); }
  };

  const openFile = async (application: Application, document: Document) => {
    setBusy(true); setError('');
    try {
      const result = await download(`/marketplace/admin/tutor-applications/${application.userId}/documents/${document.id}/file`);
      const url = URL.createObjectURL(result.blob);
      if (typeof window !== 'undefined') {
        const link = window.document.createElement('a'); link.href = url; link.download = result.fileName;
        window.document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else URL.revokeObjectURL(url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'That private file could not be opened.'); }
    finally { setBusy(false); }
  };

  const decide = async (application: Application, decision: 'approved' | 'needs_info' | 'rejected') => {
    if (decision !== 'approved' && note.trim().length < 10) { setError('Add a clear, kind note for the applicant.'); return; }
    setBusy(true); setError('');
    try {
      await request(`/marketplace/admin/tutor-applications/${application.userId}/decision`, {
        method: 'PATCH', body: { decision, applicantMessage: decision === 'approved' ? '' : note.trim() },
      });
      setSelected(null); setNote(''); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'That application decision could not be saved.'); }
    finally { setBusy(false); }
  };

  return <RequireAdminAuth><Screen>
    <PageHeader title="Tutor applications" eyebrow="Juniper review studio" onBack={() => router.back()} />
    <View style={[styles.hero, { backgroundColor: colors.primary }]}><View style={styles.heroIcon}><Ionicons name="shield-checkmark-outline" size={21} color={colors.primaryForeground} /></View><View style={{ flex: 1, gap: 4 }}><Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>A thoughtful review builds trust.</Text><Text style={[styles.heroCopy, { color: colors.primaryForeground }]}>Documents are private to the review team. Verify a transcript and the evidence required for this applicant’s pathway.</Text></View></View>
    {error ? <View style={[styles.message, { backgroundColor: colors.softCoral }]}><Ionicons name="alert-circle-outline" size={16} color={colors.destructive} /><Text style={[styles.body, { color: colors.destructive, flex: 1 }]}>{error}</Text></View> : null}
    {loading ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>Opening the private review queue…</Text> : null}
    {!loading && !applications.length && !error ? <EmptyState icon="checkmark-circle-outline" title="The review queue is clear" description="Submitted tutor applications will appear here when they’re ready for review." /> : null}
    <View style={styles.list}>{applications.map((app) => {
      const isSelected = selected === app.userId;
      const hasTranscript = app.documents.some((d) => d.category === 'transcript' && d.reviewStatus === 'verified');
      const evidenceCategory = app.applicantType === 'student' ? 'enrollment_proof' : 'degree_certificate';
      const hasRequiredEvidence = app.documents.some((d) => d.category === evidenceCategory && d.reviewStatus === 'verified');
      return <View key={app.userId} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.identity}><View style={[styles.avatar, { backgroundColor: colors.leaf }]}><Ionicons name="person-outline" size={19} color={colors.primary} /></View><View style={{ flex: 1, gap: 4 }}><Text style={[styles.name, { color: colors.foreground }]}>{app.displayName || app.legalName}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{app.email} · {app.country ?? 'Location not provided'}</Text></View><StatusPill label={app.status.replace('_', ' ')} tone={app.status === 'needs_info' ? 'neutral' : 'green'} /></View>
        <Text style={[styles.subjects, { color: colors.primary }]}>{[...app.subjects.filter((item) => item !== 'Other subject'), ...(app.customSubjects ?? [])].join(' · ') || 'No subjects selected'}{app.headline ? `  /  ${app.headline}` : ''}</Text>
        {(app.customCourses?.length || app.customUniversities?.length) ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>{[...(app.customCourses ?? []), ...(app.customUniversities ?? [])].join(' · ')}</Text> : null}
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>{app.applicantType === 'student' ? 'Current student pathway' : app.applicantType === 'professional' ? 'Professional pathway' : 'Graduate pathway'}</Text>
        <View style={[styles.detailGrid, { backgroundColor: colors.pale }]}>
          <Detail label="LEGAL NAME" value={app.legalName} colors={colors} /><Detail label="EDUCATION" value={`${app.degreeLevel ?? 'Not listed'} · ${app.fieldOfStudy ?? 'Not listed'}`} colors={colors} />
          <Detail label="INSTITUTION" value={`${app.institution ?? 'Not listed'}${app.graduationYear ? ` · ${app.graduationYear}` : ''}`} colors={colors} /><Detail label="GRADES" value={[app.gradeValue, app.gradeScale].filter(Boolean).join(' / ') || 'Not shared'} colors={colors} />
          <Detail label="EXPERIENCE" value={`${app.yearsExperience ?? 0} years · ${app.languages.join(', ') || 'No languages listed'}`} colors={colors} /><Detail label="TEACHING RATE" value={app.hourlyRateCents ? `$${(app.hourlyRateCents / 100).toFixed(0)} / hour` : 'Not listed'} colors={colors} />
        </View>
        {app.biography ? <Text style={[styles.body, { color: colors.foreground }]}>{app.biography}</Text> : null}
        {app.educationSummary ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{app.educationSummary}</Text> : null}
        <View style={styles.docsHeading}><Text style={[styles.sectionLabel, { color: colors.foreground }]}>PRIVATE QUALIFICATION FILES</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{app.documents.length} attached</Text></View>
        {!app.documents.length ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>No files attached yet.</Text> : app.documents.map((doc) => <View key={doc.id} style={[styles.doc, { borderColor: colors.border }]}>
          <View style={[styles.docIcon, { backgroundColor: colors.leaf }]}><Ionicons name="document-text-outline" size={16} color={colors.primary} /></View>
          <View style={{ flex: 1, gap: 3 }}><Text style={[styles.docName, { color: colors.foreground }]}>{doc.fileName}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{doc.category.replaceAll('_', ' ')} · {formatSize(doc.sizeBytes)}</Text>{doc.reviewerNote ? <Text style={[styles.meta, { color: colors.destructive }]}>{doc.reviewerNote}</Text> : null}</View>
          <StatusPill label={doc.reviewStatus.replace('_', ' ')} tone={doc.reviewStatus === 'verified' ? 'green' : 'neutral'} />
          <HapticPressable accessibilityRole="button" accessibilityLabel={`View ${doc.fileName}`} onPress={() => void openFile(app, doc)} style={styles.fileAction}><Ionicons name="download-outline" size={17} color={colors.primary} /><Text style={[styles.fileActionText, { color: colors.primary }]}>View Docs</Text></HapticPressable>
          {isSelected && doc.reviewStatus !== 'verified' ? <View style={styles.docReview}><HapticPressable accessibilityRole="button" disabled={busy} onPress={() => void reviewFile(app, doc, 'verified')} style={[styles.miniAction, { backgroundColor: colors.leaf }]}><Ionicons name="checkmark" size={14} color={colors.primary} /><Text style={[styles.miniText, { color: colors.primary }]}>Verify</Text></HapticPressable><HapticPressable accessibilityRole="button" disabled={busy} onPress={() => void reviewFile(app, doc, 'replace_requested')} style={[styles.miniAction, { backgroundColor: colors.softCoral }]}><Ionicons name="refresh-outline" size={14} color={colors.destructive} /><Text style={[styles.miniText, { color: colors.destructive }]}>Request replacement</Text></HapticPressable></View> : null}
        </View>)}
        {isSelected ? <View style={styles.reviewControls}>
          <TextInput value={note} onChangeText={setNote} placeholder="Note for the applicant (needed for requests or declines)" placeholderTextColor={colors.mutedForeground} multiline maxLength={2000} style={[styles.note, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]} />
          <View style={styles.decisionActions}><ActionButton label="Approve tutor" icon="checkmark" disabled={busy || !hasTranscript || !hasRequiredEvidence} onPress={() => void decide(app, 'approved')} /><ActionButton label="Request information" variant="secondary" disabled={busy} onPress={() => void decide(app, 'needs_info')} /><ActionButton label="Decline" variant="secondary" disabled={busy} onPress={() => void decide(app, 'rejected')} /></View>
          {(!hasTranscript || !hasRequiredEvidence) ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>Approval requires a verified transcript and {app.applicantType === 'student' ? 'proof of current enrollment' : 'degree certificate'}.</Text> : null}
          <HapticPressable accessibilityRole="button" onPress={() => { setSelected(null); setNote(''); }}><Text style={[styles.close, { color: colors.mutedForeground }]}>Close review</Text></HapticPressable>
        </View> : <ActionButton label="Review documents" variant="secondary" onPress={() => { setSelected(app.userId); setNote(''); }} />}
      </View>;
    })}</View>
  </Screen></RequireAdminAuth>;
}

function Detail({ label, value, colors }: { label: string; value: string; colors: ReturnType<typeof useColors> }) { return <View style={styles.detail}><Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.detailValue, { color: colors.foreground }]}>{value}</Text></View>; }
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
const styles = StyleSheet.create({
  hero: { alignItems: 'center', borderRadius: 22, flexDirection: 'row', gap: 14, marginTop: 16, padding: 18, shadowColor: '#183B31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2 },
  heroIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  heroTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, letterSpacing: -0.3 },
  heroCopy: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, opacity: 0.88 },
  message: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', gap: 9, marginTop: 14, padding: 12 },
  list: { gap: 14, paddingBottom: 32, paddingTop: 16 },
  card: { borderRadius: 22, borderWidth: 1, gap: 14, padding: 18, shadowColor: '#183B31', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  identity: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  avatar: { alignItems: 'center', borderRadius: 16, height: 44, justifyContent: 'center', width: 44 },
  name: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.3 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 10, lineHeight: 15 },
  subjects: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' },
  body: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  detailGrid: { borderRadius: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 13 },
  detail: { gap: 4, minWidth: '45%', flexGrow: 1 },
  detailLabel: { fontFamily: 'Inter_700Bold', fontSize: 9, letterSpacing: 0.9 },
  detailValue: { fontFamily: 'Inter_600SemiBold', fontSize: 11, lineHeight: 16 },
  docsHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  sectionLabel: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 1.1 },
  doc: { alignItems: 'center', borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingTop: 12 },
  docIcon: { alignItems: 'center', borderRadius: 12, height: 34, justifyContent: 'center', width: 34 },
  docName: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  fileAction: { alignItems: 'center', flexDirection: 'row', gap: 4, padding: 6 },
  fileActionText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  docReview: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', width: '100%', marginTop: 4 },
  miniAction: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 7 },
  miniText: { fontFamily: 'Inter_700Bold', fontSize: 10 },
  reviewControls: { gap: 12 },
  note: { borderRadius: 14, borderWidth: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, minHeight: 74, padding: 12 },
  decisionActions: { gap: 8 },
  close: { fontFamily: 'Inter_600SemiBold', fontSize: 11, textAlign: 'center', paddingVertical: 4 },
});
