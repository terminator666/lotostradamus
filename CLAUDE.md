# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LotosTradamus is a single-page Firebase-hosted web app (in French) to record French loto predictions, record the official draw, and track a success rate. There is **no build step, no framework, no test suite** — it's vanilla JavaScript ES modules with the Firebase Web SDK loaded from the gstatic CDN. All app code lives in two files:

- [public/index.html](public/index.html) — markup, inline CSS, and the DOM element IDs the JS binds to
- [public/app.js](public/app.js) — all logic (Firebase init, auth, form handlers, rendering)

## Deployment (important)

Deployment is automated: **pushing to `main` triggers GitHub Actions** ([.github/workflows/firebase-hosting-merge.yml](.github/workflows/firebase-hosting-merge.yml)) which deploys to Firebase Hosting. Do **not** run `firebase deploy --only hosting` manually — just commit and push.

The GitHub Action deploys **hosting only**. Firestore rules are NOT covered, so after editing [firestore.rules](firestore.rules) you must deploy them manually:

```
firebase deploy --only firestore:rules
```

Live site: https://lotostradamus-e09e6.web.app

## Architecture

**Data (Cloud Firestore), two collections:**
- `predictions` — `{ date (ISO string), numeros (5 ints), chance (int), evalue (bool), nbrMatch (int), chanceMatch (bool) }`
- `tirages` — `{ date (ISO string), numeros (5 ints), chance (int) }`

**Evaluation flow:** predictions are created with `evalue: false`. `evaluerPronostics()` indexes draws by day (`date.slice(0,10)`) and, for each unevaluated prediction, evaluates it against the draw with the **same date** (if one exists) — computing `nbrMatch` (count of matching numbers) and `chanceMatch`, then setting `evalue: true`. It runs after both submitting a prediction and saving a draw, so evaluation happens regardless of which was entered first. A prediction counts as a "réussite" if `nbrMatch > 0 || chanceMatch`.

**Rendering:** `chargerPronostics()`, `chargerTirages()`, and `chargerStats()` each read their collection, sort newest-first client-side, and write HTML into a container div. They are called on load, after the relevant form submits, and on auth state changes. Dates are stored as ISO strings and displayed with `toLocaleDateString()`.

**Edit/delete:** the prediction and draw tables render an "Actions" column (edit ✏️ / delete 🗑️) **only when the owner is signed in** (`auth.currentUser`). Edit is inline — the row's cells become inputs. Rows carry `data-id`; handlers are attached after `innerHTML` (module scope, so no global `onclick`). Editing a prediction resets its eval fields and re-runs `evaluerPronostics()`. Editing/deleting a draw calls `reinitialiserEvaluationDuJour()` (reset that day's predictions to unevaluated, then re-evaluate) so stats stay consistent.

**Auth & security model:** email/password auth (Firebase Auth). Reads are public; writes are restricted to the owner's email in [firestore.rules](firestore.rules) (`estProprietaire()` checks `request.auth.token.email`). The UI mirrors this: `onAuthStateChanged` hides the prediction/draw forms unless signed in, but the Firestore rules are the actual enforcement. To change the owner, edit the email in `firestore.rules` AND redeploy the rules.

## Conventions

- User-facing strings and code comments are in **French**; keep new UI text French.
- No caching by design: [firebase.json](firebase.json) sets `Cache-Control: no-cache` on `*.js`/`*.html` so deploys appear immediately.
- The Firebase web config in `app.js` (including `apiKey`) is intentionally committed — it is public by design for Firebase web apps, not a secret.
