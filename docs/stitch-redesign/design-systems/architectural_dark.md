---
name: Architectural Dark
id: assets/6257bafc58b146d7b2d7f52b4f29529c
colors:
  surface: '#0f1415'
  surface-dim: '#0f1415'
  surface-bright: '#353a3a'
  surface-container-lowest: '#0a0f0f'
  surface-container-low: '#181c1d'
  surface-container: '#1c2021'
  surface-container-high: '#262b2b'
  surface-container-highest: '#313636'
  on-surface: '#dfe3e3'
  on-surface-variant: '#bdc9ca'
  inverse-surface: '#dfe3e3'
  inverse-on-surface: '#2c3132'
  outline: '#879394'
  outline-variant: '#3e494a'
  surface-tint: '#71d6df'
  primary: '#81e4ed'
  on-primary: '#00363a'
  primary-container: '#63c8d1'
  on-primary-container: '#005258'
  inverse-primary: '#006970'
  secondary: '#a9cdd1'
  on-secondary: '#103539'
  secondary-container: '#294c4f'
  on-secondary-container: '#97bcbf'
  tertiary: '#ffc9ac'
  on-tertiary: '#532200'
  tertiary-container: '#fca470'
  on-tertiary-container: '#76380c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#8ff2fb'
  primary-fixed-dim: '#71d6df'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#c4e9ed'
  secondary-fixed-dim: '#a9cdd1'
  on-secondary-fixed: '#002022'
  on-secondary-fixed-variant: '#294c4f'
  tertiary-fixed: '#ffdbc9'
  tertiary-fixed-dim: '#ffb68d'
  on-tertiary-fixed: '#331200'
  on-tertiary-fixed-variant: '#733609'
  background: '#0f1415'
  on-background: '#dfe3e3'
  surface-variant: '#313636'
typography:
  display-lg:
    fontFamily: Geist
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: 0em
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  quote-editorial:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.5'
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  container-max: 1280px
---

## Brand & Style

The design system is an exercise in structural precision and digital brutalism, optimized for high-fidelity dark environments. It caters to a sophisticated audience that values clarity, technical rigor, and editorial depth.

The aesthetic is **Architectural Minimalism**. It utilizes a "near-black" foundation to reduce eye strain while maintaining maximum contrast for critical information. The interface should feel like a well-drafted blueprint—intentional, structured, and authoritative. Space is used as a functional tool rather than just a decorative element, with a strict adherence to grid systems and a total rejection of organic, rounded forms in favor of sharp, 0px corners.

## Colors

The palette is strictly functional, relying on a deep charcoal base to provide a sense of infinite depth.

- **Primary & Accent:** A luminous Teal (`oklch(0.75 0.1 195)`) serves as the sole beacon of color. It is used for interactive states, primary actions, and critical data points.
- **Background:** A stable, desaturated Deep Charcoal (`oklch(0.15 0.01 264)`) forms the canvas, ensuring that the primary teal appears to glow with purpose.
- **Surfaces:** Achromatic grays are used to create layers. These surfaces are neutral and devoid of chroma to prevent interference with the primary accent color.
- **Contrast:** High accessibility is maintained through stark white or high-gray text against the near-black background.

## Typography

The typographic system is split between technical precision and editorial grace.

- **UI & Interface:** `Geist Sans` is the workhorse. It provides a geometric, clean, and highly legible experience. Headlines use tight tracking and heavy weights to command attention.
- **Technical/Data:** `Geist Mono` or `JetBrains Mono` is used for metadata, timestamps, and secondary labels, reinforcing the architectural nature of the design.
- **Editorial Quotes:** For narrative or long-form content highlights, `Source Serif 4` is used. This provides a classical, authoritative break from the otherwise technical UI.

## Layout & Spacing

This design system employs a **Fixed Grid** model on desktop and a **Fluid Grid** on mobile.

- **Grid:** A 12-column grid system is used for desktop (1280px max-width). Gutters are fixed at 24px to ensure breathing room between high-contrast elements.
- **Rhythm:** All spacing (margins, padding) must be a multiple of the 4px base unit.
- **Alignment:** Elements should be strictly aligned to the grid. Inset padding within components should be generous (typically 24px or 32px) to prevent the "sharp" corners from feeling cramped.
- **Adaptive Rules:** On mobile, margins reduce to 16px. Typography scales down specifically for display and headline roles to ensure no more than 2-3 words are wrapped per line.

## Elevation & Depth

In this dark mode environment, depth is communicated through **Tonal Layering** and **High-Contrast Outlines** rather than soft shadows.

1. **Base:** The lowest level (`oklch(0.15 0.01 264)`).
2. **Surface:** Elevated containers use a slightly lighter achromatic gray (`#1C1C1C`) with a subtle 1px border (`#2A2A2A`).
3. **Interaction:** Elements do not "float" with shadows; they highlight. Hover states are signaled by a color shift to the primary Teal or a change in border intensity.
4. **Dividers:** Use 1px solid lines with low opacity (10-15% white) to define structure without adding visual noise.

## Shapes

The shape language is **strictly orthogonal**.

- **Corners:** All UI elements—buttons, cards, inputs, and modals—must have a 0px border radius.
- **Consistency:** This "Sharp" aesthetic is non-negotiable. It reinforces the architectural and technical narrative of the design system.
- **Focus States:** Focus indicators should be 2px solid Teal offsets, maintaining the sharp corners of the element they surround.

## Components

- **Buttons:** Primary buttons are solid Teal with black text (`#000000`). Secondary buttons are transparent with a 1px white or teal border. All are 0px radius.
- **Inputs:** Input fields use a dark background (`#101010`) with a bottom-only or full 1px border. Focus state triggers a full Teal border.
- **Cards:** Cards should not use shadows. They are defined by their background color (`#1C1C1C`) and a 1px stroke.
- **Chips/Labels:** Small, rectangular tags using `Geist Mono` in all-caps. These function as metadata markers.
- **Lists:** Separated by thin, 1px horizontal rules. Interactive list items should have a Teal left-border highlight on hover (2px width).
- **Quotes:** Large editorial quotes are indented, using `Source Serif 4` and a Teal vertical accent bar on the left.
