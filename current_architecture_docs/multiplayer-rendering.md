## Rendering Layers in Multiplayer

- **Frames.** Multiplayer clients reuse the same frame stack as single-player: `announcerFrame`, `courtFrame`, `trailFrame`, hoop frames, and `scoreFrame`. `initFrames` is called locally on every client, so even when authoritative updates arrive, the local console is responsible for drawing the scene.
- **Authoritative data.** The coordinator serializes sprite positions/bearings, turbo meters, and animation payloads. Clients feed that data into the existing rendering helpers:
  - `updateSpriteRendering` moves sprites to their authoritative coordinates.
  - `systems.animationSystem.update()` replays the same animation frames the coordinator triggered (dunks, passes, rebounds).
  - Jump indicators, fire trails, and other VFX run locally using the shared state (e.g., `sprite.jumpIndicatorData`).
- **Prediction overlay.** While waiting for new state packets, the client uses predicted movement (see `mp_client.js`) to keep sprites responsive. When the authoritative packet arrives, the client snaps or lerps to the official values, then redraws the trail/hoops/scoreboard layers.

## HUD Synchronization

- Clocks and scores are part of the coordinator’s state packets. Clients set `stateManager` keys to those authoritative values so `drawScore`, announcer text, and violation messages stay consistent.
- Turbo meters update locally as soon as the client predicts an input but are reconciled with the authoritative meter the next time a state packet arrives.

## Animation Parity

- Animations are queued centrally by the coordinator. Each animation entry includes all data needed for deterministic playback (frames, ms per step, payload). Clients feed those entries into `animationSystem.queueShotAnimation`, `queuePassAnimation`, etc., ensuring every console sees the same sequence.
- When reconciliation reveals that an animation finished earlier/later than expected (e.g., due to packet delay), the client forcibly advances the animation or clears it to avoid visual desync.

## TrailFrame Requirement

- Effects such as jump indicators now render exclusively on `trailFrame`. Multiplayer clients must open this frame (just like single-player `initFrames` does) before applying authoritative updates; otherwise, block indicators will silently skip rendering.

## Debug Overlays

- Multiplayer debug UI (latency bars, player IDs) are drawn on top of existing frames and fed by the networking layer (`MP_CONSTANTS.LATENCY_INDICATORS`). These overlays are purely local; they never affect authoritative state.
