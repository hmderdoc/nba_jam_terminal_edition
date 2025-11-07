// NBA Jam Announcer Utilities
// Handles announcer text lifecycle, color selection, and fire state helpers

var announcerFrame = null;
var announcerLibrary = {};

function loadAnnouncerLibrary() {
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

    var annFile = new File(js.exec_dir + "announcer.json");
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

function getTeamColorValue(teamKey, useAccent) {
    if (!teamKey || !gameState.teamColors) return null;
    var entry = gameState.teamColors[teamKey];
    if (!entry) return null;
    if (useAccent && entry.fg_accent) return entry.fg_accent;
    if (entry.fg) return entry.fg;
    return null;
}

function deriveAnnouncerColor(context) {
    context = context || {};
    if (context.color) return context.color;

    var teamKey = context.team;
    if (!teamKey && context.player) {
        teamKey = getPlayerTeamName(context.player);
    }
    if (!teamKey && context.playerName && context.teamName) {
        teamKey = context.teamName;
    }

    var color = getTeamColorValue(teamKey, true) || getTeamColorValue(teamKey, false);
    if (color !== null) return color;
    return YELLOW;
}

function announce(text, color) {
    gameState.announcer.text = text;
    gameState.announcer.color = color || WHITE;
    gameState.announcer.timer = 90;
    if (typeof drawAnnouncerLine === "function") {
        drawAnnouncerLine();
    }
}

function updateAnnouncer() {
    if (gameState.announcer.timer > 0) {
        gameState.announcer.timer--;
        if (gameState.announcer.timer == 0) {
            gameState.announcer.text = "";
        }
    }
    if (typeof drawAnnouncerLine === "function") {
        drawAnnouncerLine();
    }
}

function announceEvent(eventType, context) {
    context = context || {};
    var quotes = announcerLibrary[eventType];
    if (!quotes) {
        quotes = announcerLibrary.generic;
        if (!quotes) return;
    }

    var message = formatAnnouncerQuote(pickRandomQuote(quotes), context);
    if (!message) return;

    var color = deriveAnnouncerColor(context);
    announce(message, color);

    if (mpCoordinator && mpCoordinator.isCoordinator) {
        mpCoordinator.broadcastEvent("announcer", {
            message: message,
            color: color,
            eventType: eventType
        });
    }
}

function getAnnouncerText() {
    return gameState.announcer.text;
}

function getAnnouncerColor() {
    return gameState.announcer.color;
}

function drawAnnouncerLine() {
    if (!announcerFrame || (announcerFrame.is_open === false)) return;
    announcerFrame.clear();

    var text = getAnnouncerText();
    if (text) {
        var frameWidth = announcerFrame.width || 80;
        if (text.length > frameWidth) {
            text = text.substring(0, frameWidth);
        }
        var startX = clamp(Math.floor((frameWidth - text.length) / 2) + 1, 1, Math.max(1, frameWidth - text.length + 1));
        announcerFrame.gotoxy(startX, 1);
        announcerFrame.putmsg(text, getAnnouncerColor() | BG_BLACK);
    }

    cycleFrame(announcerFrame);
}

function updateTeamOnFireFlag(teamKey) {
    if (!teamKey || !gameState.onFire) return;
    var sprites = getTeamSprites(teamKey) || [];
    var active = false;
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (sprite && sprite.playerData && sprite.playerData.onFire) {
            active = true;
            break;
        }
    }
    gameState.onFire[teamKey] = active;
}

function setPlayerOnFire(player) {
    if (!player || !player.playerData) return;
    if (typeof player.playerData.fireMakeStreak !== "number") {
        player.playerData.fireMakeStreak = 0;
    }
    player.playerData.onFire = true;
    var team = getPlayerTeamName(player);
    if (team) {
        gameState.onFire[team] = true;
    }
}

function clearPlayerOnFire(player) {
    if (!player || !player.playerData) return;
    player.playerData.onFire = false;
    player.playerData.heatStreak = 0;
    player.playerData.fireMakeStreak = 0;
    var team = getPlayerTeamName(player);
    if (team) {
        updateTeamOnFireFlag(team);
    }
}

function clearTeamOnFire(teamKey) {
    if (!teamKey) return;
    var sprites = getTeamSprites(teamKey) || [];
    for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        if (sprite && sprite.playerData) {
            sprite.playerData.onFire = false;
            sprite.playerData.heatStreak = 0;
            sprite.playerData.fireMakeStreak = 0;
        }
    }
    gameState.onFire[teamKey] = false;
}
