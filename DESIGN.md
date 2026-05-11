---
name: Job Tracker
description: A personal job-search management system and gap analyzer.
colors:
  primary: "#2563eb"
  neutral-bg: "#f9fafb"
  neutral-bg-dark: "#020617"
  semantic-success: "#16a34a"
  semantic-warning: "#ca8a04"
  semantic-error: "#dc2626"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.75rem
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.25rem
rounded:
  md: "0.375rem"
  full: "9999px"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  badge:
    rounded: "{rounded.full}"
    padding: "0.125rem 0.625rem"
---

# Design System: Job Tracker

## 1. Overview

**Creative North Star: "The Flow Engine"**

The interface is designed to be seamless, minimal, and frictionless. As an internal personal tool, it avoids the bloated patterns common to SaaS dashboards and sticks strictly to utility. Data stands out while the UI recedes, enabling fast assessment of CV gaps. The tone is confident and professional without being heavy.

**Key Characteristics:**
- Content-first and highly readable.
- Functional and tactical application of colors.
- Soft, approachable surfaces inside a structured, layered hierarchy.

## 2. Colors

Functional & Tactical: Colors exist strictly to signal state, action, or importance.

### Primary
- **Action Blue** (`#2563eb`): Used for primary calls to action (Add Job), active navigation states, and domain tagging limits.

### Semantic
- **Success Green** (`#16a34a`): Signals high AI-matched scores and positive status (Active).
- **Warning Yellow** (`#ca8a04`): Signals medium-matched scores and pending states.
- **Error Red** (`#dc2626`): Signals low scores and negative status (Deleted).

### Neutral
- **Canvas Gray** (`#f9fafb`): The default light-mode backdrop, providing low contrast against white cards.
- **Deep Slate** (`#020617`): The dark-mode canvas, prioritizing low eye strain during intense reading sessions.

### Named Rules
**The Tool Over Toy Rule.** UI Chrome remains neutral. Saturated colors are reserved exclusively for the data itself (scores, statuses, gaps) and primary actions.

## 3. Typography

**Display Font:** System Sans (Inter, San Francisco, etc.)
**Body Font:** System Sans
**Label/Mono Font:** ui-monospace (for code or exact tags)

**Character:** Standard, reliable, and invisible to the user. Fast parsing is prioritized over unique brand expression.

### Hierarchy
- **Display** (Bold, 1.25rem): Page headers and modal titles.
- **Headline** (Medium, 1.125rem): Section groupings and major data points.
- **Body** (Regular, 0.875rem): Job descriptions, requirements, and general content.
- **Label** (Medium, 0.75rem): Badges, table headers, and functional metadata.

### Named Rules
**The Density Rule.** Body text for job requirements must be easily scannable; do not let line lengths bleed past 75 characters on desktop.

## 4. Elevation

Layered structure: Subtle shadows define content containers, lifting them off the neutral backdrop to create hierarchy. 

### Shadow Vocabulary
- **Container Lift** (`box-shadow: 0 1px 3px rgba(0,0,0,0.1)`): Standard resting state for cards, modals, and persistent headers traversing over content.

## 5. Components

Components are built to feel "Soft & Approachable" with generous padding and rounded corners, contrasting the tool's strict utility with a comfortable interaction layer.

### Buttons
- **Shape:** Rounded medium (`0.375rem`).
- **Primary:** Action Blue (`#2563eb`) with white text and balanced horizontal padding.
- **Hover / Focus:** Deepens in saturation, with a clear focus ring that maintains accessibility.

### Badges / Tags
- **Style:** Fully rounded (`9999px`) pill shapes.
- **State:** Tinted backgrounds based on semantic color groupings (e.g. 10% opacity background of the text hue). 

### Cards / Containers
- **Corner Style:** Rounded medium.
- **Background:** Pure white or dark slate, elevated above the canvas using shadows.
- **Shadow Strategy:** Layered (see Elevation).
- **Internal Padding:** Generous (`1rem` minimum for structural cards).

### Inputs / Fields
- **Style:** Approachable, clear boundaries with generous text padding to prevent cramping.
- **Focus:** Highlighted with Action Blue.

## 6. Do's and Don'ts

### Do:
- **Do** rely on the semantic colors strictly for data values.
- **Do** keep components approachable with padding; don't pack data so tight it becomes unreadable.
- **Do** utilize the system's "Layered" elevation schema to separate cards from the page background.

### Don't:
- **Don't** use cluttered SaaS templates or excessive padding that wastes vertical space.
- **Don't** implement corporate enterprise software patterns.
- **Don't** use heavy, slow-loading decorative elements like background gradients or glassmorphism.
