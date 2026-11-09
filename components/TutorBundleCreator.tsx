import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type OfferType = 'hourly' | 'package';

interface HourlyDraft {
  ratePerHour: string;
  durationHours: string;
}

interface PackageDraft {
  packageName: string;
  sessionCount: number;
  totalPrice: string;
  description: string;
}

interface TutorBundleCreatorProps {
  requestId: string;
  authToken: string;
  apiBaseUrl: string;
  onOfferSent?: (offer: unknown) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatLBP(amount: number): string {
  return new Intl.NumberFormat('en-LB', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(amount);
}

const DURATION_OPTIONS = ['1 hr', '1.5 hrs', '2 hrs', '3 hrs'];
const MAX_SESSIONS = 10;
const MIN_SESSIONS = 1;

// ---------------------------------------------------------------------------
// Sub-component: Section label
// ---------------------------------------------------------------------------
function FieldLabel({ text, required = false }: { text: string; required?: boolean }) {
  return (
    <Text style={fieldStyles.label}>
      {text}
      {required && <Text style={fieldStyles.required}> *</Text>}
    </Text>
  );
}
const fieldStyles = StyleSheet.create({
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
  },
  required: { color: Colors.error },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TutorBundleCreator({
  requestId,
  authToken,
  apiBaseUrl,
  onOfferSent,
}: TutorBundleCreatorProps) {
  const [offerType, setOfferType] = useState<OfferType>('hourly');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Hourly draft
  const [hourly, setHourly] = useState<HourlyDraft>({
    ratePerHour: '',
    durationHours: '1 hr',
  });

  // Package draft
  const [pkg, setPkg] = useState<PackageDraft>({
    packageName: '',
    sessionCount: 3,
    totalPrice: '',
    description: '',
  });

  // ── Derived: per-session price ───────────────────────────────────────────
  const totalNum = parseFloat(pkg.totalPrice.replace(/,/g, ''));
  const perSession =
    pkg.sessionCount > 0 && !isNaN(totalNum)
      ? Math.round(totalNum / pkg.sessionCount)
      : null;

  // ── Session count stepper ────────────────────────────────────────────────
  const decrementSessions = useCallback(() => {
    setPkg((prev) => ({
      ...prev,
      sessionCount: Math.max(MIN_SESSIONS, prev.sessionCount - 1),
    }));
  }, []);

  const incrementSessions = useCallback(() => {
    setPkg((prev) => ({
      ...prev,
      sessionCount: Math.min(MAX_SESSIONS, prev.sessionCount + 1),
    }));
  }, []);

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = useCallback((): string | null => {
    if (offerType === 'hourly') {
      const rate = parseFloat(hourly.ratePerHour);
      if (isNaN(rate) || rate <= 0) return 'Please enter a valid hourly rate.';
    } else {
      if (!pkg.packageName.trim()) return 'Please enter a package name.';
      const total = parseFloat(pkg.totalPrice.replace(/,/g, ''));
      if (isNaN(total) || total <= 0) return 'Please enter a valid total price.';
    }
    return null;
  }, [hourly.ratePerHour, offerType, pkg.packageName, pkg.totalPrice]);

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const body =
        offerType === 'hourly'
          ? {
              offerType: 'hourly',
              ratePerHour: parseFloat(hourly.ratePerHour),
              durationHours: parseFloat(hourly.durationHours),
              requestId,
            }
          : {
              offerType: 'package',
              packageName: pkg.packageName.trim(),
              packageSessionCount: pkg.sessionCount,
              totalPrice: parseFloat(pkg.totalPrice.replace(/,/g, '')),
              packageDescription: pkg.description.trim(),
              requestId,
            };

      const res = await fetch(`${apiBaseUrl}/marketplace/offers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text}`);
      }

      const offer = await res.json();
      setSuccess(true);
      onOfferSent?.(offer);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to send offer.');
    } finally {
      setSubmitting(false);
    }
  }, [apiBaseUrl, authToken, hourly, offerType, onOfferSent, pkg, requestId, validate]);

  // ── Success state ────────────────────────────────────────────────────────
  if (success) {
    return (
      <View style={styles.successCard}>
        <Ionicons name="checkmark-circle" size={52} color={Colors.success} />
        <Text style={styles.successTitle}>Offer Sent!</Text>
        <Text style={styles.successSubtitle}>
          The student will be notified and can accept or counter your offer.
        </Text>
        <TouchableOpacity
          style={styles.sendAnotherBtn}
          onPress={() => setSuccess(false)}
        >
          <Text style={styles.sendAnotherText}>Send another offer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Type toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleTab, offerType === 'hourly' && styles.toggleTabActive]}
          onPress={() => setOfferType('hourly')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={offerType === 'hourly' ? '#FFFFFF' : Colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleTabText,
              offerType === 'hourly' && styles.toggleTabTextActive,
            ]}
          >
            Hourly Rate
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleTab, offerType === 'package' && styles.toggleTabActive]}
          onPress={() => setOfferType('package')}
          activeOpacity={0.75}
        >
          <Ionicons
            name="layers-outline"
            size={16}
            color={offerType === 'package' ? '#FFFFFF' : Colors.textSecondary}
          />
          <Text
            style={[
              styles.toggleTabText,
              offerType === 'package' && styles.toggleTabTextActive,
            ]}
          >
            Session Package
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Hourly form ── */}
      {offerType === 'hourly' && (
        <View style={styles.formSection}>
          <FieldLabel text="Rate per hour (LBP)" required />
          <View style={styles.inputWrap}>
            <Text style={styles.currencyPrefix}>LBP</Text>
            <TextInput
              style={styles.input}
              value={hourly.ratePerHour}
              onChangeText={(v) => setHourly((h) => ({ ...h, ratePerHour: v }))}
              placeholder="e.g. 500000"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <FieldLabel text="Session duration" required />
          <View style={styles.durationRow}>
            {DURATION_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.durationChip,
                  hourly.durationHours === opt && styles.durationChipActive,
                ]}
                onPress={() => setHourly((h) => ({ ...h, durationHours: opt }))}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.durationChipText,
                    hourly.durationHours === opt && styles.durationChipTextActive,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Live total preview */}
          {hourly.ratePerHour !== '' && !isNaN(parseFloat(hourly.ratePerHour)) && (
            <View style={styles.previewBox}>
              <Ionicons name="calculator-outline" size={16} color={Colors.primary} />
              <Text style={styles.previewText}>
                Total:{' '}
                <Text style={styles.previewAmount}>
                  LBP{' '}
                  {formatLBP(
                    parseFloat(hourly.ratePerHour) *
                      parseFloat(hourly.durationHours.split(' ')[0]),
                  )}
                </Text>
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Package form ── */}
      {offerType === 'package' && (
        <View style={styles.formSection}>
          <FieldLabel text="Package name" required />
          <TextInput
            style={styles.inputFull}
            value={pkg.packageName}
            onChangeText={(v) => setPkg((p) => ({ ...p, packageName: v }))}
            placeholder="e.g. Midterm Prep Package"
            placeholderTextColor={Colors.textSecondary}
          />

          <FieldLabel text="Number of sessions" required />
          <View style={styles.stepperRow}>
            <TouchableOpacity
              style={[
                styles.stepperBtn,
                pkg.sessionCount <= MIN_SESSIONS && styles.stepperBtnDisabled,
              ]}
              onPress={decrementSessions}
              disabled={pkg.sessionCount <= MIN_SESSIONS}
            >
              <Ionicons name="remove" size={20} color={Colors.primary} />
            </TouchableOpacity>

            <View style={styles.stepperValueWrap}>
              <Text style={styles.stepperValue}>{pkg.sessionCount}</Text>
              <Text style={styles.stepperUnit}>
                {pkg.sessionCount === 1 ? 'session' : 'sessions'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.stepperBtn,
                pkg.sessionCount >= MAX_SESSIONS && styles.stepperBtnDisabled,
              ]}
              onPress={incrementSessions}
              disabled={pkg.sessionCount >= MAX_SESSIONS}
            >
              <Ionicons name="add" size={20} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <FieldLabel text="Total package price (LBP)" required />
          <View style={styles.inputWrap}>
            <Text style={styles.currencyPrefix}>LBP</Text>
            <TextInput
              style={styles.input}
              value={pkg.totalPrice}
              onChangeText={(v) => setPkg((p) => ({ ...p, totalPrice: v }))}
              placeholder="e.g. 1800000"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
            />
          </View>

          {/* Per-session live calculation */}
          {perSession !== null && (
            <View style={styles.previewBox}>
              <Ionicons name="calculator-outline" size={16} color={Colors.primary} />
              <Text style={styles.previewText}>
                Per session:{' '}
                <Text style={styles.previewAmount}>LBP {formatLBP(perSession)}</Text>
              </Text>
            </View>
          )}

          <FieldLabel text="Description" />
          <TextInput
            style={[styles.inputFull, styles.textarea]}
            value={pkg.description}
            onChangeText={(v) => setPkg((p) => ({ ...p, description: v }))}
            placeholder="Describe what's covered across the sessions..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      )}

      {/* Error */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={15} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.82}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons
              name={offerType === 'package' ? 'layers' : 'paper-plane'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.submitBtnText}>
              {offerType === 'package' ? 'Send Bundle Offer' : 'Send Hourly Offer'}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  toggleTabActive: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  toggleTabText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  toggleTabTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
  },
  formSection: {
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  currencyPrefix: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 13,
  },
  inputFull: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.text,
  },
  textarea: {
    minHeight: 100,
    paddingTop: 12,
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  durationChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  durationChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  durationChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  durationChipTextActive: {
    color: '#FFFFFF',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperValueWrap: {
    alignItems: 'center',
    minWidth: 60,
  },
  stepperValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.text,
    lineHeight: 34,
  },
  stepperUnit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  previewText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  previewAmount: {
    fontFamily: 'Inter_700Bold',
    color: Colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 17,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  successCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  successTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: Colors.text,
  },
  successSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sendAnotherBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendAnotherText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.primary,
  },
});
