# Multiplayer Architecture Audit

This document analyzes the architectural differences between the single-player/demo modes and the multiplayer mode in NBA Jam Terminal Edition. The goal is to identify architectural deviations that may be the root cause of persistent multiplayer issues, such as the "flicker" bug.

## 1. Single-Player / Demo Mode Architecture

The single-player and demo modes operate on a simple, direct, and authoritative model. There is a single game loop that owns the state and renders the outcome of its own logic.

### 1.1. Game Loop Initialization & Execution

- **Entry Point**: The game starts in `main()`, which leads to either `gameLoop()` for single-player or `runCPUDemo()` which in turn calls `gameLoop()`.
- **Configuration**: A `config` object is created with `isAuthority: true`. This is the most critical aspect. It means this game instance is the undisputed source of truth.
- **Core Loop**: The `while` loop in `gameLoop()` repeatedly calls the unified `runGameFrame(systems, config)`. This function contains the entirety of the game's logic for a single frame.
- **Execution Model**: The model is synchronous and linear. `handleInput` -> `runGameFrame` (which includes AI, physics, violations, rendering) -> `waitForNextFrame`.

### 1.2. State Management

- **Source of Truth**: The `systems.stateManager` object is the single, local source of truth for the entire game state.
- **Updates**: All game logic, including timers, score, and player positions, directly reads from and writes to the `stateManager`. Because `isAuthority` is true, there is no external state to consider.

### 1.3. Input Handling

- **Path**: `console.inkey()` -> `handleInput(key, systems)` -> `systems.stateManager.set(...)`.
- **Immediacy**: The path from keypress to state change is direct and happens within a single frame. There is no prediction or reconciliation. The effect of a keypress is immediately reflected in the state.

### 1.4. Rendering Path

- **Trigger**: The `renderFrame(systems)` function is called within `runGameFrame()`.
- **Data Source**: The renderer reads directly from the `stateManager` and the sprite objects. What it draws is the absolute, final state for that frame. There is no concept of a "predicted" vs. "authoritative" position. The sprite is at `(x,y)`, and that's where it's drawn.

## 2. Multiplayer Mode Architecture

Multiplayer introduces significant complexity by splitting the game into two roles: a single **Coordinator** (the authority) and one or more **Clients** (which predict their own actions).

### 2.1. Game Loop Initialization & Execution

- **Entry Point**: `main()` -> `runMultiplayerMode()` -> `runMultiplayerGameLoop()`.
- **Role Determination**: The first major deviation is role selection. `GameCoordinator.init()` has logic to claim the coordinator role for the session. All other nodes become clients.
- **Coordinator (`isAuthority: true`)**:
    - **Input**: Collects inputs from all players (including itself) via a network queue (`collectInputs`). It does *not* process its own keyboard input directly.
    - **Execution**: Calls `runGameFrame()` with `isAuthority: true`. It runs the full, authoritative simulation.
    - **Output**: Periodically serializes the entire game state (`broadcastState`) and sends it to all clients.
- **Client (`isAuthority: false`)**:
    - **Input**: Reads its own keyboard input directly (`playerClient.handleInput`).
    - **Prediction**: It *immediately* applies the input to its local sprite (`applyMovementCommand`). This is client-side prediction. The input is also buffered and sent to the coordinator.
    - **Execution**: Calls `runGameFrame()` with `isAuthority: false`. This runs a "thin" version of the loop, primarily for rendering and animation. It does *not* run authoritative logic like AI or violation checks.
    - **Reconciliation**: Periodically, `playerClient.reconcile()` receives the authoritative state from the coordinator. It then corrects the position of the local player's sprite and all other objects to match the server.

### 2.2. State Management

- **Coordinator**: Owns the single, authoritative `stateManager`, just like in single-player.
- **Client**: Also has a `stateManager`, but it's a perpetually-out-of-date copy. It is constantly being overwritten by data from the coordinator (`updateGameState`, `updateBall`, `updateOtherPlayers`). The client's state is a hybrid of its own predictions and the server's corrections.

### 2.3. Input Handling

- **Path (Client)**: `console.inkey()` -> `playerClient.handleInput()` -> `applyMovementCommand` (local prediction) -> `inputBuffer.flush()` (send to coordinator).
- **Path (Coordinator)**: `collectInputs()` (receives from all clients) -> `processInputs()` -> `applyInput()` -> `applyMovementCommand` (authoritative application).
- **Divergence**: This is the core of the multiplayer model. The client moves instantly, creating a responsive feel, but this move is "speculative." The coordinator processes the same input later and sends back the "real" result. Any difference between the prediction and the real result causes a visual correction on the client.

### 2.4. Rendering Path

- **Trigger**: `renderFrame(systems)` is called inside `runGameFrame()` for both roles.
- **Data Source (Client)**: This is the most complex part. The client renders its *predicted* state. A few milliseconds later, a state update may arrive from the coordinator, and the `reconcile()` function will move the sprite. If this happens within the same screen refresh, it can cause a "flicker" as the sprite is effectively drawn in two different places. The `visualGuard` logic in `mp_client.js` is an attempt to mitigate this by suppressing small, immediate corrections.

## 3. Key Architectural Deviations

This table highlights the fundamental differences in how the two modes operate. The multiplayer column reveals multiple potential sources for visual inconsistency and race conditions.

| Feature | Single-Player / Demo | Multiplayer | Analysis / Hypothesis |
| :--- | :--- | :--- | :--- |
| **State Authority** | **Local & Singular**. The game instance is its own source of truth. | **Split**. Coordinator is authoritative; the Client is predictive and subordinate. | The client must constantly reconcile its predicted state with the server's authoritative state. This is the primary source of complexity and potential visual bugs. |
| **Input Path** | **Direct**: `inkey` -> `handleInput` -> `stateManager`. Immediate and final. | **Dual Path**: **Client**: `inkey` -> `predict` -> `render`. **Coordinator**: `network` -> `process` -> `broadcast`. | The time gap between client prediction and coordinator correction is where flicker originates. If the prediction is "wrong" (e.g., blocked by another player on the server), the correction will be a visual snap. |
| **Player Position Update** | **Once per frame**. `runGameFrame` calculates the new position, `renderFrame` draws it. | **Multiple times per frame (potentially)**. 1. Client predicts and moves sprite. 2. `reconcile()` receives server state and moves sprite again. 3. `replayInputsSince()` might move it a third time. | This is a classic race condition. The `visualGuard` in `mp_client.js` tries to prevent the most jarring corrections, but if its logic isn't perfect, flicker is inevitable. The core problem is multiple asynchronous writers to the sprite's position. |
| **Game State Reset (e.g., Inbound)** | **Synchronous**. `setupInbound()` is called, all state is reset instantly within one `runGameFrame` call. | **Asynchronous**. Coordinator calls `setupInbound()`, broadcasts new state. Client receives state later, calls `resetPredictionState()`. | If the client's `resetPredictionState()` is incomplete or doesn't perfectly mirror the "clean slate" of a fresh game start, the prediction system can remain corrupted, leading to persistent flicker after the reset. **This strongly matches user observations.** |
| **Collision Detection** | **Authoritative**. Happens once inside `runGameFrame`. | **Split**. Client has a predictive `wouldCollideWithAuthoritativeOthers()`. Coordinator has the real collision check. | If the client's predictive collision check is inaccurate (e.g., based on stale data of other players), it might predict a move that the server rejects. The result is a snap-back correction. |

## 4. Hypotheses for Flicker Bug

Based on the deviations, the flicker is not a single bug but likely a systemic issue stemming from the architectural complexity of multiplayer.

1.  **Hypothesis A: Incomplete Client State Reset (High Confidence).** This aligns perfectly with the user's observation that flicker begins after inbounds or other game resets. The `resetPredictionState` function on the client is likely failing to restore the client to a "perfectly clean" state, identical to the one it has at the initial start of the game. Latent prediction artifacts (old inputs, incorrect visual guard state) remain, causing a permanent desync between prediction and reconciliation.

2.  **Hypothesis B: Position Update Race Condition (High Confidence).** The client's sprite `x` and `y` coordinates are being written to by multiple functions asynchronously: `handleInput` (prediction), `reconcileMyPosition` (correction), and `replayInputsSince` (post-correction prediction). These updates can interfere with each other within a single render cycle, causing the sprite to appear to jump between two points.

3.  **Hypothesis C: Legacy Logic Mismatch (Medium Confidence).** It's possible that a piece of logic, refactored for the non-blocking game loop, still has a multiplayer-specific counterpart that retains assumptions from the old blocking model. This could lead to subtle timing errors that only manifest under network conditions.

## 5. Action Plan

This plan moves from a tactical "fix-the-flicker" approach to a strategic "fix-the-architecture" approach.

1.  **[PRIORITY 1] Full Audit & Enhancement of `resetPredictionState`.**
    *   **Action:** Compare every state variable initialized at the start of `PlayerClient` with what is being reset in `resetPredictionState`.
    *   **Goal:** Ensure that calling `resetPredictionState` makes the client's prediction system functionally identical to a brand-new `PlayerClient` instance. We must achieve a true "hard reset" to the known-good startup state.

2.  **[PRIORITY 2] Unify Client-Side Position Updates.**
    *   **Action:** Refactor `mp_client.js` to ensure that only ONE function is responsible for applying the final, reconciled position to `mySprite` each frame.
    *   **Goal:** Eliminate the race condition by creating a single point of truth for the sprite's position on the client, likely at the very end of the `reconcile()` function, after all prediction, correction, and re-prediction has been calculated.

3.  **[PRIORITY 3] Targeted Legacy Code Search.**
    *   **Action:** Systematically review `mp_coordinator.js`, `mp_client.js`, and the `runMultiplayerGameLoop` for patterns that were problematic in the pre-Wave23 architecture (e.g., direct `gameState` mutation instead of using the `stateManager`, assumptions about timing).
    *   **Goal:** Identify and eliminate any remaining architectural mismatches between the single-player and multiplayer code paths.
---
