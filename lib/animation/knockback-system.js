/**
 * Knockback Animation System
 * Handles player knockback effects when shoved, including trail rendering
 */

/**
 * Initiate a knockback animation for a player
 * @param {Object} player - The player being knocked back
 * @param {Object} source - The player doing the shoving
 * @param {number} maxDistance - Maximum knockback distance (12-25 units)
 */
function knockBack(player, source, maxDistance) {
    if (!player || !player.moveTo) return;

    // Calculate knockback distance (12-25 units)
    var distance = Math.max(12, Math.min(maxDistance || 12, 25));

    // Calculate direction
    var dx = player.x - (source ? source.x : player.x);
    var dy = player.y - (source ? source.y : player.y);
    if (dx === 0 && dy === 0) {
        dx = (Math.random() < 0.5) ? 1 : -1;
    }

    // Normalize direction for consistent speed
    var magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 0) {
        dx /= magnitude;
        dy /= magnitude;
    }

    // Determine primary direction for arrow character
    var arrowChar = "o"; // Default
    var absX = Math.abs(dx);
    var absY = Math.abs(dy);

    if (absX > absY * 1.5) {
        // Primarily horizontal
        arrowChar = dx > 0 ? ">" : "<";
    } else if (absY > absX * 1.5) {
        // Primarily vertical
        arrowChar = dy > 0 ? "v" : "^";
    } else {
        // Diagonal - use strongest component
        if (absX > absY) {
            arrowChar = dx > 0 ? ">" : "<";
        } else {
            arrowChar = dy > 0 ? "v" : "^";
        }
    }

    // Calculate all positions (don't animate yet - non-blocking approach)
    var startX = player.x;
    var startY = player.y;
    var trailPositions = [];
    for (var i = 1; i <= distance; i++) {
        var newX = clampToCourtX(Math.round(startX + dx * i));
        var newY = clampToCourtY(Math.round(startY + dy * i));
        trailPositions.push({ x: newX, y: newY });
    }

    // Store knockback animation data on player for non-blocking animation
    if (!player.knockbackAnim) {
        player.knockbackAnim = {
            active: false,
            positions: [],
            currentStep: 0,
            arrowChar: "o",
            startTime: 0,
            stepDelay: 30,
            shover: null, // Track who did the shoving
            trailPositions: [] // Track where trails are drawn for cleanup
        };
    }

    player.knockbackAnim.active = true;
    player.knockbackAnim.positions = trailPositions;
    player.knockbackAnim.currentStep = 0;
    player.knockbackAnim.arrowChar = arrowChar;
    player.knockbackAnim.startTime = Date.now();
    player.knockbackAnim.stepDelay = 60; // ms per step (slowed from 30ms)
    player.knockbackAnim.shover = source; // Store shover reference
    player.knockbackAnim.trailPositions = []; // Clear old trails

    // Set cooldowns NOW so sprites show during animation
    if (player.playerData) {
        player.playerData.shoveCooldown = 35;
    }
    if (source && source.playerData) {
        source.playerData.shoverCooldown = 35;
    }

    // Move to first position immediately
    if (trailPositions.length > 0) {
        player.moveTo(trailPositions[0].x, trailPositions[0].y);
    }
}

/**
 * Update all active knockback animations (non-blocking)
 * Called each frame from main game loop
 */
function updateKnockbackAnimations() {
    var allPlayers = getAllPlayers();
    var now = Date.now();

    for (var i = 0; i < allPlayers.length; i++) {
        var player = allPlayers[i];
        if (!player || !player.knockbackAnim || !player.knockbackAnim.active) continue;

        var anim = player.knockbackAnim;
        var elapsed = now - anim.startTime;
        var targetStep = Math.floor(elapsed / anim.stepDelay);

        // Update position if we've reached next step
        if (targetStep > anim.currentStep && targetStep < anim.positions.length) {
            var pos = anim.positions[targetStep];
            player.moveTo(pos.x, pos.y);

            // Draw trail at previous positions (up to 12 trail characters)
            // Use trailFrame for proper layering (prevents court redraw from clearing trails)
            var trailLength = Math.min(12, targetStep);
            for (var t = 1; t <= trailLength; t++) {
                var trailIdx = targetStep - t;
                if (trailIdx >= 0 && trailIdx < anim.positions.length) {
                    var trailPos = anim.positions[trailIdx];
                    // Fade trail based on age (newer = brighter)
                    var trailAttr = t <= 2 ? (LIGHTCYAN | WAS_BROWN) : (CYAN | WAS_BROWN);
                    if (trailFrame && trailFrame.setData) {
                        // Convert game coords (1-based) to frame coords (0-based)
                        var trailX = trailPos.x - 1;
                        var trailY = trailPos.y - 1;
                        trailFrame.setData(trailX, trailY, anim.arrowChar, trailAttr, false);

                        // Track unique positions for cleanup (only on first draw of this step)
                        if (t === 1) {
                            if (!anim.trailPositions) anim.trailPositions = [];
                            anim.trailPositions.push({ x: trailX, y: trailY });
                        }
                    }
                }
            }

            anim.currentStep = targetStep;
        }

        // End animation when complete
        if (targetStep >= anim.positions.length) {
            // Clear all trail positions from overlay frame
            if (trailFrame && anim.trailPositions) {
                var hasClearData = typeof trailFrame.clearData === "function";
                var hasSetData = typeof trailFrame.setData === "function";
                for (var t = 0; t < anim.trailPositions.length; t++) {
                    var pos = anim.trailPositions[t];
                    if (!pos) continue;
                    if (hasClearData) {
                        trailFrame.clearData(pos.x, pos.y, false);
                    } else if (hasSetData) {
                        trailFrame.setData(pos.x, pos.y, undefined, 0, false);
                    }
                }
            }

            anim.active = false;
            anim.currentStep = 0;
            anim.trailPositions = []; // Clear trail tracking

            // Clear cooldowns immediately to restore normal sprites
            // Changed from 3 to 0 - no delay needed since appearance updates happen before sprite movement
            if (player.playerData) {
                player.playerData.shoveCooldown = 0;
            }

            // Also clear shover's cooldown
            if (anim.shover && anim.shover.playerData) {
                anim.shover.playerData.shoverCooldown = 0;
            }

            anim.shover = null; // Clear reference
        }
    }
}
