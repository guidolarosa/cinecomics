# CineComic — Product Specification

## Overview

CineComic is a single-user web application for creating and presenting comic page showcases. The creator builds an ordered sequence of frames, each displaying a comic image (full or zoomed/panned), with synchronized audio and a live soundboard. Showcases are presented fullscreen in real time by the creator using keyboard navigation.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (latest, App Router) |
| Styling | Tailwind CSS (latest) |
| UI Components | shadcn/ui (latest) |
| Icons | Lucide |
| Deployment | Vercel |
| Asset storage | Vercel Blob (with localhost fallback via local filesystem) |
| Metadata storage | Vercel KV (Redis) — with local JSON file fallback for `localhost` |

---

## Core Concepts

### Project
A named showcase. Contains an ordered list of frames and a pool of uploaded assets and audio files.

### Asset
An uploaded image file (PNG, JPEG, WebP). Belongs to a project.

### Audio File
An uploaded audio file (MP3, WAV, OGG, M4A, FLAC). Belongs to a project. Used for background audio tracks and soundboard slots.

### Frame
A single step in the showcase sequence. Each frame has:
- A **display mode**: `full` (image fills the viewport) or `framing` (zoomed/panned crop of the image)
- A **crop region**: a rectangle (x, y, width, height as percentages) drawn by the user on the image — only used in `framing` mode
- **Audio settings** (see below)
- **Soundboard slots** (see below)

---

## Data Model

```
Project
  id: string
  name: string
  createdAt: timestamp
  frames: Frame[]          // ordered array
  assets: Asset[]
  audioFiles: AudioFile[]

Frame
  id: string
  order: number
  assetId: string          // reference to Asset
  displayMode: 'full' | 'framing'
  crop: { x: number, y: number, width: number, height: number } | null
    // percentages (0–100) relative to original image size
    // null when displayMode = 'full'
  audio:
    backgroundAction: 'start' | 'stop' | 'none'
    backgroundAudioId: string | null   // which AudioFile to start (if action='start')
    fadeOutDuration: number            // seconds, used when action='stop'
  soundboard: SoundboardSlot[9]        // fixed 9 slots

SoundboardSlot
  audioFileId: string | null           // null = empty slot

Asset
  id: string
  filename: string
  url: string              // Vercel Blob URL or local path
  mimeType: string
  width: number
  height: number           // original dimensions in px

AudioFile
  id: string
  filename: string
  url: string
  mimeType: string
```

---

## Features

### 1. Dashboard

- Lists all projects in a card grid (name, thumbnail of first frame, frame count)
- Actions: **Create project**, **Open**, **Delete**
- No authentication — single user, direct access

### 2. Project Editor

The main editing interface. Two panels:

#### Left panel — Frame sequence
- Ordered list of frames (thumbnails)
- Drag to reorder
- Add frame button
- Delete frame button
- Clicking a frame selects it and loads it in the right panel

#### Right panel — Frame editor
Shows the selected frame with full editing controls:

**Image picker**
- Select from assets already uploaded to the project, or upload a new one

**Display mode toggle**
- `Full` — image fills the viewport, no crop
- `Framing` — enables the crop tool

**Crop tool** (only in `Framing` mode)
- Renders the image at a fixed canvas size
- User draws a rectangle by click-dragging over the image
- Rectangle can be resized and repositioned after drawing
- Coordinates are stored as percentages so they are resolution-independent
- A small preview shows how the cropped view will look

**Audio settings**
- Background action: `None` / `Start` / `Stop`
  - If `Start`: audio file picker (from project's audio pool) + optional fade-in duration
  - If `Stop`: fade-out duration (default 2s)
- Soundboard: 9 slots labeled 1–9
  - Each slot has an audio file picker (from project's audio pool) + a clear button
  - Empty slots are silent when triggered

**Asset & audio management panel** (accessible from editor sidebar)
- Upload images → stored in Vercel Blob, added to project asset pool
- Upload audio files → stored in Vercel Blob, added to project audio pool
- Delete assets/audio (warns if in use by a frame)

### 3. Preview / Presentation Mode

Entered from the editor via a **Present** button. Opens fullscreen with no UI chrome.

#### Display
- Current frame renders according to its `displayMode`:
  - `Full` — image fills the screen (object-fit: contain or cover, TBD)
  - `Framing` — viewport shows only the defined crop region, scaled to fill the screen
- **Transition animation** between frames: smooth CSS/JS pan and zoom from the previous frame's crop/position to the new one (duration ~600ms, ease-in-out)
  - If both frames are `full`, transition is a simple crossfade
  - If either frame is `framing`, transition animates position and scale

#### Keyboard controls
| Key | Action |
|---|---|
| `→` / `Space` | Next frame |
| `←` | Previous frame |
| `1`–`9` | Trigger soundboard slot for current frame (one-shot, non-exclusive) |
| `Esc` | Exit fullscreen and return to editor |

#### Audio behavior
- When advancing to a frame with `backgroundAction: 'start'`: begin playing the assigned audio file (looping)
- When advancing to a frame with `backgroundAction: 'stop'`: fade out current background audio over `fadeOutDuration` seconds
- Background audio state carries forward — if a frame has `action: 'none'`, whatever was playing continues
- Soundboard keys 1–9 play the assigned audio file once (fire-and-forget, does not interrupt background audio)

---

## Storage Strategy

| Environment | Asset/Audio storage | Metadata storage |
|---|---|---|
| `localhost` | Local filesystem (`/uploads/` dir, served by Next.js API route) | JSON file (`/data/projects.json`) |
| Vercel | Vercel Blob | Vercel KV |

The storage layer is abstracted behind a thin interface (`lib/storage.ts`) that switches implementation based on `process.env.STORAGE_BACKEND` (`local` | `vercel`).

---

## Out of Scope (v1)

- Multi-user / authentication
- PDF upload
- Video assets
- Global (cross-frame) audio tracks
- Public sharing / embeds
- Analytics
- Undo/redo in editor
- Mobile / touch support

---

## Open Questions (deferred)

- Crossfade vs. cut when transitioning between two `full` frames — decide during implementation
- Whether soundboard slots persist their audio state if the user navigates away and back (likely reset on presentation start)
- Maximum asset file size limit for Vercel Blob uploads
