#!/usr/bin/env jsexec

// Merge player sprite files with shoved sprite frames
// This concatenates player-{color}.bin with player-shoved.bin to create extended sprites

load("sbbsdefs.js");

var spritesDir = js.exec_dir + "sprites/";
var playerColors = ["brown", "lightgray", "magenta"];
var shovedFile = spritesDir + "player-shoved.bin";

function fileExists(path) {
    var f = new File(path);
    return f.exists;
}

function readBinaryFile(path) {
    var f = new File(path);
    if (!f.open("rb")) {
        log(LOG_ERR, "Failed to open file for reading: " + path);
        return null;
    }
    var data = f.read();
    f.close();
    return data;
}

function writeBinaryFile(path, data) {
    var f = new File(path);
    if (!f.open("wb")) {
        log(LOG_ERR, "Failed to open file for writing: " + path);
        return false;
    }
    f.write(data);
    f.close();
    return true;
}

function backupFile(path) {
    var backupPath = path + ".backup";
    var f = new File(path);
    if (f.exists) {
        file_copy(path, backupPath);
        log(LOG_INFO, "Created backup: " + backupPath);
        return true;
    }
    return false;
}

function mergeSprites() {
    // Read shoved sprite data once
    log(LOG_INFO, "Reading shoved sprite file: " + shovedFile);
    var shovedData = readBinaryFile(shovedFile);

    if (!shovedData) {
        log(LOG_ERR, "Could not read shoved sprite file!");
        return false;
    }

    log(LOG_INFO, "Shoved sprite data size: " + shovedData.length + " bytes");

    // Process each player color
    for (var i = 0; i < playerColors.length; i++) {
        var color = playerColors[i];
        var playerFile = spritesDir + "player-" + color + ".bin";
        var outputFile = spritesDir + "player-" + color + "-extended.bin";

        if (!fileExists(playerFile)) {
            log(LOG_WARNING, "Player file not found: " + playerFile + " - skipping");
            continue;
        }

        log(LOG_INFO, "\nProcessing: " + color);
        log(LOG_INFO, "Reading player sprite: " + playerFile);

        var playerData = readBinaryFile(playerFile);
        if (!playerData) {
            log(LOG_ERR, "Could not read player file: " + playerFile);
            continue;
        }

        log(LOG_INFO, "Player sprite data size: " + playerData.length + " bytes");

        // Concatenate: player data + shoved data
        var mergedData = playerData + shovedData;

        log(LOG_INFO, "Merged data size: " + mergedData.length + " bytes");
        log(LOG_INFO, "Writing extended sprite: " + outputFile);

        if (writeBinaryFile(outputFile, mergedData)) {
            log(LOG_INFO, "SUCCESS: Created " + outputFile);
            log(LOG_INFO, "  Original: " + playerData.length + " bytes");
            log(LOG_INFO, "  + Shoved: " + shovedData.length + " bytes");
            log(LOG_INFO, "  = Total:  " + mergedData.length + " bytes");
        } else {
            log(LOG_ERR, "FAILED to write " + outputFile);
        }
    }

    return true;
}

// Main execution
log(LOG_INFO, "=== NBA Jam Sprite Merger ===");
log(LOG_INFO, "Sprites directory: " + spritesDir);
log(LOG_INFO, "");

if (!fileExists(shovedFile)) {
    log(LOG_ERR, "ERROR: Shoved sprite file not found: " + shovedFile);
    exit(1);
}

if (mergeSprites()) {
    log(LOG_INFO, "\n=== Merge Complete ===");
    log(LOG_INFO, "Next steps:");
    log(LOG_INFO, "1. Update player-{color}.ini files to include shoved bearings:");
    log(LOG_INFO, "   bearings = n,ne,e,se,s,sw,w,nw,shoved_n,shoved_ne,shoved_e,shoved_se,shoved_s,shoved_sw,shoved_w,shoved_nw");
    log(LOG_INFO, "2. Rename player-{color}-extended.bin to player-{color}.bin (after backing up originals)");
    log(LOG_INFO, "3. Test the game!");
    exit(0);
} else {
    log(LOG_ERR, "\n=== Merge Failed ===");
    exit(1);
}
