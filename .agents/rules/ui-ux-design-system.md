# UI/UX & Product Design System Rules

These rules govern all UI, UX, front-end architecture, and visual design tasks across the workspace. When creating, modifying, or reviewing user interfaces (React Native, React, Web), apply these principles unconditionally to achieve world-class aesthetics, seamless ergonomics, and delightful micro-interactions.

---

## 1. Visual Hierarchy & Typography
- **One Primary Action per Viewport:** Every screen or modal must have a single obvious primary call-to-action (CTA). Secondary actions must use subdued borders, ghost styles, or muted surfaces.
- **Font Scale & Weights:**
  - **Display / Hero Titles:** Bold or Editorial Serif (`Georgia` / `Inter_700Bold`), tracking `-0.4px` to `-0.8px`, leading `1.15x - 1.25x`.
  - **Section Headings:** `Inter_600SemiBold` / `Inter_700Bold`, clear margin top (`24-32px`) and minimal margin bottom (`4-8px`).
  - **Body Copy:** `Inter_400Regular`, font-size `14-16px` (web) or `14-15pt` (mobile), line-height `1.5x - 1.6x`, color `mutedForeground` or charcoal.
  - **Eyebrows & Micro-labels:** `Inter_600SemiBold`, uppercase or capitalized, letter spacing `+0.5px` to `+0.8px`, smaller font size (`10-12px`).
- **Optical Balance:** Always optically center icons with text. Ensure labels don't clip, wrap awkwardly, or leave single orphan words.

---

## 2. Color, Surfaces & Elevation
- **Semantic Tokens Only:** Never hardcode raw hex values directly inside components. Use the design system tokens (`colors.background`, `colors.primary`, `colors.card`, `colors.border`, `colors.mutedForeground`, etc.).
- **Palette Depth:**
  - Avoid raw pure black (`#000000`) on stark white (`#FFFFFF`). Prefer rich slates, dark charcoals, and warm off-whites/creams (`#F7F6EF`, `#FAFAF9`).
  - Cards and elevated surfaces should use subtle borders (`1px solid colors.border`) combined with soft, diffuse shadows (`shadowOpacity: 0.04 - 0.08`, `shadowRadius: 8-16px`).
- **Accessibility & Contrast (WCAG AA/AAA):**
  - Text contrast against background must meet at least `4.5:1` (normal text) and `3:1` (large text).
  - Never convey status or validation solely through color; always pair with an icon or descriptive label.

---

## 3. Ergonomics & Touch Targets (Mobile-First)
- **Minimum Tap Target:** Every touchable or interactive element must have a minimum hit area of `44 × 44 pt`. Add padding or `hitSlop` when the visual icon is smaller.
- **Thumb-Zone Optimization:** Key actions, sheet dismissals, and primary triggers should sit comfortably in the lower two-thirds of the screen on mobile devices.
- **Safe Area Insets:** Always wrap mobile screens with `SafeAreaView` or apply `useSafeAreaInsets()` to prevent UI clipping under notches, dynamic islands, or bottom home bars.
- **Keyboard Adaptation:** Ensure all text input forms are wrapped in keyboard-aware scrolling containers so fields never get obscured by the virtual keyboard.

---

## 4. Micro-Interactions, Feedback & States
Every interactive component must account for the **5 Core UI States**:
1. **Default / Idle:** Clean, legible, inviting.
2. **Hover / Pressed:** Immediate tactile visual feedback (`opacity: 0.8`, subtle scale down `0.98`, or darker surface tint).
3. **Focused:** High-contrast focus ring (`2px` outline with offset) for keyboard accessibility.
4. **Loading / Processing:**
   - Action buttons: show an integrated spinner or pulse, preserve button dimensions, and disable redundant clicks.
   - Content views: display shimmering skeleton placeholders rather than empty blank containers.
5. **Disabled:** Subdued opacity (`0.4 - 0.5`) with `pointerEvents: 'none'`.

---

## 5. Forms, Validation & Error Recovery
- **Inline, Specific Validation:** When an input fails validation, pinpoint the exact requirement (e.g. *"Must be at least 30 characters (currently 13)"*) right beneath the field or in a clear alert banner.
- **Never Clear User Data on Error:** Preserve all filled input state during errors or network failures.
- **Auto-Formatting & Sensible Defaults:**
  - Auto-capitalize names and capitalize sentences in biographies.
  - Format phone numbers, currencies, and dates progressively as the user types.
  - Set appropriate `keyboardType` (`decimal-pad`, `email-address`, `number-pad`).

---

## 6. Layout Grids & Rhythm
- **8-Point Grid System:** All paddings, margins, gaps, and heights must be multiples of 4 or 8 (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`).
- **Cohesive Border Radii:**
  - Small tags/badges/chips: `6 - 10px`
  - Form inputs & buttons: `12 - 14px`
  - Cards & containers: `16 - 20px`
  - Bottom sheets & modals: `24 - 32px`
