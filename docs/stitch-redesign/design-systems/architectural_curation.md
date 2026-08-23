---
name: Architectural Curation
id: assets/3b4c440c3426469bad364c6cd5f160cb
colors:
  surface: '#fdf7ff'
  surface-dim: '#ded8e0'
  surface-bright: '#fdf7ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f2fa'
  surface-container: '#f2ecf4'
  surface-container-high: '#ece6ee'
  surface-container-highest: '#e6e0e9'
  on-surface: '#1d1b20'
  on-surface-variant: '#494551'
  inverse-surface: '#322f35'
  inverse-on-surface: '#f5eff7'
  outline: '#7a7582'
  outline-variant: '#cbc4d2'
  surface-tint: '#6750a4'
  primary: '#381e72'
  on-primary: '#ffffff'
  primary-container: '#4f378a'
  on-primary-container: '#c0a7ff'
  inverse-primary: '#d0bcff'
  secondary: '#63597c'
  on-secondary: '#ffffff'
  secondary-container: '#e1d4fd'
  on-secondary-container: '#645a7d'
  tertiary: '#765b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#624000'
  on-tertiary-container: '#dead66'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e9ddff'
  primary-fixed-dim: '#d0bcff'
  on-primary-fixed: '#22005c'
  on-primary-fixed-variant: '#4f378a'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#cdc0e9'
  on-secondary-fixed: '#1f1635'
  on-secondary-fixed-variant: '#4b4263'
  tertiary-fixed: '#ffddb1'
  tertiary-fixed-dim: '#f0be75'
  on-tertiary-fixed: '#291800'
  on-tertiary-fixed-variant: '#624000'
  background: '#fdf7ff'
  on-background: '#1d1b20'
  surface-variant: '#e6e0e9'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-base:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  quote-editorial:
    fontFamily: EB Garamond
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.5'
  marginalia-label:
    fontFamily: EB Garamond
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 24px
  max-width-desktop: 1200px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system evolves into an **Architectural Minimalism** style, prioritizing structure, geometry, and precision. It rejects the soft, approachable curves of traditional social platforms in favor of a sophisticated, editorial aesthetic that feels permanent and intentional.

The brand personality is intellectual, disciplined, and refined. By utilizing a strictly geometric visual language, the UI recedes into a background framework—much like a gallery's white walls—allowing the curated media and personal reflections to command full attention.

**Key Stylistic Pillars:**
- **Geometric Rigor:** Every element is defined by 90-degree angles, creating a sense of stability and architectural order.
- **Structural Integrity:** Use of borders and rhythmic spacing rather than shadows to define boundaries.
- **Monolithic Beauty:** Large blocks of color and stark transitions that emphasize the digital canvas's "built" nature.

## Colors

The palette is rooted in a sophisticated range of purples and neutrals, utilizing high-contrast pairings to define structural boundaries.

- **Primary & Secondary:** These tones provide the "ink" for the system, used for high-intent actions and structural accents.
- **Surface Strategy:** The system uses a tiered surface model (`surface` through `surface-container-highest`) to create depth without relying on shadows.
- **Achromatic Foundations:** While the brand colors are present, the functional UI relies on a disciplined use of the `outline` and `surface` tokens to maintain a neutral, gallery-like environment for user content.

## Typography

The typography strategy employs a "Functional vs. Narrative" split to reinforce the architectural feel.

- **Functional (Geist):** A technical, sharp sans-serif used for navigation, headers, and UI controls. Its precise geometry complements the sharp-cornered UI.
- **Narrative (EB Garamond):** A classic serif used for personal reflections and labels. It provides a humanistic counterpoint to the rigid grid, signaling "reading time" vs. "navigation time."

**Hierarchy Rules:**
- All functional labels and buttons must use Geist to maintain a "tool-like" clarity.
- Long-form content and user-generated reviews must transition to EB Garamond to prioritize legibility and a literary atmosphere.

## Layout & Spacing

This design system uses a **Fluid Grid** with strict adherence to a 4px baseline.

- **Grid Model:** 12-column grid for desktop, 4-column for mobile. Elements should span columns cleanly, avoiding fractional alignments to preserve the geometric aesthetic.
- **Rhythm:** Spacing is used as a structural tool. Instead of white space being "empty," it is treated as a deliberate architectural void.
- **Fixed Constraints:** All media containers must adhere to standardized aspect ratios (2:3 for books/posters, 1:1 or 16:9 for others) to ensure the grid never feels broken or organic.

## Elevation & Depth

In this architectural system, depth is conveyed through **Bold Borders** and **Tonal Layers** rather than shadows.

- **The Plane Model:** Surfaces do not "float"; they are "stacked" or "inset."
- **Borders:** Use 1px or 2px solid borders (`outline` or `outline-variant`) to define all component boundaries. This replaces shadows as the primary means of separation.
- **Tonal Tiers:** Use the `surface-container` tokens to indicate hierarchy. A darker surface sits "lower" or acts as a well, while a brighter surface sits "higher" or acts as a foreground element.
- **Zero-Shadow Policy:** Shadows are entirely removed. In rare cases where a floating element is required (e.g., a dropdown), use a high-contrast 1px border and a solid 4px offset "block shadow" using a neutral color to maintain the geometric theme.

## Shapes

The shape language is strictly **Geometric and Sharp**.

All components—without exception—utilize a 0px border radius. This creates a cohesive, high-fashion editorial look that feels engineered rather than grown. This applies to:
- **Buttons and Inputs:** Precise rectangles.
- **Cards and Containers:** Sharp-edged blocks.
- **Avatars:** Strictly square (no circles), emphasizing the individual as a framed piece of content.
- **Chips:** Rectangular tags with 1px borders.

## Components

- **Buttons:** Buttons are strictly rectangular. Primary buttons use solid fills with high-contrast text. Secondary buttons are defined by a 1px `outline` border. On hover, buttons should swap colors (inverse) or shift tonal values instantly—no soft transitions.
- **Cards:** Cards are defined by their borders and internal grid. No rounded corners or shadows. The separation between the "Media" (image) and "Metadata" (text) should be marked by a internal 1px horizontal line, creating a "blueprint" feel.
- **Inputs:** Inputs are rectangular blocks with a 1px `outline` border. On focus, the border weight increases to 2px or changes to the `primary` color. Placeholder text uses `label-sm` for a technical look.
- **Avatars:** Avatars are square. To differentiate them from media thumbnails, they should always include a 1px inset border or a subtle frame to signify their status as "User Entities" within the system.
- **Chips & Tags:** Unlike traditional pill-shaped chips, these are small rectangles. They function as "labels" rather than "buttons," often using the Serif typography (`marginalia-label`) for a sophisticated, archival look.
- **Checkboxes & Radios:** Standardize on square boxes for both checkboxes and radio buttons (radio buttons can be distinguished by a smaller internal square when selected) to maintain the "0px radius" mandate across the entire UI.
