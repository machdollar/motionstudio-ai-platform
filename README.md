# MotionStudio AI — Creator Workspace

A responsive, static front-end starter for a creator-focused AI workspace. It is intentionally a separate project and does not contain pricing, checkout, or subscription sections.

## Included tools

- **Overview dashboard** with navigation to each workflow.
- **AI Video Studio** — creates structured video-generation briefs from a prompt, visual style, duration, aspect ratio, camera movement, and model family.
- **Viral Shorts Production Pack** — ranks clip opportunities, creates platform-specific titles/descriptions/hashtags, adds audience and style direction, preserves timestamps supplied in transcript lines, estimates timestamps when none are provided, and exports TXT, CSV, and SRT drafts.
- **Image & Motion** — locally previews a reference image and creates an image/video creative-direction brief.
- **UGC & Ad Studio** — builds a scene-by-scene product ad storyboard.
- **Scriptwriter** — drafts a structured video script outline.
- **Voice & Captions** — uses browser speech synthesis when available and exports caption lines to an SRT file.
- **Prompt Library** — saves prompts to browser local storage and exports them as JSON.
- **Studio Settings** — stores local style, aspect ratio, and reduced-motion preferences.

## Run locally

This is a plain HTML/CSS/JavaScript project; no package installation or build step is required.

1. Extract the ZIP.
2. Open `index.html` in a modern browser.

For more reliable browser behavior, use a local static server or deploy the files to a static host such as GitHub Pages or Netlify.

## Publish to the separate GitHub repository

Repository target: `machdollar/motionstudio-ai-platform`

1. Open the repository on GitHub.
2. Choose **Add file → Upload files**.
3. Extract the ZIP on your device first, then upload the contents of the `motionstudio-ai-platform` folder (`index.html`, `styles.css`, `app.js`, and `README.md`) to the repository root.
4. Commit the changes.
5. If using GitHub Pages, open **Settings → Pages**, choose the branch and root folder, and save. A static hosting service can also publish this folder.

On Android, if GitHub's web uploader cannot select several files at once, use a ZIP/file manager app to extract the archive first, then upload each of the four files. Do not upload the ZIP as the only repository file if you want the site to publish automatically.

## Important scope notes

This is a working front-end prototype, not a connected AI media-generation service. Content Calendar entries and prompts are stored locally in the current browser; they do not sync across devices. It generates prompts, briefs, planning scores, scripts, and text exports in the browser. It does **not** yet render videos/images, fetch YouTube transcripts automatically, perform lip-sync/character replacement, remove captions from media, or enhance videos. Those capabilities require a provider API and usually a secure backend. Do not put private API keys in `app.js` or any browser-side file.

Shorts scores are simple heuristic planning aids, not reliable predictions of views, virality, or engagement. Source timestamps are exact only when your pasted transcript contains them. Otherwise timestamps and caption timing are estimates that should be reviewed before publishing.

## Privacy

- Prompts and preferences are saved in browser local storage on the current device.
- Reference image previews use a local object URL and are not uploaded by this static app.
- The project does not include analytics or server calls.

## Files

- `index.html` — page structure and forms
- `styles.css` — responsive visual design
- `app.js` — navigation, local interactions, generators, storage, downloads
- `README.md` — setup and deployment guide


## Version 4 — Project Dashboard

The Project Dashboard lets you create, edit, search, filter, and delete project records. Each project can store a type, status, optional target date, and notes. The “Open studio” action navigates to the related workspace. Project data is saved in browser local storage and can be exported/imported as JSON.

This remains a static front-end application. Project records are local to the current browser and do not sync between users or devices.
