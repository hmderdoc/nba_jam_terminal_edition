// Rubber Banding System - Tier evaluation and announcer integration
// Wave 24: Config-driven comeback tuning

/**
 * Create the rubber banding system
 * @param {Object} deps
 * @param {Object} deps.state - State manager
 * @param {Object} deps.events - Event bus
 * @param {Object} deps.helpers - Helper functions (announceEvent, etc.)
 * @param {Object} deps.config - Config block with enabled/profile settings
 * @returns {Object} Rubber banding system API
 */
function createRubberBandingSystem(deps) {
    if (!deps || !deps.state || !deps.events || !deps.config) {
        throw new Error("RubberBandingSystem: Missing required dependencies");
    }

    var state = deps.state;
    var events = deps.events;
    var helpers = deps.helpers || {};
    var announceEventFn = helpers.announceEvent || (typeof announceEvent === "function" ? announceEvent : null);

    var getAllPlayers = typeof helpers.getAllPlayers === "function"
        ? helpers.getAllPlayers
        : function () { return []; };

    var baseConfig = sanitizeConfig(deps.config || {});
    var baseMaxTurbo = 100;
    if (deps.constants && typeof deps.constants.maxTurbo === "number") {
        baseMaxTurbo = deps.constants.maxTurbo;
    } else if (typeof MAX_TURBO === "number") {
        baseMaxTurbo = MAX_TURBO;
    }

    var PRIORITY_CLOCK_BASE = 1000;
    var PRIORITY_CLOCK_CAP_SECONDS = 240;
    var OPEN_ENDED_DEFICIT_BONUS = 10;

    function sanitizeConfig(raw) {
        var profiles = raw.profiles || {};
        return {
            enabled: raw.enabled === true,
            showCue: raw.showCue === true,
            defaultProfile: (typeof raw.defaultProfile === "string" && profiles[raw.defaultProfile])
                ? raw.defaultProfile
                : null,
            profiles: profiles,
            probabilityCaps: raw.probabilityCaps || {}
        };
    }

    function getEffectiveProfileId() {
        var configuredProfile = state.get("rubberBanding.profileId");
        if (configuredProfile && baseConfig.profiles[configuredProfile]) {
            return configuredProfile;
        }
        return baseConfig.defaultProfile;
    }

    function ensureStateInitialized() {
        var statePath = "rubberBanding";
        var current = state.get(statePath);
        var expectedEnabled = baseConfig.enabled;
        var expectedProfile = getEffectiveProfileId();

        if (!current || typeof current !== "object") {
            state.set(statePath, {
                enabled: expectedEnabled,
                profileId: expectedProfile,
                activeTierId: null,
                trailingTeamId: null,
                lastAnnouncedTierId: null,
                lastDeficit: 0,
                lastEvaluationAt: null,
                activeBonuses: {
                    teamA: createNeutralModifiers(),
                    teamB: createNeutralModifiers()
                },
                turboCapacity: {
                    teamA: baseMaxTurbo,
                    teamB: baseMaxTurbo
                }
            }, "rubber_band_init");
            return;
        }

        if (current.enabled !== expectedEnabled) {
            state.set("rubberBanding.enabled", expectedEnabled, expectedEnabled ? "rubber_band_enabled" : "rubber_band_disable");
        }

        if (current.profileId !== expectedProfile) {
            state.set("rubberBanding.profileId", expectedProfile, "rubber_band_profile_update");
        }

        if (!current.activeBonuses || typeof current.activeBonuses !== "object") {
            state.set("rubberBanding.activeBonuses", {
                teamA: createNeutralModifiers(),
                teamB: createNeutralModifiers()
            }, "rubber_band_bonus_init");
        }

        if (!current.turboCapacity || typeof current.turboCapacity !== "object") {
            state.set("rubberBanding.turboCapacity", {
                teamA: baseMaxTurbo,
                teamB: baseMaxTurbo
            }, "rubber_band_turbo_init");
        } else {
            if (typeof current.turboCapacity.teamA !== "number") {
                state.set("rubberBanding.turboCapacity.teamA", baseMaxTurbo, "rubber_band_turbo_init");
            }
            if (typeof current.turboCapacity.teamB !== "number") {
                state.set("rubberBanding.turboCapacity.teamB", baseMaxTurbo, "rubber_band_turbo_init");
            }
        }
    }

    function setIfChanged(path, value, reason) {
        var existing = state.get(path);
        if (existing !== value) {
            state.set(path, value, reason);
        }
    }

    function calculateTierPriority(tier) {
        var deficitBase = 0;
        if (typeof tier.deficitMax === "number") {
            deficitBase = tier.deficitMax;
        } else if (typeof tier.deficitMin === "number") {
            deficitBase = tier.deficitMin + OPEN_ENDED_DEFICIT_BONUS;
        }

        var clockBonus = 0;
        if (tier.clockMaxSeconds !== null && tier.clockMaxSeconds !== undefined) {
            var safety = Math.max(0, Math.min(PRIORITY_CLOCK_CAP_SECONDS, tier.clockMaxSeconds));
            clockBonus = PRIORITY_CLOCK_BASE + (PRIORITY_CLOCK_CAP_SECONDS - safety);
        }

        return deficitBase + clockBonus;
    }

    function determineActiveTier(score, timeRemaining) {
        var profileId = getEffectiveProfileId();
        if (!profileId) {
            return null;
        }

        var profile = baseConfig.profiles[profileId];
        if (!profile || !profile.tiers || !profile.tiers.length) {
            return null;
        }

        var teamADeficit = score.teamB - score.teamA;
        var teamBDeficit = score.teamA - score.teamB;
        var trailingTeamId = null;
        var deficit = 0;

        if (teamADeficit > teamBDeficit && teamADeficit > 0) {
            trailingTeamId = "teamA";
            deficit = teamADeficit;
        } else if (teamBDeficit > 0) {
            trailingTeamId = "teamB";
            deficit = teamBDeficit;
        } else {
            return null; // tie game, no rubber banding
        }

        var winningTier = null;
        var winningPriority = -Infinity;
        var tiers = profile.tiers;
        var secondsRemaining = (typeof timeRemaining === "number" && timeRemaining >= 0) ? timeRemaining : null;

        for (var i = 0; i < tiers.length; i++) {
            var tier = tiers[i];
            if (!tier || typeof tier.id !== "string") {
                continue;
            }

            if (typeof tier.deficitMin === "number" && deficit < tier.deficitMin) {
                continue;
            }

            if (typeof tier.deficitMax === "number" && deficit > tier.deficitMax) {
                continue;
            }

            if (tier.clockMaxSeconds !== null && tier.clockMaxSeconds !== undefined) {
                if (secondsRemaining === null) {
                    continue;
                }
                if (secondsRemaining > tier.clockMaxSeconds) {
                    continue;
                }
            }

            var priority = calculateTierPriority(tier);
            if (priority >= winningPriority) {
                winningPriority = priority;
                winningTier = {
                    id: tier.id,
                    config: tier,
                    trailingTeamId: trailingTeamId,
                    deficit: deficit,
                    profileId: profileId
                };
            }
        }

        return winningTier;
    }

    function buildAnnouncerPayload(tierInfo, score) {
        var trailingTeamId = tierInfo.trailingTeamId;
        var teamNames = state.get("teamNames") || {};
        var trailingTeamName = teamNames[trailingTeamId] || trailingTeamId;
        var leadingTeamId = trailingTeamId === "teamA" ? "teamB" : "teamA";
        var leadingScore = score[leadingTeamId] || 0;
        var trailingScore = score[trailingTeamId] || 0;

        return {
            tierId: tierInfo.id,
            profile: tierInfo.profileId,
            teamName: trailingTeamName,
            trailingTeamId: trailingTeamId,
            deficit: tierInfo.deficit,
            trailingScore: trailingScore,
            leadingScore: leadingScore
        };
    }

    function evaluate(now, systems) {
        ensureStateInitialized();

        var enabled = state.get("rubberBanding.enabled");
        var score = state.get("score") || { teamA: 0, teamB: 0 };
        var timeRemaining = state.get("timeRemaining");

        setIfChanged("rubberBanding.lastEvaluationAt", now, "rubber_band_tick");

        if (!enabled) {
            if (state.get("rubberBanding.activeTierId") !== null) {
                setIfChanged("rubberBanding.activeTierId", null, "rubber_band_disable");
                setIfChanged("rubberBanding.trailingTeamId", null, "rubber_band_disable");
            }
            syncActiveBonuses(null);
            syncTurboCapacity(null);
            setIfChanged("rubberBanding.lastDeficit", 0, "rubber_band_tick");
            return null;
        }

        var tierInfo = determineActiveTier(score, timeRemaining);
        var previousTierId = state.get("rubberBanding.activeTierId");

        if (!tierInfo) {
            if (previousTierId !== null) {
                setIfChanged("rubberBanding.activeTierId", null, "rubber_band_tier_clear");
                setIfChanged("rubberBanding.trailingTeamId", null, "rubber_band_tier_clear");
                setIfChanged("rubberBanding.lastDeficit", 0, "rubber_band_tier_clear");
                if (typeof debugLog === "function") {
                    debugLog("[RUBBER BAND] Cleared tier; scores=" + score.teamA + "-" + score.teamB);
                }
            }
            syncActiveBonuses(null);
            syncTurboCapacity(null);
            return null;
        }

        setIfChanged("rubberBanding.lastDeficit", tierInfo.deficit, "rubber_band_tick");

        if (previousTierId !== tierInfo.id || state.get("rubberBanding.trailingTeamId") !== tierInfo.trailingTeamId) {
            setIfChanged("rubberBanding.activeTierId", tierInfo.id, "rubber_band_tier_change");
            setIfChanged("rubberBanding.trailingTeamId", tierInfo.trailingTeamId, "rubber_band_tier_change");

            events.emit("rubber_band_tier_change", {
                tierId: tierInfo.id,
                trailingTeamId: tierInfo.trailingTeamId,
                deficit: tierInfo.deficit,
                profileId: tierInfo.profileId,
                timeRemaining: timeRemaining,
                probabilityCap: baseConfig.probabilityCaps[tierInfo.id] || null
            });

            if (typeof debugLog === "function") {
                debugLog("[RUBBER BAND] tier=" + tierInfo.id +
                    " team=" + tierInfo.trailingTeamId +
                    " deficit=" + tierInfo.deficit +
                    " profile=" + tierInfo.profileId +
                    " timeRemaining=" + timeRemaining);
            }

            if (baseConfig.showCue && announceEventFn) {
                var payload = buildAnnouncerPayload(tierInfo, score);
                announceEventFn("rubber_band_tier", payload, systems);
                setIfChanged("rubberBanding.lastAnnouncedTierId", tierInfo.id, "rubber_band_tier_announce");
            }
        }

        syncActiveBonuses(tierInfo);
        syncTurboCapacity(tierInfo);

        return tierInfo;
    }

    function getActiveTier() {
        var tierId = state.get("rubberBanding.activeTierId");
        if (!tierId) {
            return null;
        }

        var profileId = getEffectiveProfileId();
        if (!profileId) {
            return null;
        }

        var profile = baseConfig.profiles[profileId];
        if (!profile || !profile.tiers) {
            return null;
        }

        for (var i = 0; i < profile.tiers.length; i++) {
            if (profile.tiers[i] && profile.tiers[i].id === tierId) {
                return {
                    id: tierId,
                    trailingTeamId: state.get("rubberBanding.trailingTeamId"),
                    config: profile.tiers[i],
                    probabilityCap: baseConfig.probabilityCaps[tierId] || null
                };
            }
        }

        return null;
    }

    function getProbabilityCap(tierId) {
        return baseConfig.probabilityCaps[tierId] || null;
    }

    function createNeutralModifiers() {
        return {
            active: false,
            tierId: null,
            shotMultiplier: 1,
            contestBonus: 0,
            stealBonus: 0,
            shoveBonus: 0,
            blockBonus: 0,
            reboundBonus: 0,
            turnoverRelief: 0,
            turboReserveBonus: 0,
            probabilityCap: null
        };
    }

    function buildModifiersFromTier(tierInfo) {
        if (!tierInfo || !tierInfo.config) {
            return createNeutralModifiers();
        }

        var config = tierInfo.config;
        var cap = baseConfig.probabilityCaps[tierInfo.id];

        return {
            active: true,
            tierId: tierInfo.id,
            shotMultiplier: typeof config.shotMultiplier === "number" ? config.shotMultiplier : 1,
            contestBonus: typeof config.contestBonus === "number" ? config.contestBonus : 0,
            stealBonus: typeof config.stealBonus === "number" ? config.stealBonus : 0,
            shoveBonus: typeof config.shoveBonus === "number" ? config.shoveBonus : 0,
            blockBonus: typeof config.blockBonus === "number" ? config.blockBonus : 0,
            reboundBonus: typeof config.reboundBonus === "number" ? config.reboundBonus : 0,
            turnoverRelief: typeof config.turnoverRelief === "number" ? config.turnoverRelief : 0,
            turboReserveBonus: Math.max(0, typeof config.turboReserveBonus === "number" ? config.turboReserveBonus : 0),
            probabilityCap: typeof cap === "number" ? cap * 100 : null
        };
    }

    function cloneModifiers(modifiers) {
        var clone = createNeutralModifiers();
        for (var key in modifiers) {
            if (modifiers.hasOwnProperty(key)) {
                clone[key] = modifiers[key];
            }
        }
        return clone;
    }

    function syncActiveBonuses(tierInfo) {
        var trailingTeamId = tierInfo ? tierInfo.trailingTeamId : null;
        var trailingModifiers = tierInfo ? buildModifiersFromTier(tierInfo) : createNeutralModifiers();
        var neutral = createNeutralModifiers();

        var teamAModifiers = trailingTeamId === "teamA" ? trailingModifiers : neutral;
        var teamBModifiers = trailingTeamId === "teamB" ? trailingModifiers : neutral;

        setIfChanged("rubberBanding.activeBonuses.teamA", teamAModifiers, "rubber_band_bonus_update");
        setIfChanged("rubberBanding.activeBonuses.teamB", teamBModifiers, "rubber_band_bonus_update");
    }

    function syncTurboCapacity(tierInfo) {
        var trailingTeamId = tierInfo ? tierInfo.trailingTeamId : null;
        var turboBonus = tierInfo && tierInfo.config && typeof tierInfo.config.turboReserveBonus === "number"
            ? Math.max(0, tierInfo.config.turboReserveBonus)
            : 0;

        var capacity = {
            teamA: baseMaxTurbo,
            teamB: baseMaxTurbo
        };

        if (trailingTeamId === "teamA") {
            capacity.teamA = baseMaxTurbo + turboBonus;
        } else if (trailingTeamId === "teamB") {
            capacity.teamB = baseMaxTurbo + turboBonus;
        }

        setIfChanged("rubberBanding.turboCapacity.teamA", capacity.teamA, "rubber_band_turbo_capacity");
        setIfChanged("rubberBanding.turboCapacity.teamB", capacity.teamB, "rubber_band_turbo_capacity");

        var players = getAllPlayers();
        if (!players || typeof players.length !== "number") {
            return;
        }

        for (var i = 0; i < players.length; i++) {
            var sprite = players[i];
            if (!sprite || !sprite.playerData) {
                continue;
            }
            var teamId = sprite.playerData.team || null;
            var teamCapacity = teamId && capacity.hasOwnProperty(teamId) ? capacity[teamId] : baseMaxTurbo;
            sprite.playerData.turboCapacity = teamCapacity;
            if (typeof sprite.playerData.turbo === "number" && sprite.playerData.turbo > teamCapacity) {
                sprite.playerData.turbo = teamCapacity;
            }
        }
    }

    function getTeamModifiers(teamId) {
        if (!teamId) {
            return createNeutralModifiers();
        }

        var stored = state.get("rubberBanding.activeBonuses." + teamId);
        if (stored && typeof stored === "object") {
            return cloneModifiers(stored);
        }

        var activeTier = getActiveTier();
        if (activeTier && activeTier.trailingTeamId === teamId) {
            return buildModifiersFromTier(activeTier);
        }

        return createNeutralModifiers();
    }

    function getTurboCapacity(teamId) {
        if (!teamId) {
            return baseMaxTurbo;
        }

        var stored = state.get("rubberBanding.turboCapacity." + teamId);
        if (typeof stored === "number") {
            return stored;
        }

        return baseMaxTurbo;
    }

    function reset() {
        ensureStateInitialized();
        setIfChanged("rubberBanding.activeTierId", null, "rubber_band_reset");
        setIfChanged("rubberBanding.trailingTeamId", null, "rubber_band_reset");
        setIfChanged("rubberBanding.lastAnnouncedTierId", null, "rubber_band_reset");
        setIfChanged("rubberBanding.lastDeficit", 0, "rubber_band_reset");
        setIfChanged("rubberBanding.lastEvaluationAt", null, "rubber_band_reset");
        syncActiveBonuses(null);
        syncTurboCapacity(null);
    }

    ensureStateInitialized();

    return {
        evaluate: evaluate,
        getActiveTier: getActiveTier,
        getProbabilityCap: getProbabilityCap,
        getTeamModifiers: getTeamModifiers,
        getTurboCapacity: getTurboCapacity,
        reset: reset
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = createRubberBandingSystem;
}
