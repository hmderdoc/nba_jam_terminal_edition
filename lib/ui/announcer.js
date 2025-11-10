// NBA Jam Announcer Utilities
// Handles announcer text lifecycle, color selection, and fire state helpers

var announcerFrame = null;
var announcerLibrary = {};

// Load announcer data from JSON file
function loadAnnouncerData() {
    var defaultLibrary = {
        generic: [""],
        crowd_reaction: ["The crowd goes wild!"],
        shot_made: ["Count it!"],
        shot_missed: ["No good!"],
        three_pointer: ["From downtown!"],
        dunk: ["Boom-shakalaka!"],
        block: ["Rejected!"],
        steal: ["Picked his pocket!"],
        on_fire: ["He's on fire!"],
        fire_extinguished: ["He's cooled off."],
        shot_clock_violation: ["Shot clock violation!"],
        violation_backcourt: ["Backcourt violation!"],
        violation_five_seconds: ["5-second violation!"],
        dribble_pickup: ["He picked up his dribble!"],
        game_start: ["Welcome to NBA Jam!"],
        tipoff: ["And we're underway!"],
        half_time: ["It's halftime!"],
        win: ["That's the ball game!"],
        lose: ["Better luck next time!"],
        hot_streak: ["He's heating up!"],
        cold_streak: ["He's ice cold!"],
        alley_oop: ["Alley-oop!"],
        buzzer_beater: ["At the buzzer — yes!"],
        injury: ["Ouch!"],
        loose_ball: ["Loose ball!"],
        inbounds: ["Ball in play!"],
        rebound: ["Snags the rebound!"],
        shake_free: ["He shook him loose!"],
        shove: ["He sends him flying!"]
    };

    announcerLibrary = {};

    var annFile = new File(js.exec_dir + "assets/announcer.json");
    if (annFile.open("r")) {
        var content = annFile.read();
        annFile.close();
        try {
            var parsed = JSON.parse(content);
            if (parsed && parsed.length) {
                for (var i = 0; i < parsed.length; i++) {
                    var entry = parsed[i];
                    if (!entry || !entry.event_type || !entry.quotes || !entry.quotes.length) continue;
                    announcerLibrary[entry.event_type] = entry.quotes.slice();
                }
            }
        } catch (err) {
            if (typeof console !== "undefined" && console.print) {
                console.print("\r\nFailed to parse announcer.json: " + err + "\r\n");
            }
        }
    }

    for (var key in defaultLibrary) {
        if (!announcerLibrary[key]) {
            announcerLibrary[key] = defaultLibrary[key].slice();
        }
    }
}

function pickRandomQuote(list) {
    if (!list || !list.length) return "";
    var idx = Math.floor(Math.random() * list.length);
    if (idx < 0 || idx >= list.length) idx = 0;
    return list[idx];
}

function formatAnnouncerQuote(template, context) {
    if (!template) return "";
    if (!context) context = {};
    return template.replace(/\$\{([^}]+)\}/g, function (_, key) {
        if (context.hasOwnProperty(key)) return String(context[key]);
        return "";
    });
}

function getTeamColorValue(teamKey, useAccent, systems) {
    var stateManager = systems.stateManager;

    var teamColors = stateManager.get('teamColors');
    if (!teamKey || !teamColors) return null;
    var entry = teamColors[teamKey];
    if (!entry) return null;
    if (useAccent && entry.fg_accent) return entry.fg_accent;
    if (entry.fg) return entry.fg;
    return null;
}

function deriveAnnouncerColor(context, systems) {
    context = context || {};
    if (context.color) return context.color;

    var teamKey = context.team;
    if (!teamKey && context.player) {
        teamKey = getPlayerTeamName(context.player);
    }
    if (!teamKey && context.playerName && context.teamName) {
        teamKey = context.teamName;
    }

    var color = getTeamColorValue(teamKey, true, systems) || getTeamColorValue(teamKey, false, systems);
    if (color !== null) return color;
    return YELLOW;
}

function announce(text, color, systems) {
    var stateManager = systems.stateManager;

    var announcer = stateManager.get('announcer') || {};
    announcer.text = text;
    announcer.color = color || WHITE;
    announcer.timer = 90;
    stateManager.set("announcer", announcer, "announce");

    if (typeof drawAnnouncerLine === "function") {
        drawAnnouncerLine(systems);
    }
}

function updateAnnouncer(systems) {
    var stateManager = systems.stateManager;

    var announcer = stateManager.get('announcer');
    if (announcer && announcer.timer > 0) {
        announcer.timer--;
        if (announcer.timer == 0) {
            announcer.text = "";
        }
        stateManager.set("announcer", announcer, "announcer_update");
    }
    if (typeof drawAnnouncerLine === "function") {
        drawAnnouncerLine(systems);
    }
}

function announceEvent(eventType, context, systems) {
    context = context || {};
    var quotes = announcerLibrary[eventType];
    if (!quotes) {
        quotes = announcerLibrary.generic;
        if (!quotes) return;
    }

    var message = formatAnnouncerQuote(pickRandomQuote(quotes), context);
    if (!message) return;

    var color = deriveAnnouncerColor(context, systems);
    announce(message, color, systems);

    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastEvent("announcer", {
            message: message,
            color: color,
            eventType: eventType
        });
    }
}

function getAnnouncerText(systems) {
    var stateManager = systems.stateManager;
    var announcer = stateManager.get('announcer');
    return announcer ? announcer.text : "";
}

function getAnnouncerColor(systems) {
    var stateManager = systems.stateManager;
    var announcer = stateManager.get('announcer');
    return announcer ? announcer.color : WHITE;
}

function drawAnnouncerLine(systems) {
    if (!announcerFrame || (announcerFrame.is_open === false)) return;
    announcerFrame.clear();

    var text = getAnnouncerText(systems);
    if (text) {
        var frameWidth = announcerFrame.width || 80;
        if (text.length > frameWidth) {
            text = text.substring(0, frameWidth);
        }
        var startX = clamp(Math.floor((frameWidth - text.length) / 2) + 1, 1, Math.max(1, frameWidth - text.length + 1));
        announcerFrame.gotoxy(startX, 1);
        announcerFrame.putmsg(text, getAnnouncerColor(systems) | BG_BLACK);
    }

    cycleFrame(announcerFrame);
}

/**
 * NOTE: Hot streak state management moved to lib/game-logic/hot-streak.js
 * Functions: setPlayerOnFire(), clearPlayerOnFire(), clearTeamOnFire(), etc.
 * This module now handles only announcements and UI display.
 */

// Initialize announcer library on load
loadAnnouncerData();
