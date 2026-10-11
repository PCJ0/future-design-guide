# Project instructions

- This is a buildless static website. Edit `dist/`; do not regenerate it from a framework or replace it with a generic template.
- Read `README.md` first. Run `npm run dev` for local preview; run `npm run check` after substantive changes.
- Keep the user's original standby/choice UI unless a new request changes it. The reference artwork is in `dist/assets/`.
- Narration is in `dist/content.js`; motion choreography in `dist/app.js`, viewport fitting in `dist/motion.js`; raster frame animation in `dist/rig.js`.
- The latest request's opening text is exact user-provided copy. Preserve it unless asked to change it.
- Keep rear-facing walking, a turn toward the visitor before the choices appear, and side-matched pointing/lighting.
- Keep dependencies local. Never invent a real AI backend or claim keyword matching is an LLM call.
- `npm run export:offline` rebuilds the review HTML and its adjacent `review/assets/` video files from current source. Do not edit exported files instead of source.
- `.openai/hosting.json` retains the original Site ID. Never register a duplicate Site when editing the original. Respect the existing private audience; publishing requires the appropriate account and available Sites workflow.
- Do not include credentials, `.git`, node_modules, or local cache files in user-facing exports.
