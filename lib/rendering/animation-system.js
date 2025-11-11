// NBA Jam Animation System
// Non-blocking incremental animation for shots, passes, dunks, and rebounds

// ============================================================================
// ANIMATION TIMING CALCULATORS
// ============================================================================

function computeShotAnimationTiming(startX, startY, targetX, targetY) {
    var dx = targetX - startX;
    var dy = targetY - startY;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(15, Math.round(distance * 1.5));
    var msPerStep = Math.max(32, Math.round(800 / steps));  // Wave 23D: Slowed from 16ms to 32ms for readability
    return {
        steps: steps,
        msPerStep: msPerStep,
        durationMs: steps * msPerStep,
        distance: distance
    };
}

function computePassAnimationTiming(startX, startY, endX, endY) {
    var dx = endX - startX;
    var dy = endY - startY;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(10, Math.round(distance * 0.8));
    var totalTime = 300 + (distance * 10);
    var msPerStep = Math.max(30, Math.round(totalTime / steps));  // Wave 23D: Slowed from 15ms to 30ms for readability
    return {
        steps: steps,
        msPerStep: msPerStep,
        durationMs: steps * msPerStep,
        distance: distance
    };
}

// ============================================================================
// ANIMATION SYSTEM CLASS
// ============================================================================

/**
 * Non-blocking Animation System
 * Handles incremental rendering of shots, passes, dunks without blocking game loop
 */
function AnimationSystem() {
    this.animations = [];
    this.systems = null;  // Will be set after systems initialization

    // Set systems reference (called after systems object is created)
    this.setSystems = function (systems) {
        this.systems = systems;
    };

    this.queueShotAnimation = function (startX, startY, targetX, targetY, made, blocked, shooter, durationMs, reboundBounces, onComplete) {
        var timing = computeShotAnimationTiming(startX, startY, targetX, targetY);
        if (typeof durationMs === "number" && durationMs > 0) {
            timing.durationMs = durationMs;
            timing.msPerStep = Math.max(16, Math.round(durationMs / timing.steps));
        }

        if (typeof moveBallFrameTo === "function") {
            moveBallFrameTo(clamp(Math.round(startX), 1, COURT_WIDTH), clamp(Math.round(startY), 1, COURT_HEIGHT));
        }

        var now = Date.now();
        this.animations.push({
            type: "shot",
            startX: startX,
            startY: startY,
            targetX: targetX,
            targetY: targetY,
            made: made,
            blocked: blocked,
            shooter: shooter,
            step: 0,
            maxSteps: timing.steps,
            distance: timing.distance,
            msPerStep: timing.msPerStep,
            nextStepTime: now + timing.msPerStep,
            affectsBall: true,
            trailPositions: [],  // Track trail positions for cleanup
            reboundBounces: reboundBounces,  // Store rebound data to queue after shot completes
            onComplete: onComplete  // Wave 22B: Callback for state mutations after animation
        });
    };

    this.queuePassAnimation = function (startX, startY, endX, endY, stateData, durationMs, onComplete) {
        var timing = computePassAnimationTiming(startX, startY, endX, endY);
        if (typeof durationMs === "number" && durationMs > 0) {
            timing.durationMs = durationMs;
            timing.msPerStep = Math.max(12, Math.round(durationMs / timing.steps));
        }

        if (typeof moveBallFrameTo === "function") {
            moveBallFrameTo(clamp(Math.round(startX), 1, COURT_WIDTH), clamp(Math.round(startY), 1, COURT_HEIGHT));
        }

        var now = Date.now();
        this.animations.push({
            type: "pass",
            startX: startX,
            startY: startY,
            endX: endX,
            endY: endY,
            stateData: stateData,  // Wave 22B: All data needed for state mutations (passer, receiver, interceptor, etc)
            step: 0,
            maxSteps: timing.steps,
            distance: timing.distance,
            msPerStep: timing.msPerStep,
            nextStepTime: now + timing.msPerStep,
            affectsBall: true,
            trailPositions: [],  // Track trail positions for cleanup
            onComplete: onComplete  // Wave 22B: Callback for state mutations after animation
        });

        if (typeof debugLog === "function") {
            debugLog("[ANIM] Queued pass animation, total animations: " + this.animations.length);
        }
    };

    this.queueReboundAnimation = function (bounces) {
        // bounces is array of {startX, startY, endX, endY}
        if (!bounces || bounces.length === 0) return;

        if (typeof moveBallFrameTo === "function") {
            moveBallFrameTo(clamp(Math.round(bounces[0].startX), 1, COURT_WIDTH),
                clamp(Math.round(bounces[0].startY), 1, COURT_HEIGHT));
        }

        var now = Date.now();
        this.animations.push({
            type: "rebound",
            bounces: bounces,
            currentBounce: 0,
            step: 0,
            maxSteps: 6,  // 6 steps per bounce
            msPerStep: 40,
            nextStepTime: now + 40,
            affectsBall: true,
            trailPositions: []
        });
    };

    this.queueDunkAnimation = function (player, dunkInfo, flightPlan, targetX, targetY, made, style, onComplete) {
        debugLog("[ANIM SYSTEM] queueDunkAnimation called: player=" + (player && player.playerData ? player.playerData.name : "null") + ", dunkInfo=" + (dunkInfo ? "yes" : "no") + ", flightPlan=" + (flightPlan ? "yes" : "no") + ", frames=" + (flightPlan && flightPlan.frames ? flightPlan.frames.length : 0));
        if (!player || !dunkInfo || !flightPlan || !flightPlan.frames) {
            debugLog("[ANIM SYSTEM] queueDunkAnimation REJECTED: missing required data");
            return;
        }

        var now = Date.now();
        var msPerStep = flightPlan.frames[0] ? (flightPlan.frames[0].ms || 30) : 30;
        var maxSteps = flightPlan.frames.length;

        this.animations.push({
            type: "dunk",
            player: player,
            dunkInfo: dunkInfo,
            flightPlan: flightPlan,
            targetX: targetX,
            targetY: targetY,
            made: made,
            blocked: false,
            blocker: null,
            style: style || "default",
            step: 0,
            maxSteps: maxSteps,
            msPerStep: msPerStep,
            nextStepTime: now + msPerStep,
            affectsBall: true,
            groundBottom: player.y + ((player.frame && player.frame.height) ? player.frame.height : 4),
            onComplete: onComplete
        });
        debugLog("[ANIM SYSTEM] Dunk queued: step=0, maxSteps=" + maxSteps + ", msPerStep=" + msPerStep + ", nextStepTime=" + (now + msPerStep) + ", now=" + now);
    };

    this.update = function () {
        if (!courtFrame) return;

        var now = Date.now();
        var completedIndices = [];

        if (this.animations.length > 0 && typeof debugLog === "function") {
            debugLog("[ANIM] update: " + this.animations.length + " animations active");
        }

        for (var i = 0; i < this.animations.length; i++) {
            var anim = this.animations[i];
            if (!anim.msPerStep || anim.msPerStep <= 0) anim.msPerStep = 50;
            if (!anim.nextStepTime) anim.nextStepTime = now;

            // CRITICAL: Check for completion FIRST before timing checks
            // Once animation completes, nextStepTime is in future, so while loop won't run
            // We need to detect completion independent of timing
            if (anim.step >= anim.maxSteps) {
                if (anim.type === "dunk") {
                    debugLog("[ANIM] EARLY EXIT: dunk completing at step=" + anim.step + ", maxSteps=" + anim.maxSteps + " (never animated!)");
                }
                // For rebound, check if there are more bounces
                if (anim.type === "rebound" && anim.currentBounce < anim.bounces.length - 1) {
                    anim.currentBounce++;
                    anim.step = 0;
                    anim.nextStepTime = now + anim.msPerStep;
                } else {
                    debugLog("[ANIM] Completing " + anim.type + " animation, affectsBall=" + anim.affectsBall);
                    this.completeAnimation(anim);
                    completedIndices.push(i);
                }
                continue;  // Skip to next animation
            }

            var advanced = false;
            // Process ONE step per update() call for smooth non-blocking animation
            // Don't use while loop - that burns through all steps in one frame
            if (anim.step < anim.maxSteps && now >= anim.nextStepTime) {
                anim.step++;
                advanced = true;

                if (anim.type === "shot") {
                    this.updateShotAnimation(anim);
                } else if (anim.type === "pass") {
                    this.updatePassAnimation(anim);
                } else if (anim.type === "rebound") {
                    this.updateReboundAnimation(anim);
                } else if (anim.type === "rebound_idle") {
                    this.updateIdleBounceAnimation(anim);
                } else if (anim.type === "dunk") {
                    this.updateDunkAnimation(anim);
                } else {
                    debugLog("[ANIM] WARNING: Unknown animation type: " + anim.type);
                }

                anim.nextStepTime += anim.msPerStep;
            }

            // Debug: Log if animation not advancing
            if (!advanced && anim.step === 0 && now < anim.nextStepTime) {
                if (typeof debugLog === "function") {
                    debugLog("[ANIM] " + anim.type + " waiting: now=" + now + ", nextStepTime=" + anim.nextStepTime + ", delta=" + (anim.nextStepTime - now));
                }
            }

            // Note: This check is now redundant since we check at top of loop
            // Keeping it for safety in case of edge cases
            if (anim.step >= anim.maxSteps) {
                // For rebound, check if there are more bounces
                if (anim.type === "rebound" && anim.currentBounce < anim.bounces.length - 1) {
                    anim.currentBounce++;
                    anim.step = 0;
                    anim.nextStepTime = now + anim.msPerStep;
                } else if (anim.type === "rebound" && anim.currentBounce === anim.bounces.length - 1) {
                    // Initial bounces complete - transition to idle bounce if scramble still active
                    if (this.systems && this.systems.stateManager) {
                        var reboundActive = this.systems.stateManager.get('reboundActive');
                        if (reboundActive) {
                            // Convert to idle bounce animation
                            var lastBounce = anim.bounces[anim.currentBounce];

                            // Calculate velocity from last bounce trajectory
                            var vx = 0;
                            var vy = 0;
                            if (anim.bounces.length > 1) {
                                var prevBounce = anim.bounces[anim.bounces.length - 2];
                                vx = (lastBounce.endX - prevBounce.endX) * 0.3; // Dampen
                                vy = (lastBounce.endY - prevBounce.endY) * 0.3;
                            }

                            anim.type = "rebound_idle";
                            anim.centerX = lastBounce.endX;
                            anim.centerY = lastBounce.endY;
                            // Calculate velocity from trajectory
                            anim.vx = vx;
                            anim.vy = vy;
                            // Ensure minimum velocity if calculated velocity is too low
                            if (Math.abs(anim.vx) < 0.8 && Math.abs(anim.vy) < 0.8) {
                                anim.vx = (Math.random() - 0.5) * 2;
                                anim.vy = (Math.random() - 0.5) * 2;
                            }
                            anim.msPerStep = 50;          // 50ms per step
                            anim.maxSteps = 8;            // 8 steps = 400ms cycle, then check if scramble still active
                            anim.step = 0;
                            anim.nextStepTime = now + anim.msPerStep;
                            anim.trailPositions = [];
                            debugLog("[ANIM] Rebound converted to idle bounce at (" + anim.centerX + "," + anim.centerY + ") with velocity (" + anim.vx.toFixed(2) + "," + anim.vy.toFixed(2) + ")");
                        } else {
                            debugLog("[ANIM] Completing " + anim.type + " animation, affectsBall=" + anim.affectsBall);
                            this.completeAnimation(anim);
                            completedIndices.push(i);
                        }
                    } else {
                        // No systems available, complete normally
                        debugLog("[ANIM] Completing " + anim.type + " animation (no systems), affectsBall=" + anim.affectsBall);
                        this.completeAnimation(anim);
                        completedIndices.push(i);
                    }
                } else if (anim.type === "rebound_idle") {
                    // Idle bounce cycle complete - check if scramble still active
                    if (this.systems && this.systems.stateManager) {
                        var reboundActive = this.systems.stateManager.get('reboundActive');
                        if (reboundActive) {
                            // Continue idle bouncing - reset for next cycle
                            anim.step = 0;
                            anim.nextStepTime = now + anim.msPerStep;
                            debugLog("[ANIM] Idle bounce cycle complete, continuing...");
                        } else {
                            // Scramble resolved, complete animation
                            debugLog("[ANIM] Idle bounce complete, scramble resolved");
                            this.completeAnimation(anim);
                            completedIndices.push(i);
                        }
                    } else {
                        // No systems, complete
                        debugLog("[ANIM] Completing idle bounce (no systems)");
                        this.completeAnimation(anim);
                        completedIndices.push(i);
                    }
                } else {
                    debugLog("[ANIM] Completing " + anim.type + " animation, affectsBall=" + anim.affectsBall);
                    this.completeAnimation(anim);
                    completedIndices.push(i);
                }
            } else if (!advanced && anim.step === 0 && anim.affectsBall && typeof moveBallFrameTo === "function") {
                moveBallFrameTo(clamp(Math.round(anim.startX), 1, COURT_WIDTH),
                    clamp(Math.round(anim.startY), 1, COURT_HEIGHT));
            }
        }

        for (var j = completedIndices.length - 1; j >= 0; j--) {
            this.animations.splice(completedIndices[j], 1);
        }

        if (completedIndices.length > 0 && typeof debugLog === "function") {
            debugLog("[ANIM] Removed " + completedIndices.length + " completed animations, " + this.animations.length + " remaining");
        }
    };

    this.updateShotAnimation = function (anim) {
        var t = anim.step / anim.maxSteps;
        var dx = anim.targetX - anim.startX;
        var dy = anim.targetY - anim.startY;
        var arcHeight = Math.min(5, 3 + (anim.distance / 10));

        var x = Math.round(anim.startX + (dx * t));
        var y = Math.round(anim.startY + (dy * t) - (Math.sin(t * Math.PI) * arcHeight));
        var clampedX = clamp(x, 1, COURT_WIDTH);
        var clampedY = clamp(y, 1, COURT_HEIGHT);

        // CHECK FOR BLOCK - if ball is in arc (t > 0.1 && t < 0.5) and blocker is jumping
        if (!anim.blocked && this.systems && this.systems.stateManager && t > 0.1 && t < 0.5) {
            var activeBlock = this.systems.stateManager.get('activeBlock');
            var blockJumpTimer = this.systems.stateManager.get('blockJumpTimer');

            if (activeBlock && blockJumpTimer > 0) {
                var blocker = activeBlock;
                var blockDist = Math.sqrt(Math.pow(blocker.x - clampedX, 2) + Math.pow(blocker.y - clampedY, 2));

                if (anim.step % 3 === 0 && typeof debugLog === "function") { // Log every 3rd step to avoid spam
                    debugLog("[BLOCK WINDOW] t=" + t.toFixed(2) + ", blocker at (" + blocker.x + "," + blocker.y + "), ball at (" + clampedX + "," + clampedY + "), dist=" + blockDist.toFixed(2));
                }

                if (blockDist < 4) { // Blocker must be very close
                    if (typeof debugLog === "function") {
                        debugLog("[BLOCK CHECK] Blocker close enough! Distance: " + blockDist + ", t=" + t);
                    }
                    // Check block attribute for success
                    if (typeof getEffectiveAttribute === "function" && blocker.playerData) {
                        var ATTR_BLOCK = 3; // Block attribute index
                        var blockChance = getEffectiveAttribute(blocker.playerData, ATTR_BLOCK) * 8 + 20; // 20-100%
                        var roll = Math.random() * 100;
                        if (typeof debugLog === "function") {
                            debugLog("[BLOCK CHECK] blockChance=" + blockChance + ", roll=" + roll);
                        }
                        if (roll < blockChance) {
                            if (typeof debugLog === "function") {
                                debugLog("[BLOCK SUCCESS] Block succeeded!");
                            }
                            anim.blocked = true;
                            anim.made = false;
                            if (blocker.playerData.stats) {
                                blocker.playerData.stats.blocks++;
                                if (typeof debugLog === "function") {
                                    debugLog("[BLOCK STATS] Block count incremented to: " + blocker.playerData.stats.blocks);
                                }
                            }
                            if (typeof announceEvent === "function" && typeof getPlayerTeamName === "function") {
                                announceEvent("block", {
                                    playerName: blocker.playerData.name,
                                    player: blocker,
                                    team: getPlayerTeamName(blocker)
                                }, this.systems);
                            }
                            // TODO: Add deflection animation here if needed
                        }
                    }
                }
            }
        }

        if (typeof moveBallFrameTo === "function") {
            moveBallFrameTo(clampedX, clampedY);
        }

        if (anim.step > 0 && trailFrame) {
            var prevT = (anim.step - 1) / anim.maxSteps;
            var prevX = Math.round(anim.startX + (dx * prevT));
            var prevY = Math.round(anim.startY + (dy * prevT) - (Math.sin(prevT * Math.PI) * arcHeight));
            prevX = clamp(prevX, 1, COURT_WIDTH);
            prevY = clamp(prevY, 1, COURT_HEIGHT);

            // Draw trail to transparent overlay frame
            var trailAttr = getOnFireTrailAttr(anim.shooter, anim.step, LIGHTGRAY | WAS_BROWN);
            trailFrame.setData(prevX - 1, prevY - 1, ".", trailAttr, false);
            if (typeof debugLog === "function" && anim.step === 1) {
                debugLog("[TRAIL SHOT] Drew trail at x=" + (prevX - 1) + " y=" + (prevY - 1) + " attr=" + trailAttr);
            }

            // Track position for cleanup
            if (anim.trailPositions) {
                anim.trailPositions.push({ x: prevX - 1, y: prevY - 1 });
            }
        }
    };

    this.updatePassAnimation = function (anim) {
        if (typeof debugLog === "function") {
            debugLog("[ANIM] updatePassAnimation: step=" + anim.step + "/" + anim.maxSteps);
        }
        var t = anim.step / anim.maxSteps;
        var dx = anim.endX - anim.startX;
        var dy = anim.endY - anim.startY;

        var x = Math.round(anim.startX + (dx * t));
        var y = Math.round(anim.startY + (dy * t));
        x = clamp(x, 1, COURT_WIDTH);
        y = clamp(y, 1, COURT_HEIGHT);

        if (typeof moveBallFrameTo === "function") {
            moveBallFrameTo(x, y);
        }

        if (anim.step > 0 && trailFrame) {
            var prevT = (anim.step - 1) / anim.maxSteps;
            var prevX = Math.round(anim.startX + (dx * prevT));
            var prevY = Math.round(anim.startY + (dy * prevT));
            prevX = clamp(prevX, 1, COURT_WIDTH);
            prevY = clamp(prevY, 1, COURT_HEIGHT);

            // Draw trail to transparent overlay frame
            trailFrame.setData(prevX - 1, prevY - 1, ascii(250), LIGHTGRAY | WAS_BROWN, false);
            if (typeof debugLog === "function" && anim.step === 1) {
                debugLog("[TRAIL PASS] Drew trail at x=" + (prevX - 1) + " y=" + (prevY - 1));
            }

            // Track position for cleanup
            if (anim.trailPositions) {
                anim.trailPositions.push({ x: prevX - 1, y: prevY - 1 });
            }
        }
    };

    this.updateDunkAnimation = function (anim) {
        if (anim.step === 1) {
            debugLog("[ANIM DUNK] Starting dunk animation for " + (anim.player && anim.player.playerData ? anim.player.playerData.name : "unknown") + ", frames=" + anim.maxSteps);
        }
        if (anim.blocked) return; // Already blocked, don't continue animation

        // NOTE: anim.step has already been incremented in the main loop before this function is called
        // So we need to access frames[step - 1]. If step=1, we access frames[0] (first frame).
        // If step=maxSteps, we access frames[maxSteps-1] (last frame).
        var frameIndex = anim.step - 1;
        var frame = anim.flightPlan.frames[frameIndex];
        if (!frame) {
            debugLog("[ANIM DUNK] WARNING: No frame at index " + frameIndex + " (step=" + anim.step + ", maxSteps=" + anim.maxSteps + ", frames.length=" + anim.flightPlan.frames.length + ")");
            return;
        }

        var player = anim.player;
        var dunkInfo = anim.dunkInfo;
        var attackDir = dunkInfo.attackDir;
        var spriteWidth = (player.frame && player.frame.width) ? player.frame.width : 4;
        var spriteHeight = (player.frame && player.frame.height) ? player.frame.height : 4;

        // Move player sprite along flight path
        var spriteX = clamp(Math.round(frame.centerX) - dunkInfo.spriteHalfWidth, 1, COURT_WIDTH - spriteWidth);
        var spriteY = clamp(Math.round(frame.centerY) - dunkInfo.spriteHalfHeight, 1, COURT_HEIGHT - spriteHeight);
        player.moveTo(spriteX, spriteY);

        if (typeof player.turnTo === "function") {
            player.turnTo(attackDir > 0 ? "e" : "w");
        }

        // Render player with dunk flash label
        if (typeof renderPlayerLabel === "function" && typeof getDunkFlashPalette === "function" && typeof getDunkLabelText === "function") {
            var flashPalette = getDunkFlashPalette(player, this.systems);
            var flashText = getDunkLabelText(anim.style, anim.step);
            renderPlayerLabel(player, {
                highlightCarrier: false,
                forcedText: flashText,
                flashPalette: flashPalette,
                flashTick: anim.step,
                forceTop: true
            }, this.systems);
        }

        // Move ball with player's hand
        var handOffsetX = attackDir > 0 ? dunkInfo.spriteHalfWidth : -dunkInfo.spriteHalfWidth;
        var handX = clamp(Math.round(frame.centerX + handOffsetX + (frame.ballOffsetX || 0)), 1, COURT_WIDTH);
        var handY = clamp(Math.round(frame.centerY + dunkInfo.spriteHalfHeight - 1 + (frame.ballOffsetY || 0)), 1, COURT_HEIGHT);

        if (typeof moveBallFrameTo === "function") {
            moveBallFrameTo(handX, handY);
        }

        // Update jump indicator
        if (typeof updateJumpIndicator === "function") {
            var currentBottom = spriteY + spriteHeight;
            var prevBottom = (typeof player.prevJumpBottomY === "number") ? player.prevJumpBottomY : anim.groundBottom;
            var ascending = currentBottom <= prevBottom;

            updateJumpIndicator(player, {
                groundBottom: anim.groundBottom,
                currentBottom: currentBottom,
                ascending: ascending,
                horizontalDir: attackDir,
                spriteWidth: spriteWidth,
                spriteHeight: spriteHeight,
                spriteHalfWidth: dunkInfo.spriteHalfWidth,
                spriteHalfHeight: dunkInfo.spriteHalfHeight,
                flightFrames: anim.flightPlan.frames,
                frameIndex: frameIndex  // Use frameIndex, not anim.step
            });
            player.prevJumpBottomY = currentBottom;
        }

        // Check for block (if maybeBlockDunk available)
        if (typeof maybeBlockDunk === "function") {
            var blockCheck = maybeBlockDunk(player, {
                handX: handX,
                handY: handY,
                centerX: frame.centerX,
                centerY: frame.centerY,
                progress: frame.progress
            }, dunkInfo, anim.style, this.systems);

            if (blockCheck) {
                anim.blocked = true;
                anim.blocker = blockCheck.blocker;
                anim.made = false;
                // Force animation to complete next step
                anim.maxSteps = anim.step + 1;
            }
        }

        // Update next step time based on current frame timing
        if (anim.flightPlan.frames[anim.step + 1]) {
            anim.msPerStep = anim.flightPlan.frames[anim.step + 1].ms || 30;
        }
    };

    this.updateReboundAnimation = function (anim) {
        var bounce = anim.bounces[anim.currentBounce];
        if (!bounce) return;

        var t = anim.step / anim.maxSteps;
        var dx = bounce.endX - bounce.startX;
        var dy = bounce.endY - bounce.startY;
        var arcHeight = 2;  // Small arc for bounces

        var x = Math.round(bounce.startX + (dx * t));
        var y = Math.round(bounce.startY + (dy * t) - (Math.sin(t * Math.PI) * arcHeight));
        x = clamp(x, 1, COURT_WIDTH);
        y = clamp(y, 1, COURT_HEIGHT);

        if (typeof moveBallFrameTo === "function") {
            moveBallFrameTo(x, y);
        }

        // Draw trail for bounces (lighter, shorter trails)
        if (anim.step > 0 && trailFrame) {
            var prevT = (anim.step - 1) / anim.maxSteps;
            var prevX = Math.round(bounce.startX + (dx * prevT));
            var prevY = Math.round(bounce.startY + (dy * prevT) - (Math.sin(prevT * Math.PI) * arcHeight));
            prevX = clamp(prevX, 1, COURT_WIDTH);
            prevY = clamp(prevY, 1, COURT_HEIGHT);

            // Lighter trail for rebounds
            trailFrame.setData(prevX - 1, prevY - 1, ".", DARKGRAY | WAS_BROWN, false);

            if (anim.trailPositions) {
                anim.trailPositions.push({ x: prevX - 1, y: prevY - 1 });
            }
        }
    };

    this.updateIdleBounceAnimation = function (anim) {
        // Simple vertical bounce while ball travels across court
        // Ball moves a little each cycle (updates centerX/Y between cycles)
        var t = anim.step / anim.maxSteps;
        var bounceHeight = 1.5;

        // Current position with vertical bounce
        var x = Math.round(anim.centerX);
        var y = Math.round(anim.centerY - Math.sin(t * Math.PI) * bounceHeight);

        x = clamp(x, 1, COURT_WIDTH);
        y = clamp(y, 1, COURT_HEIGHT);

        if (typeof moveBallFrameTo === "function") {
            moveBallFrameTo(x, y);
        }

        // Light trail
        if (anim.step > 0 && anim.step % 2 === 0 && trailFrame) {
            trailFrame.setData(x - 1, y - 1, ".", DARKGRAY | WAS_BROWN, false);
            if (anim.trailPositions) {
                anim.trailPositions.push({ x: x - 1, y: y - 1 });
            }
        }
        
        // At end of bounce cycle, move ball's center position for next cycle
        if (anim.step === anim.maxSteps - 1) {
            // Apply velocity to center position
            anim.centerX += anim.vx;
            anim.centerY += anim.vy;
            
            // Bounce off boundaries
            if (anim.centerX <= 2) {
                anim.centerX = 2;
                anim.vx = Math.abs(anim.vx) * 0.8;
            } else if (anim.centerX >= COURT_WIDTH - 1) {
                anim.centerX = COURT_WIDTH - 1;
                anim.vx = -Math.abs(anim.vx) * 0.8;
            }
            
            if (anim.centerY <= 2) {
                anim.centerY = 2;
                anim.vy = Math.abs(anim.vy) * 0.8;
            } else if (anim.centerY >= COURT_HEIGHT - 1) {
                anim.centerY = COURT_HEIGHT - 1;
                anim.vy = -Math.abs(anim.vy) * 0.8;
            }
            
            // Apply decay
            anim.vx *= 0.92;
            anim.vy *= 0.92;
            
            // Stop if too slow
            if (Math.abs(anim.vx) < 0.3 && Math.abs(anim.vy) < 0.3) {
                anim.vx = 0;
                anim.vy = 0;
            }
        }
    };

    this.completeAnimation = function (anim) {
        // Clear trail positions from overlay frame by overwriting with transparent
        if (trailFrame && anim.trailPositions) {
            for (var i = 0; i < anim.trailPositions.length; i++) {
                var pos = anim.trailPositions[i];
                // Overwrite with space character and transparent attribute
                trailFrame.setData(pos.x, pos.y, " ", 0, false);
            }
            // Don't cycle here - let the main game loop cycle handle display
        }

        // Handle rebound_idle completion - position ball at ballCarrier
        if (anim.type === "rebound_idle") {
            if (this.systems && this.systems.stateManager) {
                var ballCarrier = this.systems.stateManager.get('ballCarrier');
                if (ballCarrier && typeof moveBallFrameTo === "function") {
                    var ballX = clamp(ballCarrier.x + 2, 1, COURT_WIDTH);
                    var ballY = clamp(ballCarrier.y + 2, 1, COURT_HEIGHT);
                    moveBallFrameTo(ballX, ballY);
                    debugLog("[ANIM] Rebound idle complete - ball positioned at carrier (" + ballX + "," + ballY + ")");
                }
            }
        }

        // Handle dunk completion
        if (anim.type === "dunk") {
            var player = anim.player;
            var attackDir = anim.dunkInfo.attackDir;

            // Clear jump indicator
            if (typeof clearJumpIndicator === "function") {
                clearJumpIndicator(player);
            }
            player.prevJumpBottomY = null;

            if (anim.blocked) {
                // Dunk was blocked - handle knockback and deflection
                var spriteWidth = (player.frame && player.frame.width) ? player.frame.width : 4;
                var knockbackX = clamp(player.x - attackDir * 2, 1, COURT_WIDTH - spriteWidth);
                var knockbackY = clamp(player.y + 1, 1, COURT_HEIGHT - ((player.frame && player.frame.height) ? player.frame.height : 4));
                player.moveTo(knockbackX, knockbackY);

                if (typeof player.turnTo === "function") {
                    player.turnTo(attackDir > 0 ? "e" : "w");
                }

                if (typeof renderPlayerLabel === "function") {
                    renderPlayerLabel(player, { highlightCarrier: true, forceTop: true }, this.systems);
                }

                // Deflect ball
                var deflectX = clamp(anim.targetX - attackDir * (2 + Math.round(Math.random() * 2)), 1, COURT_WIDTH);
                var deflectY = clamp(anim.targetY + 2 + Math.round(Math.random() * 2), 1, COURT_HEIGHT);

                if (typeof moveBallFrameTo === "function") {
                    moveBallFrameTo(deflectX, deflectY);
                }
            } else {
                // Dunk completed successfully - position player at rim
                var spriteWidth = (player.frame && player.frame.width) ? player.frame.width : 4;
                var finishX = clamp(anim.targetX - attackDir * 2 - anim.dunkInfo.spriteHalfWidth + 2, 1, COURT_WIDTH - spriteWidth);
                var finishY = clamp(anim.targetY - anim.dunkInfo.spriteHalfHeight, 1, COURT_HEIGHT - ((player.frame && player.frame.height) ? player.frame.height : 4));
                player.moveTo(finishX, finishY);

                if (typeof player.turnTo === "function") {
                    player.turnTo(attackDir > 0 ? "e" : "w");
                }

                if (typeof renderPlayerLabel === "function") {
                    renderPlayerLabel(player, { highlightCarrier: true, forceTop: true }, this.systems);
                }

                if (anim.made) {
                    // Ball drops through hoop - simple position update, no animation needed
                    if (typeof moveBallFrameTo === "function") {
                        moveBallFrameTo(anim.targetX, clamp(anim.targetY + 3, 1, COURT_HEIGHT));
                    }
                }
            }
        }

        // Flash basket for made shots
        if (anim.type === "shot" && anim.made && !anim.blocked) {
            this.flashBasket(anim.targetX, anim.targetY);
        }

        // Queue rebound animation after shot completes (if missed)
        if (anim.type === "shot" && !anim.made && anim.reboundBounces && anim.reboundBounces.length > 0) {
            this.queueReboundAnimation(anim.reboundBounces);
        }

        // Wave 22B: Invoke completion callback for state mutations
        if (anim.onComplete && typeof anim.onComplete === "function") {
            if (typeof log === "function") {
                log(LOG_DEBUG, "[ANIM] Invoking " + anim.type + " animation callback");
            }
            try {
                anim.onComplete(anim.stateData || {}, anim);
            } catch (e) {
                if (typeof log === "function") {
                    log(LOG_ERR, "Animation completion callback error: " + e);
                }
            }
        } else if (anim.type === "pass" || anim.type === "shot" || anim.type === "dunk") {
            // Warning: no callback registered for animation that should have one
            if (typeof log === "function") {
                log(LOG_WARNING, "[ANIM] No callback registered for " + anim.type + " animation!");
            }
        }
    };

    this.flashBasket = function (targetX, targetY) {
        // Start basket flash celebration effect
        if (typeof this.systems !== 'undefined' && this.systems && this.systems.stateManager) {
            this.systems.stateManager.set('basketFlash', {
                active: true,
                x: targetX,
                y: targetY,
                startTime: Date.now()
            }, 'basket_flash_start');
        }
    };

    this.clearBasketFlash = function () {
        // Clear basket flash and redraw court to remove stars
        if (typeof this.systems !== 'undefined' && this.systems && this.systems.stateManager) {
            this.systems.stateManager.set('basketFlash', { active: false }, 'basket_flash_clear');
            this.systems.stateManager.set('courtNeedsRedraw', true, 'clear_basket_flash');
        }
    };

    this.isBallAnimating = function () {
        for (var i = 0; i < this.animations.length; i++) {
            if (this.animations[i] && this.animations[i].affectsBall) {
                return true;
            }
        }
        return false;
    };

    /**
     * Get current ball position from idle bounce animation
     * Returns null if no idle bounce active, or {x, y} coordinates
     */
    this.getIdleBouncePosition = function () {
        for (var i = 0; i < this.animations.length; i++) {
            var anim = this.animations[i];
            if (anim && anim.type === "rebound_idle" && anim.centerX !== undefined && anim.centerY !== undefined) {
                return {
                    x: Math.round(anim.centerX),
                    y: Math.round(anim.centerY)
                };
            }
        }
        return null;
    };

    /**
     * Clear all in-flight pass animations
     * Called when a basket is scored to prevent passes from completing during celebration
     */
    this.clearPassAnimations = function () {
        var originalCount = this.animations.length;
        this.animations = this.animations.filter(function (anim) {
            return anim.type !== "pass";
        });
        var removedCount = originalCount - this.animations.length;

        if (removedCount > 0 && typeof debugLog === "function") {
            debugLog("[ANIM] Cleared " + removedCount + " in-flight pass animation(s) to prevent double possession bug");
        }

        return removedCount;
    };
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

// Global animation system instance
var animationSystem = new AnimationSystem();
