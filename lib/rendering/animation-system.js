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
    var msPerStep = Math.max(16, Math.round(800 / steps));
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
    var msPerStep = Math.max(15, Math.round(totalTime / steps));
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
        if (!player || !dunkInfo || !flightPlan || !flightPlan.frames) return;

        var now = Date.now();
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
            maxSteps: flightPlan.frames.length,
            msPerStep: flightPlan.frames[0] ? (flightPlan.frames[0].ms || 30) : 30,
            nextStepTime: now + (flightPlan.frames[0] ? (flightPlan.frames[0].ms || 30) : 30),
            affectsBall: true,
            groundBottom: player.y + ((player.frame && player.frame.height) ? player.frame.height : 4),
            onComplete: onComplete
        });
    };

    this.update = function () {
        if (!courtFrame) return;

        var now = Date.now();
        var completedIndices = [];

        for (var i = 0; i < this.animations.length; i++) {
            var anim = this.animations[i];
            if (!anim.msPerStep || anim.msPerStep <= 0) anim.msPerStep = 50;
            if (!anim.nextStepTime) anim.nextStepTime = now;

            var advanced = false;
            while (anim.step < anim.maxSteps && now >= anim.nextStepTime) {
                anim.step++;
                advanced = true;

                if (anim.type === "shot") {
                    this.updateShotAnimation(anim);
                } else if (anim.type === "pass") {
                    this.updatePassAnimation(anim);
                } else if (anim.type === "rebound") {
                    this.updateReboundAnimation(anim);
                } else if (anim.type === "dunk") {
                    this.updateDunkAnimation(anim);
                }

                anim.nextStepTime += anim.msPerStep;
            }

            if (anim.step >= anim.maxSteps) {
                // For rebound, check if there are more bounces
                if (anim.type === "rebound" && anim.currentBounce < anim.bounces.length - 1) {
                    anim.currentBounce++;
                    anim.step = 0;
                    anim.nextStepTime = now + anim.msPerStep;
                } else {
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

            // Track position for cleanup
            if (anim.trailPositions) {
                anim.trailPositions.push({ x: prevX - 1, y: prevY - 1 });
            }
        }
    };

    this.updatePassAnimation = function (anim) {
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

            // Track position for cleanup
            if (anim.trailPositions) {
                anim.trailPositions.push({ x: prevX - 1, y: prevY - 1 });
            }
        }
    };

    this.updateDunkAnimation = function (anim) {
        if (anim.blocked) return; // Already blocked, don't continue animation

        var frame = anim.flightPlan.frames[anim.step];
        if (!frame) return;

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
            var flashPalette = getDunkFlashPalette(player);
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
                frameIndex: anim.step
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
            }, dunkInfo, anim.style);

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

    this.completeAnimation = function (anim) {
        // Clear trail positions from overlay frame
        if (trailFrame && anim.trailPositions) {
            for (var i = 0; i < anim.trailPositions.length; i++) {
                var pos = anim.trailPositions[i];
                trailFrame.setData(pos.x, pos.y, undefined, 0, false);
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
        // Basket flash is handled by SHOT_SCORED phase now
        // No need to block here - just a visual marker
        if (!courtFrame) return;

        courtFrame.gotoxy(targetX - 1, targetY);
        courtFrame.putmsg("*", YELLOW | WAS_BROWN);
        courtFrame.gotoxy(targetX + 1, targetY);
        courtFrame.putmsg("*", YELLOW | WAS_BROWN);
        cycleFrame(courtFrame);
    };

    this.isBallAnimating = function () {
        for (var i = 0; i < this.animations.length; i++) {
            if (this.animations[i] && this.animations[i].affectsBall) {
                return true;
            }
        }
        return false;
    };
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

// Global animation system instance
var animationSystem = new AnimationSystem();
