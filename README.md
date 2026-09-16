# Orionis AR Experience

A browser-based augmented-reality company overview for **Orionis Tech Ltd.** There's no app to install: open the link on a phone and point the camera at the printed Orionis marker.

It recreates the reference AR brochure (`6b668614-….mp4`) beat for beat, using Orionis branding and content:

| Beat | What happens |
|---|---|
| Marker found | The hologram ring draws itself in, service tabs slide out onto the page, and case-study cards fly up and hover |
| Hatch | The hexagonal logo lid irises open into a glowing shaft |
| Presenter | **Orion**, the Orionis robot guide, rises on a lift, jumps and talks for about 45s (neural voice, captions, gestures) |
| Outro | Orion waves, sinks back down, and the hatch closes |
| Cards | Tap a card to expand it into a tilted panel: back tab, title, story, big number, **PLAY VIDEO** |
| Services | Tap a ring tab to bring up an **interactive hologram** plus a service panel (tap the hologram to interact) |
| Video | PLAY VIDEO irises the hatch open and a 9:16 screen rises out playing the Orionis story reel (with a fullscreen option) |
| Extras | Plan → Build → Scale → Maintain badges orbit the hatch; tap the closed lid to summon Orion; drag to rotate and pinch to scale (AR) |
| HUD | Home (replay), Info (about + WhatsApp/email), captions toggle, Exit, and a scan hint when the marker is lost |

## Quick start

```bash
npm install
npm run dev            # https://localhost:5173 and https://<your-LAN-IP>:5173
```

- **Phone:** open `https://<LAN-IP>:5173` (accept the self-signed certificate), tap **Start AR**, and aim at the marker.
- **Laptop, no camera:** click **Preview without camera**, or open `/?preview&autostart`.
- **Marker:** print `marker/orionis-marker.pdf` (A4 landscape), or show `marker/orionis-marker.png` on another screen.

## Build and deploy

```bash
npm run build          # static site in dist/
```

Upload `dist/` to any HTTPS static host. Camera access **requires HTTPS**.

**Vercel (current setup):** this repo is connected to Vercel, and every push to `main` redeploys automatically.
Build settings come from [`vercel.json`](vercel.json): `npm ci`, then `npm run build`, serving `dist/`.
[`.npmrc`](.npmrc) skips install scripts so the build doesn't download Chrome (Puppeteer) or compile `canvas`. Both are only needed by the local `tools/`.
If you run the tools locally after a fresh clone, install Chrome for Puppeteer once with `npx puppeteer browsers install chrome`.

## Editing content

Everything textual lives in [`src/content/content.json`](src/content/content.json): company info, the 6 services, the case studies, the process steps and the presenter script.

- **Case studies 2–5 are fictional samples** and are labelled "Sample project" in AR. Replace them with real projects before public use.
- **Changed the presenter script?** Regenerate the voice and caption timings: `npm run make:voice` (needs `pip install edge-tts`).
  To use a real recording instead, replace `public/audio/voiceover.mp3` and adjust `public/audio/voiceover-cues.json`.
- **New story video?** Drop it in the project root as `WhatsApp Video*.mp4` and run `npm run prep:media`, or place any 9:16 mp4 at `public/media/orionis-story.mp4`.
- **Changed the service labels or layout?** Re-run `npm run make:marker && npm run compile:target`, then reprint the marker.

## Project layout

```
src/
  main.js                 boot, mode select (AR / preview), render loop
  ar/tracker.js           camera + MindAR image tracking → three.js anchor
  ar/preview.js           desk + marker scene with orbit camera (no camera needed)
  timeline/Director.js    show flow: intro → talk → outro → idle ⇄ panel / service / video
  timeline/Voice.js       narration, caption cues, voice level for lip/head motion
  scene/                  Ring, Hatch (iris + shaft + lift), Presenter, ServiceTabs,
                          FloatingCards, Panel, VideoScreen, ProcessOrbit, holograms/*
  ui/                     HUD overlay (start, loading, buttons, captions, info sheet)
  util/brand.js           colours, logo, icons, and the layout shared by the marker and the AR
tools/                    make-marker, compile-target, make-voice, prep-media, screenshots
public/                   model, audio, media, tracking target
marker/                   printable marker (PDF/PNG/SVG)
```

## Credits

- Presenter model: *RobotExpressive* by Tomás Laulhé (Quaternius), CC0, via the three.js examples.
- Tracking: [MindAR](https://github.com/hiukim/mind-ar-js) (MIT). Rendering: three.js. Animation: GSAP.
- Voice: Microsoft Edge neural TTS (`en-US-AndrewNeural`) via `edge-tts`.
