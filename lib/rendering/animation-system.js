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

    this.queueShotAnimation = function (startX, startY, targetX, targetY, made, blocked, shooter, durationMs, reboundBounces) {
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
            reboundBounces: reboundBounces  // Store rebound data to queue after shot completes
        });
    };

    this.queuePassAnimation = function (startX, startY, endX, endY, interceptor, durationMs) {
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
            interceptor: interceptor,
            step: 0,
            maxSteps: timing.steps,
            distance: timing.distance,
            msPerStep: timing.msPerStep,
            nextStepTime: now + timing.msPerStep,
            affectsBall: true,
            trailPositions: []  // Track trail positions for cleanup
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

        if (anim.type === "shot" && anim.made && !anim.blocked) {
            this.flashBasket(anim.targetX, anim.targetY);
        }

        // Queue rebound animation after shot completes (if missed)
        if (anim.type === "shot" && !anim.made && anim.reboundBounces && anim.reboundBounces.length > 0) {
            this.queueReboundAnimation(anim.reboundBounces);
        }
    };

    this.flashBasket = function (targetX, targetY) {
        if (!courtFrame) return;

        var maxFlashes = 3;
        for (var flash = 0; flash < maxFlashes; flash++) {
            courtFrame.gotoxy(targetX - 1, targetY);
            courtFrame.putmsg("*", YELLOW | WAS_BROWN);
            courtFrame.gotoxy(targetX + 1, targetY);
            courtFrame.putmsg("*", YELLOW | WAS_BROWN);
            cycleFrame(courtFrame);
            mswait(100);
            drawCourt();
            mswait(100);
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
}

// ============================================================================
// GLOBAL INSTANCE
// ============================================================================

// Global animation system instance
var animationSystem = new AnimationSystem();
