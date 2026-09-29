# DON'T CLICK ANYTHING

A frontend-only interactive horror experience built with React, Vite, and Framer Motion. The fear state progresses through seven authored stages based on interaction and idle time. The visual escalation uses an original generated hallway image, CSS simulated CCTV, and the supplied monster image for the jump-scare, with glitch, scanline, red-pulse, and lunge effects. Clicking “I'M NOT SCARED” changes only that button's message and styling. Local MP3 files power the suspense music, a five-second right-channel knock cue, and the jump-scare sound. The app has no YouTube embeds, does not request camera or microphone access, and does not collect personal information.

## Run locally

1. Install Node.js (20.19 or newer).
2. Run `npm install`.
3. Run `npm run dev` and open the URL printed by Vite.
4. Run `npm run build` to create the production bundle.

## Project structure

- `src/App.jsx` — warning screen, fear progression, audio, simulated CCTV, finale
- `src/styles.css` — cinematic visual effects and responsive layout
- `src/main.jsx` — React entry point
- `index.html` — Vite document shell
- `public/hallway-night.png` — original generated horror scene
- `public/jumpscare-monster.png` — user-provided jump-scare image
- `public/main.mp3.ogg` — suspense music throughout the experience
- `public/doorknock.mp3.ogg` — louder five-second mid-experience cue, panned right where supported
- `public/jumpscare.mp3.ogg` — starts as the jump-scare image appears

The supplied files use Ogg audio data with `.mp3.ogg` filenames, so the app references those exact files. Audio is muted on the start screen and playback begins from the ENTER click to respect browser autoplay restrictions. Use the visible sound toggle to mute or unmute; there are no visible audio player controls. The knock is slightly louder than the background track, and the suspense/knock tracks fade or stop before the jump-scare sound begins. Interactions are local to the current page session.
