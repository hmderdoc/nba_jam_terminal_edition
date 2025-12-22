#!/sbbs/exec/jsexec
/**
 * fix_baby_appearances.js - Fix baby baller appearances with missing/invalid fields
 * 
 * This script:
 * 1. Adds missing eyeColor field
 * 2. Adds missing jerseyLettering field
 * 3. Ensures colors are visible (eye vs skin, lettering vs jersey)
 */

load("json-client.js");

// Valid color definitions
var BG_COLORS = ["BLACK", "BLUE", "GREEN", "CYAN", "RED", "MAGENTA", "BROWN", "LIGHTGRAY"];
var FG_COLORS = [
    "BLACK", "BLUE", "GREEN", "CYAN", "RED", "MAGENTA", "BROWN", "LIGHTGRAY",
    "DARKGRAY", "LIGHTBLUE", "LIGHTGREEN", "LIGHTCYAN", "LIGHTRED", "LIGHTMAGENTA", "YELLOW", "WHITE"
];
var EYE_COLORS = ["BROWN", "BLUE", "GREEN", "LIGHTGRAY", "BLACK"];

var SKIN_EYE_CONFLICTS = {
    "brown": ["BROWN"],
    "lightgray": ["LIGHTGRAY", "WHITE"],
    "magenta": ["MAGENTA", "LIGHTMAGENTA"]
};

var BG_FG_CONFLICTS = {
    "BLACK": ["BLACK", "DARKGRAY"],
    "BLUE": ["BLUE", "LIGHTBLUE"],
    "GREEN": ["GREEN", "LIGHTGREEN"],
    "CYAN": ["CYAN", "LIGHTCYAN"],
    "RED": ["RED", "LIGHTRED"],
    "MAGENTA": ["MAGENTA", "LIGHTMAGENTA"],
    "BROWN": ["BROWN", "YELLOW"],
    "LIGHTGRAY": ["LIGHTGRAY", "WHITE"]
};

function randomExcluding(arr, excludeList) {
    excludeList = excludeList || [];
    var filtered = [];
    for (var i = 0; i < arr.length; i++) {
        var inExclude = false;
        for (var j = 0; j < excludeList.length; j++) {
            if (arr[i] === excludeList[j]) {
                inExclude = true;
                break;
            }
        }
        if (!inExclude) {
            filtered.push(arr[i]);
        }
    }
    if (filtered.length === 0) return arr[0];
    return filtered[Math.floor(Math.random() * filtered.length)];
}

function fixBabyAppearance(appearance) {
    if (!appearance) {
        appearance = { skin: "brown" };
    }
    
    var changed = false;
    var skin = appearance.skin || "brown";
    
    // Add eyeColor if missing
    if (!appearance.eyeColor) {
        var eyeConflicts = SKIN_EYE_CONFLICTS[skin] || [];
        appearance.eyeColor = randomExcluding(EYE_COLORS, eyeConflicts);
        changed = true;
    }
    
    // Ensure jerseyColor is valid BG color
    if (!appearance.jerseyColor || BG_COLORS.indexOf(appearance.jerseyColor) === -1) {
        appearance.jerseyColor = BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)];
        changed = true;
    }
    
    // Add jerseyLettering if missing (ensure visible against jerseyColor)
    if (!appearance.jerseyLettering) {
        var letteringConflicts = BG_FG_CONFLICTS[appearance.jerseyColor] || [];
        appearance.jerseyLettering = randomExcluding(FG_COLORS, letteringConflicts);
        changed = true;
    }
    
    // Ensure jerseyNumber exists
    if (!appearance.jerseyNumber) {
        appearance.jerseyNumber = String(Math.floor(Math.random() * 99) + 1);
        changed = true;
    }
    
    return changed;
}

// Main
writeln("\n=== Baby Appearance Fix Script ===\n");

var client = new JSONClient("127.0.0.1", 10088);
var data = client.read("nba_jam", "lorb", 1);

if (!data) {
    writeln("ERROR: Could not read lorb data");
    exit(1);
}

var totalBabies = 0;
var fixedBabies = 0;

// Iterate through all players
for (var userId in data) {
    if (!data.hasOwnProperty(userId)) continue;
    var player = data[userId];
    
    if (!player.babyBallers || player.babyBallers.length === 0) continue;
    
    for (var i = 0; i < player.babyBallers.length; i++) {
        var baby = player.babyBallers[i];
        totalBabies++;
        
        if (!baby.appearance) {
            baby.appearance = {};
        }
        
        if (fixBabyAppearance(baby.appearance)) {
            fixedBabies++;
            writeln("Fixed: " + baby.nickname + " (" + userId + ")");
            writeln("  -> skin=" + baby.appearance.skin + 
                   " eye=" + baby.appearance.eyeColor +
                   " jersey=" + baby.appearance.jerseyColor + 
                   " lettering=" + baby.appearance.jerseyLettering +
                   " #" + baby.appearance.jerseyNumber);
        }
    }
}

writeln("\n--- Summary ---");
writeln("Total babies: " + totalBabies);
writeln("Fixed: " + fixedBabies);

if (fixedBabies > 0) {
    writeln("\nSaving changes...");
    client.write("nba_jam", "lorb", data, 2);
    writeln("Done!");
} else {
    writeln("\nNo changes needed.");
}

client.disconnect();
