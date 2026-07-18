# WORLDS / Project Riftwake

Single-player, party-based cinematic tactical RPG — playable browser vertical slice of **The Crossfall Trials**.

**Core fantasy:** Rise from an unproven fighter in a merged-reality world to reality-shaping battles — through martial skill, Flux mastery, relationships, investigation, and dice-driven choices.

**Central rule:** Anything can happen, but everything does not have the same chance of happening.

## Play

```bash
cd game
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

```bash
npm test      # rules + story graph tests
npm run build # production build to game/dist
```

## Deploy

Production build is published from `game/` (Vite → `dist`).

- **Netlify:** `cd game && npx netlify-cli deploy --dir=dist --prod` (or connect the repo; `netlify.toml` is included)
- **GitHub Pages:** workflow at `.github/workflows/deploy-pages.yml` — enable Pages in repo settings → Source: GitHub Actions, then merge to `main` or run the workflow
- Static snapshot also lands in `deploy/` for manual hosting

## What's in the game

- **3D WebGL arena** (Three.js): title cityscape, combat stage, auras, clash beams
- **BYOND-style Power Level:** Strength/Endurance/Speed/Resistance/Offense/Defense/Force → one PL, then **form multipliers** (×1 / ×2.5 / ×4 / ×8 / ×15)
- **Story AI director:** procedural grind — train stats (dice), spar, missions, transform drills, rival calls
- Character creation + authored Crossfall Trials saga (still dice-driven)
- Turn-based combat scaled by Power Level gaps
- Local save / continue

## Design docs

- [Game Foundation v0.1](docs/project-riftwake-game-foundation.md)
- [Visual Style Guide](docs/visual-style-guide.md)
- Concept plates in [`docs/visual-refs/`](docs/visual-refs/) (also in-game under **Visual Refs**)

## Project layout

```text
docs/                         Design bible
game/
  src/engine/                 Dice, attributes, combat, clash, ascension
  src/data/                   Techniques, companions, encounters, story
  src/state/                  Save game + choice resolution
  src/ui/                     Screens (title, create, scene, combat, ending)
```

This is a complete playable vertical slice implementing the foundation systems in TypeScript/Vite. Unreal Engine 5 remains the long-term production target from the design doc; this repo ships the full rules-and-story loop now.
