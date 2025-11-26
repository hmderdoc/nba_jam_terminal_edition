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
    }
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = GAME_MODE_CONSTANTS;
}
