function createStatTrailSystem(deps) {
    if (!deps || !deps.state || !deps.constants) {
        throw new Error("StatTrailSystem: Missing required dependencies");
    }

    var stateManager = deps.state;
    var config = deps.constants || {};
    var helperClamp = (deps.helpers && typeof deps.helpers.clamp === "function")
        ? deps.helpers.clamp
        : (typeof clamp === "function" ? clamp : function (value, min, max) {
            if (value < min) return min;
            if (value > max) return max;
            return value;
        });

    function asNumber(value, fallback) {
        return (typeof value === "number" && !isNaN(value)) ? value : fallback;
    }

    var lifetimeFrames = asNumber(config.LIFETIME_FRAMES, 72);
    var fadeFrames = Math.max(0, asNumber(config.FADE_FRAMES, 18));
    var risePerFrame = asNumber(config.RISE_PER_FRAME, 0.12);
    var driftPerFrame = asNumber(config.HORIZONTAL_DRIFT_PER_FRAME, 0);
    var blinkIntervalFrames = Math.max(1, Math.floor(asNumber(config.BLINK_INTERVAL_FRAMES, 2)) || 1);
    var originYOffset = asNumber(config.ORIGIN_Y_OFFSET, -1);
    var maxActive = Math.max(1, Math.floor(asNumber(config.MAX_ACTIVE, 4)) || 1);
    var defaultFlashFg = (typeof WHITE === "number") ? WHITE : 15;
    var flashFgColor = ((typeof config.FLASH_FG_COLOR === "number") ? config.FLASH_FG_COLOR : defaultFlashFg) & FG_MASK;
    var sidelineMargin = Math.max(0, Math.floor(asNumber(config.SIDELINE_MARGIN, 1)) || 0);
    var baselineMargin = Math.max(0, Math.floor(asNumber(config.BASELINE_MARGIN, 1)) || 0);
    var availableWidth = Math.max(1, COURT_WIDTH - (sidelineMargin * 2));
    var flashCycleLength = Math.max(2, blinkIntervalFrames * 2);
    var baseRise = risePerFrame;
    var riseSlowPerFrame = Math.max(0, asNumber(config.RISE_SLOW_PER_FRAME, baseRise * 0.55));
    var riseFastPerFrame = Math.max(riseSlowPerFrame, asNumber(config.RISE_FAST_PER_FRAME, baseRise));
    var riseAccelerationExp = Math.max(1, asNumber(config.RISE_ACCELERATION_EXP, 2.4));
    var finalFgColor = (typeof config.FINAL_FG_COLOR === "number") ? (config.FINAL_FG_COLOR & FG_MASK) : null;
    var defaultFinalFadeFrames = Math.max(3, Math.floor(fadeFrames / 2) || 0);
    var finalFadeFrames = Math.max(0, Math.min(fadeFrames, Math.floor(asNumber(config.FINAL_FADE_FRAMES, defaultFinalFadeFrames)) || 0));
    var statTypeColorMap = normalizeStatTypeColors(config.STAT_TYPE_COLORS);

    var activeEntries = [];
    var cachedTrailFrame = null;

    function markCourtDirty(reason) {
        if (!stateManager || typeof stateManager.set !== "function") {
            return;
        }
        stateManager.set("courtNeedsRedraw", true, reason || "stat_trail_cleanup");
    }

    function ensureTrailFrame() {
        if (cachedTrailFrame && cachedTrailFrame.is_open) {
            return cachedTrailFrame;
        }
        if (typeof FrameManager === "object" && FrameManager && typeof FrameManager.ensure === "function") {
            cachedTrailFrame = FrameManager.ensure("trail");
            return cachedTrailFrame;
        }
        return null;
    }

    function clearRenderedGlyphs(entry, frame) {
        if (!entry || !entry.rendered || !entry.rendered.length || !frame) {
            return;
        }
        var hasClearData = typeof frame.clearData === "function";
        var hasSetData = typeof frame.setData === "function";
        for (var i = 0; i < entry.rendered.length; i++) {
            var coord = entry.rendered[i];
            if (!coord) continue;
            if (hasClearData) {
                frame.clearData(coord.x, coord.y, false);
            } else if (hasSetData) {
                frame.setData(coord.x, coord.y, undefined, 0, false);
            }
        }
        entry.rendered.length = 0;
    }

    function computeTeamAttr(teamKey) {
        var colors = stateManager.get("teamColors") || {};
        var teamInfo = colors[teamKey] || {};
        var accent = (typeof teamInfo.fg_accent === "number") ? (teamInfo.fg_accent & FG_MASK) : null;
        var primary = (typeof teamInfo.fg === "number") ? (teamInfo.fg & FG_MASK) : null;
        var fgValue = accent !== null ? accent : (primary !== null ? primary : LIGHTCYAN);
        if (typeof composeAttrWithColor === "function") {
            return composeAttrWithColor(LIGHTGRAY | BG_BLACK, fgValue, BG_BLACK);
        }
        return (fgValue & FG_MASK) | BG_BLACK;
    }

    function composeAttrFromFg(fgValue, bgValue, baseAttr) {
        if (typeof fgValue !== "number") return null;
        var fg = fgValue & FG_MASK;
        var bg = (typeof bgValue === "number") ? (bgValue & BG_MASK) : BG_BLACK;
        if (typeof composeAttrWithColor === "function") {
            return composeAttrWithColor(baseAttr || (fg | bg), fg, bg);
        }
        return fg | bg;
    }

    function normalizeStatTypeColors(map) {
        var normalized = {};
        if (!map || typeof map !== "object") {
            return normalized;
        }
        for (var key in map) {
            if (!map.hasOwnProperty(key)) continue;
            var value = map[key];
            if (typeof value === "number") {
                normalized[String(key).toLowerCase()] = value & FG_MASK;
            }
        }
        return normalized;
    }

    function resolveStatTypeAttr(statType, bgValue) {
        if (!statType) return null;
        var lookupKey = String(statType).toLowerCase();
        var fgValue;
        if (statTypeColorMap.hasOwnProperty(lookupKey)) {
            fgValue = statTypeColorMap[lookupKey];
        } else if (statTypeColorMap.hasOwnProperty("default")) {
            fgValue = statTypeColorMap["default"];
        }
        if (typeof fgValue !== "number") {
            return null;
        }
        return composeAttrFromFg(fgValue, bgValue, null);
    }

    function composeFlashAttr(baseAttr) {
        if (flashFgColor === null || flashFgColor === undefined) return null;
        var fgValue = flashFgColor & FG_MASK;
        var baseBg = baseAttr & BG_MASK;
        if (typeof composeAttrWithColor === "function") {
            return composeAttrWithColor(baseAttr, fgValue, baseBg);
        }
        return fgValue | baseBg;
    }

    function composeFinalAttr(baseAttr) {
        if (finalFgColor === null || finalFgColor === undefined) return null;
        var baseBg = baseAttr & BG_MASK;
        return composeAttrFromFg(finalFgColor, baseBg, baseAttr);
    }

    function resolveAttr(payload) {
        if (payload && typeof payload.attr === "number") {
            return payload.attr;
        }
        if (payload && typeof payload.color === "number") {
            return payload.color;
        }
        var fg = (payload && typeof payload.fg === "number") ? (payload.fg & FG_MASK) : null;
        var bg = (payload && typeof payload.bg === "number") ? (payload.bg & BG_MASK) : BG_BLACK;
        if (fg !== null) {
            return composeAttrFromFg(fg, bg, null);
        }
        var statAttr = resolveStatTypeAttr(payload ? payload.statType : null, bg);
        if (statAttr !== null) {
            return statAttr;
        }
        var defaultStatAttr = resolveStatTypeAttr("default", bg);
        if (defaultStatAttr !== null) {
            return defaultStatAttr;
        }
        if (payload && typeof payload.teamKey === "string") {
            return computeTeamAttr(payload.teamKey);
        }
        return computeTeamAttr(null);
    }

    function getHorizontalRange() {
        var min = Math.max(1, 1 + sidelineMargin);
        var max = Math.max(min, COURT_WIDTH - sidelineMargin);
        return { min: min, max: max };
    }

    function getVerticalRange() {
        var min = Math.max(1, 1 + baselineMargin);
        var max = Math.max(min, COURT_HEIGHT - baselineMargin);
        return { min: min, max: max };
    }

    function clampHorizontalStart(value, textLength) {
        var range = getHorizontalRange();
        var maxStart = Math.max(range.min, range.max - textLength + 1);
        return helperClamp(value, range.min, maxStart);
    }

    function clampVertical(value) {
        var range = getVerticalRange();
        return helperClamp(value, range.min, range.max);
    }

    function resolveOrigin(payload) {
        if (payload && typeof payload.originX === "number" && typeof payload.originY === "number") {
            return {
                x: payload.originX,
                y: payload.originY
            };
        }

        var sprite = payload ? payload.player : null;
        if (sprite && typeof sprite.x === "number" && typeof sprite.y === "number") {
            var frame = sprite.frame;
            var width = frame && typeof frame.width === "number" ? frame.width : (typeof sprite.width === "number" ? sprite.width : 4);
            var height = frame && typeof frame.height === "number" ? frame.height : (typeof sprite.height === "number" ? sprite.height : 4);
            var centerX = sprite.x + Math.floor(width / 2);
            var topY = sprite.y + originYOffset;
            var horizontalRange = getHorizontalRange();
            var verticalRange = getVerticalRange();
            var clampedX = helperClamp(centerX, horizontalRange.min, horizontalRange.max);
            var clampedY = helperClamp(topY, verticalRange.min, verticalRange.max);
            return {
                x: clampedX,
                y: clampedY
            };
        }

        var horizontalRangeFallback = getHorizontalRange();
        var verticalRangeFallback = getVerticalRange();
        return {
            x: helperClamp(Math.floor(COURT_WIDTH / 2), horizontalRangeFallback.min, horizontalRangeFallback.max),
            y: helperClamp(Math.floor(COURT_HEIGHT / 2), verticalRangeFallback.min, verticalRangeFallback.max)
        };
    }

    function pushEntry(entry, frame) {
        if (activeEntries.length >= maxActive) {
            var removed = activeEntries.shift();
            if (removed) {
                clearRenderedGlyphs(removed, frame);
                markCourtDirty("stat_trail_evicted");
            }
        }
        activeEntries.push(entry);
    }

    function queueStatTrail(payload) {
        if (!payload || payload.text === undefined || payload.text === null) {
            return;
        }
        var text = String(payload.text).trim();
        if (!text.length) {
            return;
        }
        var frame = ensureTrailFrame();
        if (!frame) {
            return;
        }
        var origin = resolveOrigin(payload);
        var teamKey = payload.teamKey || (payload.player && typeof getPlayerTeamName === "function" ? getPlayerTeamName(payload.player) : null);
        var statType = payload && payload.statType ? String(payload.statType).toLowerCase() : "";
        var attrPayload = {
            attr: payload.attr,
            color: payload.color,
            fg: payload.fg,
            bg: payload.bg,
            teamKey: teamKey,
            statType: statType
        };
        var attr = resolveAttr(attrPayload);
        var flashAttr = composeFlashAttr(attr);
        var finalAttr = composeFinalAttr(attr);
        var trimmedText = text;
        if (trimmedText.length > availableWidth) {
            trimmedText = trimmedText.substring(0, availableWidth);
        }
        var entry = {
            text: trimmedText,
            textLength: trimmedText.length,
            anchorX: origin.x,
            anchorY: origin.y,
            offsetX: 0,
            offsetY: 0,
            attr: attr,
            flashAttr: flashAttr,
            finalAttr: finalAttr,
            frameIndex: 0,
            rendered: [],
            teamKey: teamKey,
            player: payload.player || null,
            statType: statType
        };
        pushEntry(entry, frame);
    }

    function computeRiseDelta(frameIndex) {
        if (typeof frameIndex !== "number" || isNaN(frameIndex)) {
            frameIndex = 0;
        }
        if (lifetimeFrames <= 1) {
            return riseFastPerFrame;
        }
        var denominator = Math.max(1, lifetimeFrames - 1);
        var progress = helperClamp(frameIndex / denominator, 0, 1);
        var eased = Math.pow(progress, riseAccelerationExp);
        var rate = riseSlowPerFrame + (riseFastPerFrame - riseSlowPerFrame) * eased;
        if (!isFinite(rate) || rate < 0) {
            return risePerFrame;
        }
        return rate;
    }

    function update() {
        if (!activeEntries.length) {
            return;
        }
        var frame = ensureTrailFrame();
        if (!frame) {
            if (activeEntries.length) {
                activeEntries.length = 0;
                markCourtDirty("stat_trail_no_frame");
            }
            return;
        }
        var hasSetData = typeof frame.setData === "function";
        if (!hasSetData) {
            if (activeEntries.length) {
                activeEntries.length = 0;
                markCourtDirty("stat_trail_no_setdata");
            }
            return;
        }
        for (var i = activeEntries.length - 1; i >= 0; i--) {
            var entry = activeEntries[i];
            clearRenderedGlyphs(entry, frame);
            if (entry.frameIndex >= lifetimeFrames) {
                activeEntries.splice(i, 1);
                markCourtDirty("stat_trail_complete");
                continue;
            }
            var baseOrigin = (entry.player && typeof entry.player.x === "number" && typeof entry.player.y === "number")
                ? resolveOrigin({ player: entry.player })
                : { x: entry.anchorX, y: entry.anchorY };
            entry.anchorX = baseOrigin.x;
            entry.anchorY = baseOrigin.y;
            var riseDelta = computeRiseDelta(entry.frameIndex);
            entry.offsetY -= riseDelta;
            entry.offsetX += driftPerFrame;
            var baseX = entry.anchorX + entry.offsetX;
            var baseY = entry.anchorY + entry.offsetY;
            var startXFloat = baseX - (entry.textLength - 1) / 2;
            var drawX = clampHorizontalStart(Math.round(startXFloat), entry.textLength);
            var drawY = clampVertical(Math.round(baseY));
            var shouldBlink = (lifetimeFrames - entry.frameIndex) <= fadeFrames;
            var framesRemaining = lifetimeFrames - entry.frameIndex;
            var useFinalAttr = entry.finalAttr && finalFadeFrames > 0 && framesRemaining <= finalFadeFrames;
            var useFlashAttr = !useFinalAttr && shouldBlink && entry.flashAttr && ((entry.frameIndex % flashCycleLength) >= blinkIntervalFrames);
            var activeAttr = useFinalAttr ? entry.finalAttr : (useFlashAttr ? entry.flashAttr : entry.attr);
            entry.rendered.length = 0;
            for (var c = 0; c < entry.textLength; c++) {
                if (drawX + c > COURT_WIDTH - sidelineMargin) {
                    break;
                }
                var glyph = entry.text.charAt(c);
                var cellX = drawX + c - 1;
                var cellY = drawY - 1;
                frame.setData(cellX, cellY, glyph, activeAttr, false);
                entry.rendered.push({ x: cellX, y: cellY });
            }
            entry.frameIndex += 1;
        }
    }

    function reset() {
        var frame = ensureTrailFrame();
        if (frame) {
            for (var i = 0; i < activeEntries.length; i++) {
                clearRenderedGlyphs(activeEntries[i], frame);
            }
        }
        activeEntries.length = 0;
        markCourtDirty("stat_trail_reset");
    }

    return {
        queueStatTrail: queueStatTrail,
        update: update,
        reset: reset
    };
}
