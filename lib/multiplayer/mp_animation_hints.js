// mp_animation_hints.js - Coordinator-side animation hint tracker (Wave 24)
// Generates short-lived animation triggers that piggyback on the
// authoritative state packet. The tracker remains stateless outside of
// small caches so hints can be derived every broadcast without blocking
// core simulation.

function cloneHintMeta(meta) {
    if (!meta || typeof meta !== "object") {
        return {};
    }
    var copy = {};
    for (var key in meta) {
        if (meta.hasOwnProperty(key)) {
            copy[key] = meta[key];
        }
    }
    return copy;
}

function createAnimationHintTracker(options) {
    options = options || {};

    var constants = options.constants || {};
    var ttlFrames = (typeof constants.TTL_FRAMES === "number" && constants.TTL_FRAMES > 0)
        ? Math.floor(constants.TTL_FRAMES)
        : 12;
    var maxPerPacket = (typeof constants.MAX_PER_PACKET === "number" && constants.MAX_PER_PACKET > 0)
        ? Math.floor(constants.MAX_PER_PACKET)
        : 4;
    var stateManager = options.stateManager || null;
    var idResolver = (typeof options.getSpriteId === "function") ? options.getSpriteId : null;

    var activeHints = {};
    var hintOrder = [];
    var lastInbounding = false;

    function resetInternalState() {
        activeHints = {};
        hintOrder = [];
        lastInbounding = false;
    }

    function makeKey(type, targetId) {
        return type + ":" + targetId;
    }

    function pruneExpired(frameNumber) {
        for (var i = hintOrder.length - 1; i >= 0; i--) {
            var key = hintOrder[i];
            var record = activeHints[key];
            if (!record || record.expiresAt <= frameNumber) {
                hintOrder.splice(i, 1);
                delete activeHints[key];
            }
        }
    }

    function resolveSpriteId(sprite) {
        if (!sprite) {
            return null;
        }
        var id = null;
        if (idResolver) {
            try {
                id = idResolver(sprite) || null;
            } catch (e) {
                if (typeof debugLog === "function") {
                    debugLog("[ANIM HINTS] Failed to resolve sprite id via resolver: " + e);
                }
            }
        }
        if (!id && typeof getPlayerGlobalId === "function") {
            try {
                id = getPlayerGlobalId(sprite) || null;
            } catch (resolverErr) {
                if (typeof debugLog === "function") {
                    debugLog("[ANIM HINTS] getPlayerGlobalId error: " + resolverErr);
                }
            }
        }
        if (!id && typeof sprite === "object" && typeof debugLog === "function") {
            try {
                debugLog("[ANIM HINTS] Unable to resolve sprite id (playerId=" + (sprite.playerId || "unknown") + ")");
            } catch (e) { }
        }
        return id;
    }

    function ensureHint(type, targetId, frameNumber, meta) {
        if (!type || !targetId) {
            return;
        }
        var key = makeKey(type, targetId);
        var payloadMeta = cloneHintMeta(meta);
        payloadMeta.targetId = targetId;
        var record = activeHints[key];
        if (!record) {
            activeHints[key] = {
                type: type,
                target: targetId,
                meta: payloadMeta,
                createdAt: frameNumber,
                expiresAt: frameNumber + ttlFrames
            };
            hintOrder.push(key);
        } else {
            record.meta = payloadMeta;
            record.expiresAt = frameNumber + ttlFrames;
        }
        if (typeof debugLog === "function") {
            try {
                debugLog("[ANIM HINTS] ensureHint type=" + type + " target=" + targetId + " frame=" + frameNumber);
            } catch (e) { }
        }
    }

    function resolveInbounderSprite(sm) {
        var passData = sm.get('inboundPassData');
        if (passData && passData.inbounder) {
            return passData.inbounder;
        }
        var positioning = sm.get('inboundPositioning');
        if (positioning && positioning.inbounder) {
            return positioning.inbounder.sprite || positioning.inbounder;
        }
        return sm.get('inboundPasser') || null;
    }

    function resolveInboundReceiverSprite(sm) {
        var passData = sm.get('inboundPassData');
        if (passData && passData.receiver) {
            return passData.receiver;
        }
        var positioning = sm.get('inboundPositioning');
        if (positioning && positioning.receiver) {
            return positioning.receiver.sprite || positioning.receiver;
        }
        return null;
    }

    function safeNumber(value) {
        return (typeof value === "number" && !isNaN(value)) ? value : null;
    }

    function logInboundState(message, details) {
        if (typeof debugLog !== "function") return;
        try {
            var parts = [];
            for (var key in details) {
                if (details.hasOwnProperty(key)) {
                    parts.push(key + "=" + details[key]);
                }
            }
            debugLog("[ANIM HINTS] " + message + (parts.length ? " (" + parts.join(", ") + ")" : ""));
        } catch (e) {
            // Ignore logging errors
        }
    }

    function applyInboundHints(frameNumber, sm) {
        var inbounding = !!sm.get('inbounding');
        var positioning = sm.get('inboundPositioning') || null;
        var inbounderData = (positioning && positioning.inbounder) ? positioning.inbounder : null;
        var receiverData = (positioning && positioning.receiver) ? positioning.receiver : null;
        var phaseObj = sm.get('phase');
        var phaseData = (phaseObj && phaseObj.data) ? phaseObj.data : {};
        var ballPickupX = safeNumber(phaseData.ballPickupX);
        var ballPickupY = safeNumber(phaseData.ballPickupY);
        var skipBallPickup = !!(positioning && positioning.skipBallPickup);

        if (inbounding) {
            logInboundState("state", {
                frame: frameNumber,
                positioning: positioning ? "yes" : "no",
                inbounderSprite: resolveSpriteId(inbounderData && inbounderData.sprite ? inbounderData.sprite : inbounderData),
                receiverSprite: resolveSpriteId(receiverData && receiverData.sprite ? receiverData.sprite : receiverData),
                skipPickup: skipBallPickup,
                pickupX: ballPickupX,
                pickupY: ballPickupY
            });
        }

        if (inbounding && !lastInbounding) {
            var walkSprite = resolveInbounderSprite(sm);
            var walkId = resolveSpriteId(walkSprite);
            if (walkId) {
                ensureHint('inbound_walk', walkId, frameNumber, {
                    stage: 'walk',
                    pickupX: ballPickupX,
                    pickupY: ballPickupY,
                    targetX: inbounderData ? safeNumber(inbounderData.targetX) : null,
                    targetY: inbounderData ? safeNumber(inbounderData.targetY) : null,
                    skipBallPickup: skipBallPickup
                });
            }
        }

        if (inbounding) {
            var inbounderSprite = resolveInbounderSprite(sm);
            var inbounderId = resolveSpriteId(inbounderSprite);
            if (inbounderId) {
                ensureHint('inbound_ready', inbounderId, frameNumber, {
                    stage: 'ready',
                    targetX: inbounderData ? safeNumber(inbounderData.targetX) : null,
                    targetY: inbounderData ? safeNumber(inbounderData.targetY) : null
                });
            }

            var receiverSprite = resolveInboundReceiverSprite(sm);
            var receiverId = resolveSpriteId(receiverSprite);
            if (receiverId) {
                ensureHint('inbound_target', receiverId, frameNumber, {
                    stage: 'target',
                    targetX: receiverData ? safeNumber(receiverData.targetX) : null,
                    targetY: receiverData ? safeNumber(receiverData.targetY) : null
                });
            }
        }

        lastInbounding = inbounding;
    }

    return {
        evaluate: function (frameNumber, injectedStateManager, injectedResolver) {
            if (typeof frameNumber !== "number") {
                frameNumber = 0;
            }
            if (injectedStateManager) {
                stateManager = injectedStateManager;
            }
            if (typeof injectedResolver === "function") {
                idResolver = injectedResolver;
            }

            if (!stateManager) {
                return [];
            }

            pruneExpired(frameNumber);
            applyInboundHints(frameNumber, stateManager);
            pruneExpired(frameNumber); // Clean up hints that expired after updates

            var result = [];
            for (var i = 0; i < hintOrder.length && result.length < maxPerPacket; i++) {
                var key = hintOrder[i];
                var record = activeHints[key];
                if (!record) {
                    continue;
                }
                var ttl = record.expiresAt - frameNumber;
                if (ttl <= 0) {
                    continue;
                }
                result.push({
                    type: record.type,
                    target: record.target,
                    ttl: ttl,
                    meta: cloneHintMeta(record.meta)
                });
            }
            if (result.length && typeof debugLog === "function") {
                try {
                    debugLog("[ANIM HINTS] Emitting " + result.length + " hint(s) at frame " + frameNumber);
                } catch (e) { }
            }
            return result;
        },

        setStateManager: function (sm) {
            stateManager = sm || null;
        },

        setIdResolver: function (resolver) {
            idResolver = (typeof resolver === "function") ? resolver : null;
        },

        recordEvent: function (eventType, payload, frameNumber) {
            if (!payload) {
                return;
            }
            if (typeof frameNumber !== "number") {
                frameNumber = 0;
            }

            if (eventType === 'drift_snap') {
                var targetId = payload.targetId || null;
                if (targetId) {
                    ensureHint('drift_snap', targetId, frameNumber, {
                        stage: 'snap'
                    });
                }
                return;
            }

            if (eventType === 'shove_knockback') {
                var victimId = (typeof payload.victimId === "number") ? payload.victimId : null;
                if (!victimId) {
                    return;
                }
                var attackerId = (typeof payload.attackerId === "number") ? payload.attackerId : null;
                var pushDistance = (typeof payload.pushDistance === "number") ? payload.pushDistance : null;
                var victimPos = null;
                if (payload.victimPos && typeof payload.victimPos.x === "number" && typeof payload.victimPos.y === "number") {
                    victimPos = {
                        x: payload.victimPos.x,
                        y: payload.victimPos.y
                    };
                }
                ensureHint('shove_knockback', victimId, frameNumber, {
                    stage: 'knockback',
                    attackerId: attackerId,
                    pushDistance: pushDistance,
                    victimPos: victimPos
                });
            }
        },

        reset: function () {
            resetInternalState();
        }
    };
}
