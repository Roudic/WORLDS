# Content

This first Unreal vertical slice is **code-driven**: procedural arena meshes and HUD text ship from C++ so the project runs without custom `.uasset` packs.

When you open the project in the Unreal Editor on PC, you can add:

- Character skeletal meshes / animations (keep original silhouettes — see `docs/visual-style-guide.md`)
- Niagara Flux auras and clash beams
- UMG widgets replacing the canvas HUD
- A custom `Maps/RiftwakeArena` level (then set it as GameDefaultMap in Project Settings)

Until then, Play In Editor uses Engine basic shapes + the Riftwake C++ game loop.
