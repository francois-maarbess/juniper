/**
 * Juniper Design System – Color Tokens
 * Single source of truth for all UI colors.
 */

const Colors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  /** Primary dark green – buttons, active states, icons */
  primary: '#1B4332',
  /** Soft tinted green for light backgrounds / chips */
  primaryLight: '#E8F5EE',

  // ── Neutral backgrounds ────────────────────────────────────────────────────
  /** Main app background (warm off-white) */
  background: '#F8F9FA',
  /** Alternate background (slightly greener warm white) */
  backgroundAlt: '#F0F2EF',
  /** Card / surface background */
  card: '#FFFFFF',

  // ── Text ───────────────────────────────────────────────────────────────────
  /** Primary body text */
  text: '#1A1A1A',
  /** Secondary / muted text */
  textSecondary: '#6B7280',
  /** Placeholder text */
  textPlaceholder: '#9CA3AF',
  /** Inverted text (on dark backgrounds) */
  textInverse: '#FFFFFF',

  // ── Borders & dividers ─────────────────────────────────────────────────────
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

  // ── Accent ─────────────────────────────────────────────────────────────────
  /** Warm gold accent (NOT pale cream) – decorative highlights */
  accent: '#D4A574',
  accentLight: '#FDF3E7',

  // ── Semantic: Success ──────────────────────────────────────────────────────
  success: '#2E7D32',
  successLight: '#E8F5E9',

  // ── Semantic: Warning (also used for VALUE BUNDLE gold) ────────────────────
  warning: '#D4A017',
  warningLight: '#FFF8E1',

  // ── Semantic: Info ─────────────────────────────────────────────────────────
  info: '#1565C0',
  infoLight: '#E3F2FD',

  // ── Semantic: Error ────────────────────────────────────────────────────────
  error: '#C62828',
  errorLight: '#FFEBEE',

  // ── Shadow / overlay ───────────────────────────────────────────────────────
  /** Used for modal overlays */
  overlay: 'rgba(0, 0, 0, 0.45)',
  /** Subtle shadow base color */
  shadow: '#000000',

  // ── Tab bar ────────────────────────────────────────────────────────────────
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#1B4332',
  tabBarInactive: '#9CA3AF',

  // ── Input ──────────────────────────────────────────────────────────────────
  inputBackground: '#F8F9FA',
  inputBorder: '#E5E7EB',
  inputFocusBorder: '#1B4332',

  // ── Skeleton / loading placeholders ───────────────────────────────────────
  skeletonBase: '#E5E7EB',
  skeletonHighlight: '#F3F4F6',
} as const;

export type ColorKey = keyof typeof Colors;
export default Colors;
