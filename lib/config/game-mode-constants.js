/**
 * Game mode and meta-feature constants (bookie, menus, etc.).
 * Loaded by lib/utils/constants.js and exposed via GAME_MODE_CONSTANTS.
 */

var GAME_MODE_CONSTANTS = {
    BOOKIE: {
        ATTRIBUTE_WEIGHTS: {
            speed: 1.2,
            threePoint: 1.1,
            dunk: 1.0,
            power: 0.9,
            steal: 0.8,
            block: 0.7
        },
        ODDS: {
            invalidFavorite: -110,
            invalidUnderdog: 110,
            evenFavorite: -105,
            evenUnderdog: 105,
            evenDiffPercent: 2,
            baseOdds: 110,
            diffScaleFactor: 8,
            minFavorite: -500,
            maxUnderdog: 500
        },
        SPREAD: {
            pointsPerPower: 1.5,
            minSpread: 0.5,
            maxSpread: 20,
            roundingIncrement: 0.5
        },
        OVER_UNDER: {
            basePerTeam: 30,
            powerScale: 4,
            minTotal: 60,
            maxTotal: 140,
            roundingIncrement: 0.5
        }
    },
    BETTING: {
        defaultBankroll: 1000,
        defaultWager: 100,
        promptsEnabled: true,
        hotkeyEnabled: true
    },
    MENUS: {
        TEAM_SELECTION: {
            columnWidth: 32,
            blankFillWidth: 34,
            minPadding: 2
        },
        SPLASH: {
            minCols: 80,
            minRows: 24,
            graphicWidth: 80,
            graphicHeight: 25,
            waitTimeoutMs: 10000,
            coordinatorTimeoutMs: 10000,
            pollIntervalMs: 100
        },
        MATCHUP: {
            minCols: 80,
            minRows: 24,
            graphicWidth: 80,
            maxGraphicHeight: 25,
            frameOffsets: {
                left: { x: 1, y: 10 },
                right: { x: 58, y: 10 }
            },
            frame: {
                width: 21,
                height: 10,
                innerOffsetX: 2,
                innerOffsetY: 2,
                areaWidth: 9,
                oddsOffsetY: 1,
                promptOffsetY: 2
            },
            animation: {
                presentationDurationMs: 10000,
                previewInitialDelayMs: 500,
                previewInitialRandomMs: 800,
                previewUpdateDelayMs: 700,
                previewUpdateRandomMs: 900,
                pollIntervalMs: 100,
                idleSleepMs: 20
            },
            coordinatorTimeoutMs: 15000
        }
    },
    RULE_ENFORCEMENT: {
        BACKCOURT_VIOLATIONS_ENABLED: false
    },
    RUBBER_BANDING: {
        enabled: true,
        showCue: true,
        defaultProfile: "arcade_default",
        probabilityCaps: {
            tier_clutch_3: 0.99,
            tier_0: 0.95,
            tier_1: 0.97,
            tier_2: 0.99,
            tier_3: 1.0
        },
        profiles: {
            arcade_default: {
                tiers: [
                    {
                        id: "tier_0",
                        deficitMin: 5,
                        deficitMax: 7,
                        clockMaxSeconds: null,
                        shotMultiplier: 1.08,
                        stealBonus: 0.02,
                        blockBonus: 0.01,
                        reboundBonus: 0.03,
                        turnoverRelief: -0.03,
                        turboReserveBonus: 8
                    },
                    {
                        id: "tier_1",
                        deficitMin: 8,
                        deficitMax: 12,
                        clockMaxSeconds: null,
                        shotMultiplier: 1.15,
                        stealBonus: 0.04,
                        blockBonus: 0.03,
                        reboundBonus: 0.05,
                        turnoverRelief: -0.05,
                        turboReserveBonus: 16
                    },
                    {
                        id: "tier_2",
                        deficitMin: 13,
                        deficitMax: 20,
                        clockMaxSeconds: null,
                        shotMultiplier: 1.25,
                        stealBonus: 0.06,
                        blockBonus: 0.05,
                        reboundBonus: 0.07,
                        turnoverRelief: -0.07,
                        turboReserveBonus: 20
                    },
                    {
                        id: "tier_3",
                        deficitMin: 21,
                        deficitMax: null,
                        clockMaxSeconds: null,
                        shotMultiplier: 1.45,
                        stealBonus: 0.1,
                        blockBonus: 0.08,
                        reboundBonus: 0.12,
                        turnoverRelief: -0.12,
                        turboReserveBonus: 30
                    },
                    {
                        id: "tier_clutch_3",
                        deficitMin: 3,
                        deficitMax: 8,
                        clockMaxSeconds: 10,
                        shotMultiplier: 1.12,
                        stealBonus: 0.03,
                        blockBonus: 0.02,
                        reboundBonus: 0.04,
                        turnoverRelief: -0.04,
                        turboReserveBonus: 12
                    }
                ]
            },
            pure_skill: {
                tiers: []
            }
        }
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = GAME_MODE_CONSTANTS;
}
