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

**Evaluation flow:** predictions are created with `evalue: false`. When a draw is saved (`form-tirage`), the handler reads *all* predictions and, for each unevaluated one, computes `nbrMatch` (count of matching numbers) and `chanceMatch`, then sets `evalue: true`. A prediction counts as a "réussite" if `nbrMatch > 0 || chanceMatch`.

**Rendering:** `chargerPronostics()`, `chargerTirages()`, and `chargerStats()` each read their collection, sort newest-first client-side, and write HTML into a container div. They are called on load and re-called after the relevant form submits. Dates are stored as ISO strings and displayed with `toLocaleDateString()`.

**Auth & security model:** email/password auth (Firebase Auth). Reads are public; writes are restricted to the owner's email in [firestore.rules](firestore.rules) (`estProprietaire()` checks `request.auth.token.email`). The UI mirrors this: `onAuthStateChanged` hides the prediction/draw forms unless signed in, but the Firestore rules are the actual enforcement. To change the owner, edit the email in `firestore.rules` AND redeploy the rules.

## Conventions

- User-facing strings and code comments are in **French**; keep new UI text French.
- No caching by design: [firebase.json](firebase.json) sets `Cache-Control: no-cache` on `*.js`/`*.html` so deploys appear immediately.
- The Firebase web config in `app.js` (including `apiKey`) is intentionally committed — it is public by design for Firebase web apps, not a secret.
