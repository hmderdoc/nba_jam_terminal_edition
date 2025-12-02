# Animation & Prediction Tune-Up Ideas

This document captures the quick wins we can pursue to polish multiplayer presentation now that the chronic flicker is under control. Each idea includes the likely impact, current feasibility (based on logs/code), and any dependencies.

---

## 1. Inbound Path Flicker Reduction

**Observation**: When the non-coordinator is auto-walked to the inbound spot, corrections still appear jerky. Logs show `[MP COMMIT source=authority_blend]` every 83 ms while the scripted move runs.

**Idea**: During `PHASE_INBOUND`, temporarily disable client-side prediction (or force prediction to snap to the inbound path). The coordinator already knows the scripted positions; there’s no benefit to letting the client “help”.

**Impact**: High — removes the last noticeable flicker when players walk to inbound spots.

**Effort**: Low/Medium. We can guard inside `handleInput` and `replayInputsSince` when `stateManager.get('inbounding') === true`.

---

## 2. Turbo Prediction Scaling

**Observation**: Non-coordinator drains turbo immediately on prediction, even though the coordinator may reject the move. This exaggerates drift when the player is mashing turbo.

**Idea**: Add a predictive turbo throttle (e.g., only drain 50% client-side unless the coordinator confirms). Alternatively, disable turbo prediction entirely when drift or catch-up mode is active.

**Impact**: Medium — reduces cases where the client “feels” faster than the server and then snaps back.

**Effort**: Medium. Requires changes to `handleInput` and `replayInputsSince` plus new constants.

---

## 3. Micro Bump Animations on Snap

**Observation**: Authority snaps (especially `drift_snap` or collision snaps) currently teleport the sprite with no visual context, which looks like a flicker/disappearance even though it’s just a reposition.

**Idea**: Trigger a tiny bump animation (1–2 frames) whenever we detect a snap (e.g., insert a sprite wobble or dust puff). This matches the legacy “bump” effect from the arcade when players collide.

**Impact**: Medium/High for perceived polish. Converts a jarring snap into an understandable shove.

**Effort**: Medium. Requires hooking `animationSystem` inside the new snap branch and a small asset/animation definition.

---

## 4. Visual Guard Telemetry

**Observation**: We reset guard counters on drift snaps/inbounds, but we still have limited visibility into why a given correction was suppressed.

**Idea**: Add structured logs (and maybe an on-screen debug overlay) showing when the guard suppresses a correction vs. when it lets one through. Use this to tune suppression windows.

**Impact**: Medium for debugging. Helps confirm whether the guard is still hiding valid corrections during normal play.

**Effort**: Low. Only requires additional logging and possibly a toggleable overlay.

---

## 5. Predictive Input Tapering

**Observation**: Even after staging, the client replays every buffered input at full velocity immediately after a snap. This can reintroduce drift milliseconds after a correction.

**Idea**: After any reset (`resetPredictionState("...")`), ignore or taper the next few pending inputs (e.g., apply only half the movement for the first 5 frames while catch-up mode is active).

**Impact**: Medium — prevents rubber-band oscillation right after teleport/snap.

**Effort**: Medium. Requires introducing a “prediction dampening” counter tied to `authoritativeCatchupFrames`.

---

## 6. Coordinator → Client Animation Hints

**Observation**: Coordinator already knows when a player is being shoved, fouled, or teleported (e.g., inbound). Clients currently infer based on position deltas.

**Idea**: Extend the state packet with an “animation hint” (e.g., `snapReason: "inbound"`), so clients can play matching animations (celebration, inbound walk, shove bump) instead of only relying on deltas.

**Wave 24 Update**: Hints remain bundled with the frame state (no separate queue) but now carry animation payloads (e.g., shove knockback distance) instead of label metadata. Clients consume them immediately to trigger shared animations; nothing routes through jersey overlays anymore.

**Impact**: High for polish—makes multiplayer look identical to single-player re: inbound cutscenes and collisions.

**Effort**: High. Requires coordinator changes (state payload), client parsing, and more animation hooks.

---

## 7. Predictive Turbo Indicator

**Observation**: Turbo bars can jump backward when the coordinator rejects a predicted drain (client shows 30, server snaps to 40).

**Idea**: Show a “ghost” turbo overlay while prediction is active, or delay the visible drain until confirmation. Essentially the same idea as #2 but focused on HUD feedback.

**Impact**: Medium for perception—reduces the sense that turbo “lies”.

**Effort**: Medium (HUD changes, new constants for predictive drain).

---

## 8. Collision-Driven Camera Shake

**Observation**: When two humans collide, we snap both to their pre-collision coordinates (authority), which still feels harsh.

**Idea**: Add a mini camera shake or trail effect triggered when `reconcileMyPosition` snaps due to `wouldCollideWithAuthoritativeOthers`. This communicates “you hit someone” rather than “camera flickered”.

**Impact**: Medium — similar to #3 but from the camera perspective.

**Effort**: Medium. Needs new utility in `rendering/animation-system.js`.

---

## 9. Catchup Mode Visual Cue

**Observation**: When `authoritativeCatchupFrames > 0`, the client is applying heavy correction blending. Players can mistake this for lag.

**Idea**: Display a subtle UI element (e.g., small “Syncing…” icon near the HUD) whenever catchup mode is active. This sets expectations and helps QA confirm when drift sn
