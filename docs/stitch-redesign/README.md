# Stitch Redesign Context (Project `11311649648377355093`)

This directory contains the hosted screen assets, HTML prototypes, and design system specifications downloaded directly from the **HepYeni Redesign Context** project in Stitch.

---

## 1. Design Systems

| Design System | Theme Mode | Primary Palette | Key Typography | Spec File |
|---|---|---|---|---|
| **Architectural Dark** (`assets/6257bafc58b146d7b2d7f52b4f29529c`) | Dark | Luminous Teal (`#81e4ed` / `#63c8d1`), Deep Charcoal (`#0f1415`) | Geist Sans, JetBrains Mono, Source Serif 4 | [`architectural_dark.md`](./design-systems/architectural_dark.md) |
| **Architectural Curation** (`assets/3b4c440c3426469bad364c6cd5f160cb`) | Light | Architectural Purple (`#381e72` / `#4f378a`), Paper White (`#fdf7ff`) | Geist Sans, EB Garamond | [`architectural_curation.md`](./design-systems/architectural_curation.md) |

---

## 2. Screen Gallery & Artifacts

All screens downloaded via `curl -L` into local paths:

| # | Screen Name | Mode | Local Screenshot | Local HTML Code |
|---|---|---|---|---|
| 1 | **Profile - HepYeni** | Light | [`01_profile_light.png`](./screenshots/01_profile_light.png) | [`01_profile_light.html`](./html/01_profile_light.html) |
| 2 | **Admin Panel - HepYeni** | Light | [`02_admin_panel_light.png`](./screenshots/02_admin_panel_light.png) | [`02_admin_panel_light.html`](./html/02_admin_panel_light.html) |
| 3 | **My Shelf - HepYeni** | Light | [`03_my_shelf_light.png`](./screenshots/03_my_shelf_light.png) | [`03_my_shelf_light.html`](./html/03_my_shelf_light.html) |
| 4 | **My Shelf - Dark Mode** | Dark | [`04_my_shelf_dark.png`](./screenshots/04_my_shelf_dark.png) | [`04_my_shelf_dark.html`](./html/04_my_shelf_dark.html) |
| 5 | **Groups - Dark Mode** | Dark | [`05_groups_dark.png`](./screenshots/05_groups_dark.png) | [`05_groups_dark.html`](./html/05_groups_dark.html) |
| 6 | **Activity - Dark Mode** | Dark | [`06_activity_dark.png`](./screenshots/06_activity_dark.png) | [`06_activity_dark.html`](./html/06_activity_dark.html) |
| 7 | **Circle Home - Dark Mode** | Dark | [`07_circle_home_dark.png`](./screenshots/07_circle_home_dark.png) | [`07_circle_home_dark.html`](./html/07_circle_home_dark.html) |
| 8 | **Circle Home - HepYeni** | Light | [`08_circle_home_light.png`](./screenshots/08_circle_home_light.png) | [`08_circle_home_light.html`](./html/08_circle_home_light.html) |
| 9 | **Activity - HepYeni** | Light | [`09_activity_light.png`](./screenshots/09_activity_light.png) | [`09_activity_light.html`](./html/09_activity_light.html) |
| 10 | **Groups - HepYeni** | Light | [`10_groups_light.png`](./screenshots/10_groups_light.png) | [`10_groups_light.html`](./html/10_groups_light.html) |

---

## 3. Core Architectural Principles from Stitch

1. **Zero-Radius Geometric Rigor (0px Corners)**:
   - All buttons, cards, tags, and inputs use sharp 0px corners, giving an engineered, architectural blueprint aesthetic.
2. **Functional vs. Narrative Typography Split**:
   - **Functional (Geist Sans / Mono)**: Used for UI buttons, metrics, tables, navigation, and badges.
   - **Narrative (EB Garamond / Source Serif 4)**: Used for reading logs, long-form reviews, quotes, and marginalia notes.
3. **Depth via Tonal Insets & Hairline Borders**:
   - Flat plane model: 0 soft drop-shadows; separation is achieved with 1px hairline borders (`outline`) and distinct tonal surface contrast (`surface-container` tiers).
4. **Color Strategy**:
   - **Light Mode**: High-contrast editorial purple (`#381e72`) on paper-white (`#fdf7ff`) with subtle gold accents.
   - **Dark Mode**: Electric cyan/teal (`#81e4ed` / `#63c8d1`) on deep obsidian charcoal (`#0f1415`).
