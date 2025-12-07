/**
 * animation-hint-effects.js
 * Wave 24: Client-side helpers that materialize multiplayer animation hints.
 * Drives inbound tweens (walk/ready/target) and drift snap highlight flashes
 * without blocking the main loop or touching authoritative state.
 */

(function (global) {
    var DEFAULT_CONFIG = (typeof MP_CONSTANTS === "object" && MP_CONSTANTS.ANIMATION_HINTS)
        ? MP_CONSTANTS.ANIMATION_HINTS
        : {};

    var inboundAnimations = [];
    var driftEffects = [];

    function isNumber(value) {
        return typeof value === "number" && !isNaN(value);
    }

    function getConfigSection(config, key) {
        var source = config && typeof config === "object" ? config : DEFAULT_CONFIG;
        return (source && typeof source[key] === "object") ? source[key] : {};
    }

    function bringSpriteFrameToTop(sprite) {
        if (!sprite || !sprite.frame || typeof sprite.frame.top !== "function") {
            return;
        }
        try {
            sprite.frame.top();
        } catch (e) {
            if (typeof debugLog === "function") {
                debugLog("[ANIM HINTS] Failed to raise sprite frame: " + e);
            }
        }
    }

    function lockSpriteStage(sprite, stage) {
        if (!sprite) return;
        if (!sprite.__mpHintLocks) {
            sprite.__mpHintLocks = {};
        }
        sprite.__mpHintLocks[stage || "default"] = true;
        sprite.__mpHintLock = true;
        if (sprite.__mpHintTargetId) {
            sprite.playerId = sprite.__mpHintTargetId;
        }
        if (typeof debugLog === "function") {
            try {
                debugLog("[ANIM HINT EFFECTS] locked sprite=" + (sprite.playerId || "unknown") + " stage=" + (stage || "default"));
            } catch (e) { }
        }
    }

    function unlockSpriteStage(sprite, stage) {
        if (!sprite || !sprite.__mpHintLocks) return;
        delete sprite.__mpHintLocks[stage || "default"];
        var hasLocks = false;
        for (var key in sprite.__mpHintLocks) {
            if (sprite.__mpHintLocks.hasOwnProperty(key)) {
                hasLocks = true;
                break;
            }
        }
        if (!hasLocks) {
            sprite.__mpHintLock = false;
            delete sprite.__mpHintLocks;
            if (sprite.__mpHintLockBearing !== undefined) {
                sprite.bearing = sprite.__mpHintLockBearing;
                delete sprite.__mpHintLockBearing;
            }
            if (typeof debugLog === "function") {
                try {
                    debugLog("[ANIM HINT EFFECTS] unlocked sprite=" + (sprite.playerId || "unknown"));
                } catch (e) { }
            }
        }
    }

    function applySpriteMove(sprite, x, y) {
        if (!sprite) return;
        var roundedX = Math.round(x);
        var roundedY = Math.round(y);
        if (sprite.moveTo) {
            if (sprite.x === roundedX && sprite.y === roundedY) {
                return;
            }
            sprite.moveTo(roundedX, roundedY);
            bringSpriteFrameToTop(sprite);
        } else {
            var changed = false;
            if (sprite.x !== roundedX) {
                sprite.x = roundedX;
                changed = true;
            }
            if (sprite.y !== roundedY) {
                sprite.y = roundedY;
                changed = true;
            }
            if (changed && sprite.frame && typeof sprite.frame.invalidate === "function") {
                sprite.frame.invalidate();
            }
            if (changed) {
                bringSpriteFrameToTop(sprite);
            }
        }
    }

    function registerInboundAnimation(sprite, stage, targetX, targetY, totalFrames, meta) {
        if (!sprite || !isNumber(targetX) || !isNumber(targetY)) return;
        if (typeof totalFrames !== "number" || totalFrames <= 0) return;

        if (meta && typeof meta.targetId !== "undefined") {
            sprite.__mpHintTargetId = meta.targetId;
        }
        if (sprite.__mpHintTargetId && !sprite.playerId) {
            sprite.playerId = sprite.__mpHintTargetId;
        }

        if (!sprite.__mpHintAnimations) {
            sprite.__mpHintAnimations = {};
        }

        var store = sprite.__mpHintAnimations;
        var anim = store[stage];
        var startX = isNumber(sprite.x) ? sprite.x : targetX;
        var startY = isNumber(sprite.y) ? sprite.y : targetY;

        if (anim) {
            anim.targetX = targetX;
            anim.targetY = targetY;
            anim.totalFrames = totalFrames;
            if (!anim.active) {
                anim.startX = startX;
                anim.startY = startY;
                anim.elapsedFrames = 0;
                anim.active = true;
            }
            if (inboundAnimations.indexOf(anim) === -1) {
                inboundAnimations.push(anim);
            }
        } else {
            anim = {
                sprite: sprite,
                stage: stage,
                startX: startX,
                startY: startY,
                targetX: targetX,
                targetY: targetY,
                totalFrames: totalFrames,
                elapsedFrames: 0,
                active: true
            };
            store[stage] = anim;
            inboundAnimations.push(anim);
        }
        lockSpriteStage(sprite, stage);
    }

    function startInboundWalkAnimation(sprite, meta, config) {
        if (!sprite || !meta) return;
        var inboundConfig = getConfigSection(config, "INBOUND");
        var totalFrames = (typeof inboundConfig.WALK_FRAMES === "number" && inboundConfig.WALK_FRAMES > 0)
            ? Math.floor(inboundConfig.WALK_FRAMES)
            : 24;

        var targetX = null;
        var targetY = null;
        if (!meta.skipBallPickup && isNumber(meta.pickupX) && isNumber(meta.pickupY)) {
            targetX = meta.pickupX;
            targetY = meta.pickupY;
        } else if (isNumber(meta.targetX) && isNumber(meta.targetY)) {
            targetX = meta.targetX;
            targetY = meta.targetY;
        }

        if (!isNumber(targetX) || !isNumber(targetY)) {
            return;
        }

        registerInboundAnimation(sprite, "inbound_walk", targetX, targetY, totalFrames, meta);
        if (typeof sprite === "object") {
            sprite.__mpHintLockBearing = sprite.bearing || null;
        }
        if (typeof debugLog === "function") {
            try {
                debugLog("[ANIM HINT EFFECTS] inbound_walk sprite=" + (sprite.playerId || "unknown") +
                    " target=(" + targetX + "," + targetY + ")");
            } catch (e) { }
        }
    }

    function startInboundReadyAnimation(sprite, meta, config) {
        if (!sprite || !meta) return;
        if (sprite.__mpHintAnimations && sprite.__mpHintAnimations.inbound_walk && sprite.__mpHintAnimations.inbound_walk.active) {
            // Defer until walk animation completes (next hint refresh)
            return;
        }

        var inboundConfig = getConfigSection(config, "INBOUND");
        var totalFrames = (typeof inboundConfig.READY_FRAMES === "number" && inboundConfig.READY_FRAMES > 0)
            ? Math.floor(inboundConfig.READY_FRAMES)
            : 70;

        if (!isNumber(meta.targetX) || !isNumber(meta.targetY)) {
            return;
        }

        registerInboundAnimation(sprite, "inbound_ready", meta.targetX, meta.targetY, totalFrames, meta);
        if (typeof debugLog === "function") {
            try {
                debugLog("[ANIM HINT EFFECTS] inbound_ready sprite=" + (sprite.playerId || "unknown") +
                    " target=(" + meta.targetX + "," + meta.targetY + ")");
            } catch (e) { }
        }
    }

    function startInboundTargetAnimation(sprite, meta, config) {
        if (!sprite || !meta) return;
        var inboundConfig = getConfigSection(config, "INBOUND");
        var totalFrames = (typeof inboundConfig.TARGET_FRAMES === "number" && inboundConfig.TARGET_FRAMES > 0)
            ? Math.floor(inboundConfig.TARGET_FRAMES)
            : 70;

        if (!isNumber(meta.targetX) || !isNumber(meta.targetY)) {
            return;
        }

        registerInboundAnimation(sprite, "inbound_target", meta.targetX, meta.targetY, totalFrames, meta);
        if (typeof debugLog === "function") {
            try {
                debugLog("[ANIM HINT EFFECTS] inbound_target sprite=" + (sprite.playerId || "unknown") +
                    " target=(" + meta.targetX + "," + meta.targetY + ")");
            } catch (e) { }
        }
    }

    function updateInboundAnimations() {
        for (var i = inboundAnimations.length - 1; i >= 0; i--) {
            var anim = inboundAnimations[i];
            if (!anim || !anim.active || !anim.sprite) {
                if (anim && anim.sprite) {
                    if (anim.sprite.__mpHintAnimations) {
                        delete anim.sprite.__mpHintAnimations[anim.stage];
                    }
                    unlockSpriteStage(anim.sprite, anim.stage);
                }
                inboundAnimations.splice(i, 1);
                continue;
            }

            var sprite = anim.sprite;
            var deltaX = anim.targetX - anim.startX;
            var deltaY = anim.targetY - anim.startY;
            var step = anim.elapsedFrames + 1;
            var progress = Math.min(1, Math.max(0, step / anim.totalFrames));
            var nextX = anim.startX + deltaX * progress;
            var nextY = anim.startY + deltaY * progress;
            applySpriteMove(sprite, nextX, nextY);

            anim.elapsedFrames = step;
            if (anim.elapsedFrames >= anim.totalFrames) {
                applySpriteMove(sprite, anim.targetX, anim.targetY);
                anim.active = false;
            }

            if (!anim.active) {
                if (sprite.__mpHintAnimations) {
                    delete sprite.__mpHintAnimations[anim.stage];
                }
                unlockSpriteStage(sprite, anim.stage);
                inboundAnimations.splice(i, 1);
            }
        }
    }

    function frameContains(x, y) {
        if (typeof x !== "number" || typeof y !== "number") return false;
        if (!global.trailFrame) return false;
        if (typeof global.trailFrame.width === "number" && (x < 0 || x >= global.trailFrame.width)) return false;
        if (typeof global.trailFrame.height === "number" && (y < 0 || y >= global.trailFrame.height)) return false;
        return x >= 0 && y >= 0;
    }

    function clearTrailPositions(positions) {
        if (!positions || !positions.length) return;
        if (!global.trailFrame) return;
        var hasClearData = typeof global.trailFrame.clearData === "function";
        var hasSetData = typeof global.trailFrame.setData === "function";
        if (!hasClearData && !hasSetData) return;
        for (var i = 0; i < positions.length; i++) {
            var pos = positions[i];
            if (!pos) continue;
            if (hasClearData) {
                global.trailFrame.clearData(pos.x, pos.y, false);
            } else if (hasSetData) {
                global.trailFrame.setData(pos.x, pos.y, undefined, 0, false);
            }
        }
    }

    function drawTrailCross(baseX, baseY, radius, store) {
        if (!global.trailFrame || typeof global.trailFrame.setData !== "function") return;
        var roundedX = Math.round(baseX);
        var roundedY = Math.round(baseY);
        var primaryColor = null;
        if (typeof LIGHTYELLOW !== "undefined") {
            primaryColor = LIGHTYELLOW;
        } else if (typeof YELLOW !== "undefined") {
            primaryColor = YELLOW;
        } else if (typeof WHITE !== "undefined") {
            primaryColor = WHITE;
        } else if (typeof LIGHTGRAY !== "undefined") {
            primaryColor = LIGHTGRAY;
        }
        if (primaryColor === null) {
            return;
        }

        var secondaryColor = (typeof YELLOW !== "undefined") ? YELLOW : primaryColor;
        var attrPrimary = primaryColor | WAS_BROWN;
        var attrSecondary = secondaryColor | WAS_BROWN;
        var charPrimary = radius > 1 ? "X" : "*";
        var charSecondary = "+";
        var drawn = [];

        function pushAndDraw(fx, fy, ch, attr) {
            if (!frameContains(fx, fy)) return;
            global.trailFrame.setData(fx, fy, ch, attr, false);
            drawn.push({ x: fx, y: fy });
        }

        // Center point
        pushAndDraw(roundedX - 1, roundedY - 1, charPrimary, attrPrimary);

        for (var r = 1; r <= radius; r++) {
            pushAndDraw(roundedX - 1 + r, roundedY - 1, charSecondary, attrSecondary);
            pushAndDraw(roundedX - 1 - r, roundedY - 1, charSecondary, attrSecondary);
            pushAndDraw(roundedX - 1, roundedY - 1 + r, charSecondary, attrSecondary);
            pushAndDraw(roundedX - 1, roundedY - 1 - r, charSecondary, attrSecondary);
        }

        if (Array.isArray(store)) {
            for (var i = 0; i < drawn.length; i++) {
                store.push(drawn[i]);
            }
        }
    }

    function startDriftSnapEffect(sprite, meta, config) {
        if (!sprite) return;
        var driftConfig = getConfigSection(config, "DRIFT");
        var flashFrames = (typeof driftConfig.FLASH_FRAMES === "number" && driftConfig.FLASH_FRAMES > 0)
            ? Math.floor(driftConfig.FLASH_FRAMES)
            : 8;
        var lerpFrames = (typeof driftConfig.LERP_FRAMES === "number" && driftConfig.LERP_FRAMES > 0)
            ? Math.floor(driftConfig.LERP_FRAMES)
            : 6;

        var effect = sprite.__mpDriftEffect;
        if (effect) {
            effect.framesRemaining = flashFrames;
            effect.totalFrames = flashFrames;
            effect.initialRadius = Math.max(1, lerpFrames);
            effect.lastDrawn = [];
            effect.elapsed = 0;
            effect.startX = isNumber(sprite.x) ? sprite.x : 0;
            effect.startY = isNumber(sprite.y) ? sprite.y : 0;
            effect.targetX = isNumber(meta && meta.authorityX) ? meta.authorityX : effect.startX;
            effect.targetY = isNumber(meta && meta.authorityY) ? meta.authorityY : effect.startY;
            effect.lerpFrames = lerpFrames;
            if (driftEffects.indexOf(effect) === -1) {
                driftEffects.push(effect);
            }
            return;
        }

        effect = {
            sprite: sprite,
            framesRemaining: flashFrames,
            totalFrames: flashFrames,
            initialRadius: Math.max(1, lerpFrames),
            lastDrawn: [],
            elapsed: 0,
            startX: isNumber(sprite.x) ? sprite.x : 0,
            startY: isNumber(sprite.y) ? sprite.y : 0,
            targetX: isNumber(meta && meta.authorityX) ? meta.authorityX : (isNumber(sprite.x) ? sprite.x : 0),
            targetY: isNumber(meta && meta.authorityY) ? meta.authorityY : (isNumber(sprite.y) ? sprite.y : 0),
            lerpFrames: lerpFrames
        };
        sprite.__mpDriftEffect = effect;
        driftEffects.push(effect);
    }

    function updateDriftEffects() {
        for (var i = driftEffects.length - 1; i >= 0; i--) {
            var effect = driftEffects[i];
            if (!effect || !effect.sprite) {
                if (effect && effect.lastDrawn) {
                    clearTrailPositions(effect.lastDrawn);
                }
                if (effect && effect.sprite) {
                    effect.sprite.__mpDriftEffect = null;
                }
                driftEffects.splice(i, 1);
                continue;
            }

            effect.elapsed += 1;
            if (effect.lerpFrames > 0 && effect.elapsed <= effect.lerpFrames) {
                var t = effect.elapsed / effect.lerpFrames;
                var nextX = effect.startX + (effect.targetX - effect.startX) * t;
                var nextY = effect.startY + (effect.targetY - effect.startY) * t;
                applySpriteMove(effect.sprite, nextX, nextY);
            }

            clearTrailPositions(effect.lastDrawn);
            effect.lastDrawn = [];
            if (effect.framesRemaining > 0) {
                var progress = 1 - (effect.framesRemaining / effect.totalFrames);
                var radius = effect.initialRadius > 1
                    ? Math.max(1, Math.round(effect.initialRadius - progress * (effect.initialRadius - 1)))
                    : 1;
                drawTrailCross(effect.sprite.x || 0, effect.sprite.y || 0, radius, effect.lastDrawn);
            }

            effect.framesRemaining -= 1;
            if (effect.framesRemaining <= 0) {
                clearTrailPositions(effect.lastDrawn);
                effect.sprite.__mpDriftEffect = null;
                driftEffects.splice(i, 1);
            }
        }
    }

    function updateAnimationHintEffects() {
        updateInboundAnimations();
        updateDriftEffects();
    }

    global.startInboundWalkAnimation = startInboundWalkAnimation;
    global.startInboundReadyAnimation = startInboundReadyAnimation;
    global.startInboundTargetAnimation = startInboundTargetAnimation;
    global.startDriftSnapEffect = startDriftSnapEffect;
    global.updateAnimationHintEffects = updateAnimationHintEffects;
})(this);
