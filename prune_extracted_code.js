#!/usr/bin/env jsexec
/**
 * Prune Extracted Code from nba_jam.js
 * 
 * This script removes all code that has been extracted to lib/ modules
 * Systematically deletes duplicate functions, leaving only placeholder comments
 */

load("sbbsdefs.js");

var sourceFile = "/sbbs/xtrn/nba_jam/nba_jam.js";
var backupFile = "/sbbs/xtrn/nba_jam/nba_jam.js.before_prune";

// Read entire file
var file = new File(sourceFile);
if (!file.open("r")) {
    console.writeln("ERROR: Cannot open " + sourceFile);
    exit(1);
}

var lines = [];
while (!file.eof) {
    var line = file.readln();
    if (line !== null) {
        lines.push(line);
    }
}
file.close();

console.writeln("Read " + lines.length + " lines from " + sourceFile);

// Create backup
var backup = new File(backupFile);
if (backup.open("w")) {
    for (var i = 0; i < lines.length; i++) {
        backup.writeln(lines[i]);
    }
    backup.close();
    console.writeln("Created backup: " + backupFile);
}

// Define extraction markers - functions/sections to remove
var extractionRanges = [
    // Team data functions (already in lib/game-logic/team-data.js)
    { start: /^var NBATeams = \{\};/, end: /^function resolveSpriteBaseBySkin/, comment: "TEAM DATA → lib/game-logic/team-data.js" },

    // Player class (already in lib/game-logic/player-class.js)
    { start: /^function Player\(name, jersey, attributes/, end: /^Player\.prototype\.rechargeTurbo/, comment: "PLAYER CLASS → lib/game-logic/player-class.js" },

    // Movement physics (already in lib/game-logic/movement-physics.js)
    { start: /^function checkSpriteCollision\(\)/, end: /^function createMovementCounters/, comment: "MOVEMENT PHYSICS → lib/game-logic/movement-physics.js" },

    // Court rendering (already in lib/rendering/court-rendering.js)
    { start: /^function drawBaselineTeamNames\(\)/, end: /^function updateBallPosition\(\)/, comment: "COURT RENDERING → lib/rendering/court-rendering.js" },

    // Game state init (already in lib/game-logic/game-state.js)
    { start: /^function createDefaultGameState\(\)/, end: /^function resetGameState/, comment: "GAME STATE → lib/game-logic/game-state.js" }
];

console.writeln("\nThis script needs manual execution of deletions.");
console.writeln("Use your editor to remove the following function ranges:\n");

// Find and report ranges
for (var r = 0; r < extractionRanges.length; r++) {
    var range = extractionRanges[r];
    var startLine = -1;
    var endLine = -1;

    for (var i = 0; i < lines.length; i++) {
        if (startLine === -1 && range.start.test(lines[i])) {
            startLine = i + 1; // 1-indexed for humans
        }
        if (startLine !== -1 && endLine === -1 && range.end.test(lines[i])) {
            endLine = i + 1;
            break;
        }
    }

    if (startLine !== -1 && endLine !== -1) {
        console.writeln("✂️  " + range.comment);
        console.writeln("   Lines " + startLine + " to " + endLine + " (" + (endLine - startLine) + " lines)");
        console.writeln("");
    }
}

console.writeln("\nBackup created at: " + backupFile);
console.writeln("Ready for manual pruning.");
