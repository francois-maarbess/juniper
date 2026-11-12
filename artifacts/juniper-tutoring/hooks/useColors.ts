import colors from '@/constants/colors';

/**
 * Returns the design tokens for the Juniper "Deep Green" theme.
 * The signature dark forest + soft beige design system is always applied so the
 * product reads identically on every device regardless of OS color scheme.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
