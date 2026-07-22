# Power Level v2 — Twists That Make Fights Fun

This layer sits on top of the classic BYOND-style Power Level
(`stat sum × form × output`). The raw number still matters, but fights
now swing for reasons players can feel and play around.

## Layers

### 1. Hidden Depths
When a fighter is driven below ~35% Health for the first time in a bout,
latent reserve ignites:

- Health rebound (~12% of max)
- Output floored high
- Tempo spike
- True Power Level rises by the fighter's depth factor (Will + Grit + Level)

**Why it's fun:** comebacks feel earned. The underdog isn't dead until the
tank is empty.

### 2. Momentum (Tempo)
A per-fight meter (−100..100):

- Landing hits builds your tempo and drains theirs
- Misses bleed tempo the other way
- Hot tempo (~80+) hits harder and shows a TEMPO chip
- Cool-down each turn so streaks don't last forever

**Why it's fun:** pressure has a rhythm. Whiffing opens the door for the
other fighter to seize the exchange.

### 3. Suppression (scanner lies)
Some sandbox foes (Duelist, Ceiling Hunter) mask a fraction of their true
Power Level. Until they:

- get hurt / the fight runs long enough to "drop the act", or
- you **Scan** them (reveals true PL and can expose weaknesses)

the HUD may show a soft `~` reading and a "reading soft…" chip.

**Why it's fun:** scanning matters. Jumping in blind can get you wrecked
by someone who looked weaker than they were.

### 4. Form Strain / Backlash
Holding a transform (or max Output) burns extra Flux. When Flux hits zero
while ascended:

- form collapses
- stagger spike
- tempo crash
- aura drops

**Why it's fun:** transformations are a resource, not a permanent mode.
Timing the drop-in and drop-out is the skill.

### 5. Combat Profiles
Equal Power Levels can still feel different. Stat spreads read as:

- **Striker** — offense / speed heavy
- **Bulwark** — defense / endurance heavy
- **Channeler** — Force-forward
- **Bruiser** / **Balanced** — mixed

Shown next to the band chip in combat.

## Design rule (unchanged)

> Anything can happen, but everything does not have the same chance of happening.

A weaker fighter can seize tempo, awaken Hidden Depths, or expose a
suppressing rival — but they still can't ignore a 10× Power Level gap
with a lucky punch alone.
