# SVG Grid Designer

<img width="1920" height="1031" alt="localhost_3000_" src="https://github.com/user-attachments/assets/8b4bdb40-3dbc-4340-b057-b2d421fb661e" />

A Next.js application for creating editable SVG-based guide paths and transforming them into generated grid-like designs made from repeated pill elements.

Users can import SVG paths or draw curves directly in the app, edit anchor points and Bézier handles visually or numerically, generate offset guide lines, and render pill geometry along those paths. Numeric parameters can be controlled either by static values or by grayscale pixel maps created inside the app or uploaded from external files.

---

## Overview

SVG Grid Designer is a browser-based design tool for procedural SVG generation.

The core workflow is:

1. import or draw source curves
2. edit points and handles
3. optionally smooth corners
4. generate offset guide lines around a center line
5. place pill-shaped elements along those guide lines
6. control generation with static parameters or grayscale maps
7. preview the result live
8. export the final SVG

The original center lines are construction geometry and are hidden from export by default.

---

## Features

### Path input and editing

- Import SVG files containing path or line data
- Draw new curves directly in the app
- Support for spline / Bézier-based editing
- Edit anchor points and control handles visually
- Edit coordinates numerically through input fields
- Add, delete, and move points
- Support open and closed paths

### Guide line generation

- Treat imported or drawn paths as invisible center guide lines
- Generate offset guide lines on one or both sides
- Support constant offset values
- Support variable offset growth or decay
- Preserve curve continuity as much as possible

### Pill-based rendering

- Render pill-shaped elements along generated guide lines
- Control:
  - pill length
  - pill thickness
  - spacing between pills
  - orientation along the path
- Optionally vary these values by distance from the center line

### Corner smoothing

- Smooth sharp corners in imported or drawn paths
- Apply configurable radius-based rounding
- Reflect smoothing in both center and offset lines

### Map-driven parameter control

Every editable numeric parameter can be controlled by either:

- a static value, or
- a grayscale pixel map sampled by position

Supported use cases include controlling:

- offset distance
- offset growth / decay
- pill length
- pill thickness
- pill spacing
- smoothing radius
- falloff / amplification factors

### Grayscale map creation

- Upload grayscale value maps
- Create maps directly in the app
- Build maps using:
  - linear gradients
  - radial / circular gradients
  - grayscale shapes
- Compose maps from layered grayscale elements
- Normalize values into a 0–1 range
- Amplify sampled values using configurable constants

### Editor experience

- Live preview of guides and final geometry
- Toggle visibility of construction layers
- Zoom and pan
- Undo / redo
- Preview map overlays
- Export clean SVG output

---

## Parameter Mapping Model

A parameter can be evaluated from either a static value or a sampled grayscale map.

A typical mapping model is:

`finalValue = baseValue + mapValue * amplification`

Where:

- `baseValue` is the numeric default
- `mapValue` is sampled from the grayscale map in the range `0..1`
- `amplification` controls the influence of the map

Other mapping modes may be added later, such as multiply, override, clamp, or remap curves.

---

## Tech Stack

- **Next.js**
- **React**
- **TypeScript**
- **SVG rendering/editing in the browser**
