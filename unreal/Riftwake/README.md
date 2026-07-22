# Riftwake — Unreal Engine 5 (PC)

PC C++ vertical slice of **Project Riftwake** for Unreal Engine 5.4+.

This cloud environment cannot run the Unreal Editor. Open and build this project on a **Windows PC** with the Epic Games Launcher.

## Requirements

- Windows 10/11 (64-bit)
- [Epic Games Launcher](https://www.epicgames.com/store/en-US/download) → install **Unreal Engine 5.4** (5.5 also works; retarget if prompted)
- Visual Studio 2022 with **Game development with C++** workload
- ~40 GB free disk for the engine (project itself is small)

## Open & play

1. Clone this repo on your PC.
2. Double-click `unreal/Riftwake/Riftwake.uproject`.
3. If asked to rebuild modules, click **Yes** (first compile takes several minutes).
4. If the engine version differs, choose **Open a copy** / retarget to your installed 5.x.
5. Press **Play** (Alt+P).

You should see a procedural sunset arena (engine spheres) and an on-screen Riftwake HUD.

## Controls

| Key | Action |
|-----|--------|
| Enter | Title → create → start |
| Tab | Cycle fighter name (create screen) |
| 1 | Hub: roll generative event · Event: choice 1 · Combat: Strike |
| 2–3 | Train / event choices / Rush / Bolt |
| 4–6 | Train speed / raise ceiling / forge worlds · Combat: Power Up / Guard / Ascend |
| 8 | Quick sandbox duel |
| 9 | Add another roster character |
| Esc | Back to hub (from event) / quit (from title) |

## What's ported from the browser slice

| System | Location |
|--------|----------|
| Power Level + forms (×1 / ×2.5 / ×4 / ×8 / ×15) | `Source/Riftwake/Core/PowerSystem.*` |
| PL v2: Hidden Depths, Momentum, Suppression | `Core/PowerSystem.*` + combatant fields |
| Dice checks | `Core/DiceSystem.*` |
| Turn combat (strike, rush, bolt, ascend) | `Core/CombatSystem.*` |
| World forge / ceiling / focus | `Core/WorldSystem.*` |
| Multi-character roster | `Core/CharacterRoster.*` |
| Generative events (invader, tournament, training, rival, relic) | `Core/EventGenerator.*` |
| Game loop + HUD | `Game/RiftwakeGameInstance.*`, `RiftwakeHUD.*` |
| Procedural arena | `Arena/RiftwakeArenaActor.*` |

Design rules stay the same as `docs/project-riftwake-game-foundation.md`: original IP names, reasoned gains, dice-driven outcomes.

## Package a Windows `.exe`

In the Editor:

1. **Platforms → Windows → Package Project**
2. Pick an output folder
3. Wait for cook/stage/package

Or from a Developer Command Prompt (after generating project files):

```bat
"%UE_ROOT%\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun -project="%CD%\Riftwake.uproject" -platform=Win64 -clientconfig=Development -build -cook -stage -pak -archive -archivedirectory="%CD%\Dist"
```

Replace `%UE_ROOT%` with your engine install path (e.g. `C:\Program Files\Epic Games\UE_5.4`).

## Next steps in-editor

- Replace basic-shape fighters with original skeletal meshes (see `docs/visual-style-guide.md`)
- Rebuild the HUD in UMG
- Add Niagara Flux auras / clash beams
- Create `Content/Maps/RiftwakeArena` and set it as the Game Default Map

## Relationship to the browser game

`game/` remains the playable web vertical slice. This Unreal project is the **PC engine target** from the foundation doc — same rules, C++ side. Keep both until the UE slice fully replaces the browser prototype.
