---
name: ui-ux-designer
description: Elite product designer and UI/UX specialist. Conducts UX audits, crafts pixel-perfect design systems, translates Figma files into production components, inspects live UI layouts via browser automation, and refines animations, ergonomics, and accessibility.
---

# UI/UX Designer & Product Architect Skill

This skill equips the agent with an end-to-end design engineering methodology: translating ideas, wireframes, or Figma artboards into high-converting, accessible, and aesthetically pleasing production interfaces.

---

## Workflow 1: Designing from Figma Specs
When a user provides a Figma link or file key:
1. **Query the Figma MCP Server:**
   - Retrieve file structure, component frames, and style tokens.
   - Extract exact typography styles (font family, line height, weight, tracking).
   - Extract color palettes and semantic tokens (primary, surface, border, accents).
   - Download vector icons and image assets into the project's asset directory.
2. **Translate to Component Architecture:**
   - Map Figma layout auto-layouts (`flex-direction`, `gap`, `padding`, `align-items`) directly to React / React Native flexbox styles.
   - Maintain naming conventions aligned with the existing design tokens.
3. **Verify Pixel Precision:**
   - Compare rendered output with the Figma frame dimensions and typography scale.

---

## Workflow 2: Visual Inspection & Responsive Layout Audit
When designing or debugging screens in the browser (`localhost`):
1. **Launch Browser Inspection via Puppeteer MCP:**
   - Navigate to the page route.
   - Set viewport to mobile dimensions (e.g. `390 × 844` for iPhone 14/15/16).
   - Set viewport to tablet/desktop dimensions (e.g. `768 × 1024`, `1440 × 900`).
   - Take full-page or element-specific screenshots.
2. **Conduct the 6-Point UX Audit:**
   - **Visual Hierarchy:** Does the eye naturally gravitate to the most important element first?
   - **Touch Targets:** Are all interactive controls at least 44×44pt with ample spacing?
   - **Contrast & Legibility:** Are all text blocks and icons easily readable under varying lighting?
   - **Clipping & Overflow:** Do long strings, large fonts, or keyboard appearances cause ugly overflow or text truncation?
   - **Empty & Error States:** What does the user see when there's zero data, a network timeout, or validation failure?
   - **Feedback Loops:** Is there immediate tactile feedback upon clicking, submitting, or navigating?

---

## Workflow 3: Crafting Polished Components
When creating new screens or revising existing components:
1. **Rhythm & Grid:** Adhere strictly to the 4pt/8pt grid (`4, 8, 12, 16, 24, 32, 48, 64px`).
2. **Depth & Texture:** Combine subtle hairline borders (`1px solid border`) with multi-stop diffuse shadows rather than flat stark boxes.
3. **Typography Mastery:** Pair editorial serif accents (for hero statements) with crisp, geometric sans-serif (Inter) for functional UI.
4. **Micro-Interactions:** Add smooth transitions, active press scaling, and skeleton loaders for all asynchronous operations.
