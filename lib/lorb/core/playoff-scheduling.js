/**
 * playoff-scheduling.js - Availability-Based Auto-Scheduling for Playoffs
 * 
 * Implements the V1 scheduling system from docs/lorb/Playoff_Scheduling_Spec.md:
 * - Player availability stored as weekly UTC blocks
 * - Auto-scheduling finds earliest overlap window
 * - Grace period handling for scheduled matches
 * - Defer token tracking
 * 
 * Data structures:
 * - ctx.playoffAvailability: { blocks: [...], updatedAt, presetName }
 * - match.scheduling: { scheduledStartUTC, scheduledEndUTC, graceEndsUTC, scheduledBy, deferUsed }
 */
(function() {
    
    if (!this.LORB) this.LORB = {};
    if (!LORB.Playoffs) LORB.Playoffs = {};
    
    var Config = LORB.Config || {};
    var PlayoffConfig = Config.PLAYOFF || {};
    var SchedulingConfig = PlayoffConfig.SCHEDULING || {};
    
    // Config values with defaults
    var PVP_WINDOW_HOURS = SchedulingConfig.PVP_WINDOW_HOURS || 72;
    var HARD_DEADLINE_HOURS = SchedulingConfig.HARD_DEADLINE_HOURS || 168;
    var BLOCK_MINUTES = SchedulingConfig.BLOCK_MINUTES || 120;
    var GRACE_MINUTES = SchedulingConfig.GRACE_MINUTES || 20;
    var MAX_DEFERS = SchedulingConfig.MAX_DEFERS_PER_PLAYER || 1;
    var MIN_BUFFER_MINUTES = SchedulingConfig.MIN_SCHEDULE_BUFFER_MINUTES || 15;
    
    var DEFAULT_AVAILABILITY = PlayoffConfig.DEFAULT_AVAILABILITY || [];
    
    // ========== UTILITY FUNCTIONS ==========
    
    function nowMs() {
        return Date.now ? Date.now() : (time() * 1000);
    }
    
    function hoursToMs(hours) {
        return hours * 60 * 60 * 1000;
    }
    
    function minutesToMs(minutes) {
        return minutes * 60 * 1000;
    }
    
    function msToMinutes(ms) {
        return Math.floor(ms / 60000);
    }
    
    /**
     * Get day of week (0=Sun, 6=Sat) from timestamp
     */
    function getDayOfWeek(timestampMs) {
        return new Date(timestampMs).getUTCDay();
    }
    
    /**
     * Get minutes since midnight UTC from timestamp
     */
    function getMinuteOfDay(timestampMs) {
        var d = new Date(timestampMs);
        return d.getUTCHours() * 60 + d.getUTCMinutes();
    }
    
    /**
     * Get start of current UTC day
     */
    function getStartOfDayUTC(timestampMs) {
        var d = new Date(timestampMs);
        d.setUTCHours(0, 0, 0, 0);
        return d.getTime();
    }
    
    // ========== AVAILABILITY MANAGEMENT ==========
    
    /**
     * Get player's availability blocks, falling back to default if not set
     * @param {Object} ctx - Player context
     * @returns {Array} Array of { dayOfWeek, startMinuteUTC }
     */
    function getPlayerAvailability(ctx) {
        if (ctx && ctx.playoffAvailability && ctx.playoffAvailability.blocks) {
            return ctx.playoffAvailability.blocks;
        }
        return DEFAULT_AVAILABILITY;
    }
    
    /**
     * Check if player has explicitly set their availability
     * @param {Object} ctx - Player context
     * @returns {boolean}
     */
    function hasSetAvailability(ctx) {
        return !!(ctx && ctx.playoffAvailability && ctx.playoffAvailability.updatedAt);
    }
    
    /**
     * Set player availability from a preset
     * @param {Object} ctx - Player context
     * @param {string} presetName - Name of preset ("weeknights", "weekend_day", etc.)
     * @param {Array} blocks - Array of { dayOfWeek, startMinuteUTC }
     */
    function setAvailability(ctx, presetName, blocks) {
        ctx.playoffAvailability = {
            presetName: presetName,
            blocks: blocks,
            updatedAt: nowMs()
        };
    }
    
    /**
     * Add custom availability blocks
     * @param {Object} ctx - Player context
     * @param {Array} newBlocks - Blocks to add
     */
    function addAvailabilityBlocks(ctx, newBlocks) {
        if (!ctx.playoffAvailability) {
            ctx.playoffAvailability = { blocks: [], updatedAt: nowMs(), presetName: "custom" };
        }
        
        // Dedupe by day+startMinute
        var existing = {};
        for (var i = 0; i < ctx.playoffAvailability.blocks.length; i++) {
            var b = ctx.playoffAvailability.blocks[i];
            existing[b.dayOfWeek + "_" + b.startMinuteUTC] = true;
        }
        
        for (var j = 0; j < newBlocks.length; j++) {
            var nb = newBlocks[j];
            var key = nb.dayOfWeek + "_" + nb.startMinuteUTC;
            if (!existing[key]) {
                ctx.playoffAvailability.blocks.push(nb);
                existing[key] = true;
            }
        }
        
        ctx.playoffAvailability.updatedAt = nowMs();
        ctx.playoffAvailability.presetName = "custom";
    }
    
    // ========== OVERLAP CALCULATION ==========
    
    /**
     * Expand weekly availability blocks into concrete UTC timestamps
     * within a time window.
     * 
     * @param {Array} blocks - Weekly blocks { dayOfWeek, startMinuteUTC }
     * @param {number} startUTC - Window start timestamp
     * @param {number} endUTC - Window end timestamp
     * @returns {Array} Array of { startUTC, endUTC } concrete windows
     */
    function expandBlocksToWindow(blocks, startUTC, endUTC) {
        var results = [];
        var blockDurationMs = minutesToMs(BLOCK_MINUTES);
        
        // Iterate through each day in the window
        var currentDay = getStartOfDayUTC(startUTC);
        var windowEnd = endUTC;
        
        while (currentDay < windowEnd) {
            var dayOfWeek = getDayOfWeek(currentDay);
            
            // Check each block to see if it matches this day
            for (var i = 0; i < blocks.length; i++) {
                var block = blocks[i];
                if (block.dayOfWeek === dayOfWeek) {
                    var blockStart = currentDay + minutesToMs(block.startMinuteUTC);
                    var blockEnd = blockStart + blockDurationMs;
                    
                    // Only include if within our window
                    if (blockStart >= startUTC && blockStart < windowEnd) {
                        results.push({
                            startUTC: blockStart,
                            endUTC: blockEnd
                        });
                    }
                }
            }
            
            // Move to next day
            currentDay += 24 * 60 * 60 * 1000;
        }
        
        // Sort by start time
        results.sort(function(a, b) { return a.startUTC - b.startUTC; });
        
        return results;
    }
    
    /**
     * Find overlapping windows between two players
     * 
     * @param {Array} windowsA - Concrete windows for player A
     * @param {Array} windowsB - Concrete windows for player B
     * @returns {Array} Array of overlapping { startUTC, endUTC }
     */
    function findOverlaps(windowsA, windowsB) {
        var overlaps = [];
        
        for (var i = 0; i < windowsA.length; i++) {
            var a = windowsA[i];
            for (var j = 0; j < windowsB.length; j++) {
                var b = windowsB[j];
                
                // Check for overlap
                var overlapStart = Math.max(a.startUTC, b.startUTC);
                var overlapEnd = Math.min(a.endUTC, b.endUTC);
                
                if (overlapStart < overlapEnd) {
                    overlaps.push({
                        startUTC: overlapStart,
                        endUTC: overlapEnd
                    });
                }
            }
        }
        
        // Sort by start time
        overlaps.sort(function(a, b) { return a.startUTC - b.startUTC; });
        
        return overlaps;
    }
    
    /**
     * Find the earliest available scheduling window for two players
     * 
     * @param {Object} player1Ctx - Player 1 context (or availability data)
     * @param {Object} player2Ctx - Player 2 context (or availability data)
     * @param {number} pvpWindowEndUTC - End of PvP priority window
     * @returns {Object|null} { startUTC, endUTC } or null if no overlap
     */
    function findEarliestOverlap(player1Ctx, player2Ctx, pvpWindowEndUTC) {
        var now = nowMs();
        var bufferMs = minutesToMs(MIN_BUFFER_MINUTES);
        var searchStart = now + bufferMs;
        var searchEnd = pvpWindowEndUTC;
        
        if (searchStart >= searchEnd) {
            return null;  // No time left to schedule
        }
        
        // Get availability for both players
        var blocks1 = getPlayerAvailability(player1Ctx);
        var blocks2 = getPlayerAvailability(player2Ctx);
        
        // Expand to concrete windows
        var windows1 = expandBlocksToWindow(blocks1, searchStart, searchEnd);
        var windows2 = expandBlocksToWindow(blocks2, searchStart, searchEnd);
        
        // Find overlaps
        var overlaps = findOverlaps(windows1, windows2);
        
        // Return earliest overlap that starts after our buffer
        for (var i = 0; i < overlaps.length; i++) {
            if (overlaps[i].startUTC >= searchStart) {
                return overlaps[i];
            }
        }
        
        return null;
    }
    
    // ========== MATCH SCHEDULING ==========
    
    /**
     * Initialize scheduling data on a match
     * Called when match is created
     * 
     * @param {Object} match - Match object to modify
     * @param {Object} player1Data - Player 1 data (with playoffAvailability)
     * @param {Object} player2Data - Player 2 data (with playoffAvailability)
     */
    function initializeMatchScheduling(match, player1Data, player2Data) {
        var now = nowMs();
        var pvpWindowEnd = now + hoursToMs(PVP_WINDOW_HOURS);
        
        // Initialize scheduling structure
        match.scheduling = {
            scheduledStartUTC: null,
            scheduledEndUTC: null,
            graceEndsUTC: null,
            scheduledBy: null,
            pvpWindowEndsUTC: pvpWindowEnd,
            deferUsed: {}  // { playerId: boolean }
        };
        
        // Skip scheduling for BYE matches
        if (match.status === "bye") {
            return;
        }
        
        // Try to find overlap
        var overlap = findEarliestOverlap(player1Data, player2Data, pvpWindowEnd);
        
        if (overlap) {
            match.scheduling.scheduledStartUTC = overlap.startUTC;
            match.scheduling.scheduledEndUTC = overlap.endUTC;
            match.scheduling.graceEndsUTC = overlap.startUTC + minutesToMs(GRACE_MINUTES);
            match.scheduling.scheduledBy = "auto";
            match.status = "scheduled";
            
        } else {
        }
    }
    
    /**
     * Reschedule a match (e.g., after availability change)
     * Costs a defer token for the player requesting it
     * 
     * @param {Object} match - Match object
     * @param {string} requestingPlayerId - Player requesting reschedule
     * @param {Object} player1Data - Updated player 1 data
     * @param {Object} player2Data - Updated player 2 data
     * @returns {Object} { success, reason, newSchedule }
     */
    function rescheduleMatch(match, requestingPlayerId, player1Data, player2Data) {
        if (!match.scheduling) {
            return { success: false, reason: "Match has no scheduling data" };
        }
        
        // Check defer token
        if (match.scheduling.deferUsed[requestingPlayerId]) {
            return { success: false, reason: "You have already used your defer for this match" };
        }
        
        var now = nowMs();
        var pvpWindowEnd = match.scheduling.pvpWindowEndsUTC || (now + hoursToMs(PVP_WINDOW_HOURS));
        
        // Try to find new overlap
        var overlap = findEarliestOverlap(player1Data, player2Data, pvpWindowEnd);
        
        // Consume defer token
        match.scheduling.deferUsed[requestingPlayerId] = true;
        
        if (overlap) {
            match.scheduling.scheduledStartUTC = overlap.startUTC;
            match.scheduling.scheduledEndUTC = overlap.endUTC;
            match.scheduling.graceEndsUTC = overlap.startUTC + minutesToMs(GRACE_MINUTES);
            match.scheduling.scheduledBy = "reschedule";
            match.status = "scheduled";
            
            
            return { 
                success: true, 
                newSchedule: {
                    startUTC: overlap.startUTC,
                    endUTC: overlap.endUTC
                }
            };
        } else {
            // Clear schedule, rely on opportunistic
            match.scheduling.scheduledStartUTC = null;
            match.scheduling.scheduledEndUTC = null;
            match.scheduling.graceEndsUTC = null;
            match.scheduling.scheduledBy = null;
            match.status = "pending";
            
            
            return { 
                success: true, 
                reason: "No overlap found - match will use opportunistic PvP" 
            };
        }
    }
    
    // ========== GRACE PERIOD CHECKING ==========
    
    /**
     * Check if a match is currently in its scheduled grace window
     * @param {Object} match - Match object
     * @returns {boolean}
     */
    function isInGraceWindow(match) {
        if (!match.scheduling || !match.scheduling.scheduledStartUTC) {
            return false;
        }
        
        var now = nowMs();
        return now >= match.scheduling.scheduledStartUTC && 
               now <= match.scheduling.graceEndsUTC;
    }
    
    /**
     * Check if grace window has passed without match starting
     * @param {Object} match - Match object
     * @returns {boolean}
     */
    function isGraceExpired(match) {
        if (!match.scheduling || !match.scheduling.graceEndsUTC) {
            return false;
        }
        
        return nowMs() > match.scheduling.graceEndsUTC;
    }
    
    /**
     * Check if player can still defer this match
     * @param {Object} match - Match object
     * @param {string} playerId - Player ID
     * @returns {boolean}
     */
    function canDefer(match, playerId) {
        if (!match.scheduling) return false;
        return !match.scheduling.deferUsed[playerId];
    }
    
    /**
     * Record that a player used their defer
     * @param {Object} match - Match object
     * @param {string} playerId - Player ID
     */
    function useDefer(match, playerId) {
        if (!match.scheduling) {
            match.scheduling = { deferUsed: {} };
        }
        match.scheduling.deferUsed[playerId] = true;
    }
    
    // ========== NOTIFICATION HELPERS ==========
    
    /**
     * Get scheduled matches for a player within next N hours
     * @param {string} playerId - Player ID
     * @param {number} hoursAhead - Hours to look ahead (default 24)
     * @returns {Array} Array of { match, bracket, timeUntilMs }
     */
    function getUpcomingScheduledMatches(playerId, hoursAhead) {
        hoursAhead = hoursAhead || 24;
        var results = [];
        var now = nowMs();
        var cutoff = now + hoursToMs(hoursAhead);
        
        // Get active bracket
        if (!LORB.Playoffs || !LORB.Playoffs.getActiveBracket) {
            return results;
        }
        
        var bracket = LORB.Playoffs.getActiveBracket();
        if (!bracket || !bracket.matches) {
            return results;
        }
        
        for (var i = 0; i < bracket.matches.length; i++) {
            var match = bracket.matches[i];
            
            // Skip completed/bye matches
            if (match.status === "completed" || match.status === "bye") continue;
            
            // Check if player is in this match
            var isPlayer1 = match.player1 && match.player1.playerId === playerId;
            var isPlayer2 = match.player2 && match.player2.playerId === playerId;
            if (!isPlayer1 && !isPlayer2) continue;
            
            // Check if has upcoming schedule
            if (match.scheduling && match.scheduling.scheduledStartUTC) {
                var startUTC = match.scheduling.scheduledStartUTC;
                if (startUTC >= now && startUTC <= cutoff) {
                    results.push({
                        match: match,
                        bracket: bracket,
                        timeUntilMs: startUTC - now,
                        isInGrace: isInGraceWindow(match)
                    });
                }
            }
        }
        
        // Sort by time
        results.sort(function(a, b) { return a.timeUntilMs - b.timeUntilMs; });
        
        return results;
    }
    
    /**
     * Format a schedule time for display
     * @param {number} timestampMs - UTC timestamp
     * @returns {string} Human-readable string
     */
    function formatScheduleTime(timestampMs) {
        var d = new Date(timestampMs);
        var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var dayName = days[d.getUTCDay()];
        var hours = d.getUTCHours();
        var minutes = d.getUTCMinutes();
        var ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;
        var minStr = minutes < 10 ? "0" + minutes : String(minutes);
        
        return dayName + " " + hours + ":" + minStr + " " + ampm + " UTC";
    }
    
    /**
     * Format time until a scheduled match
     * @param {number} timeUntilMs - Milliseconds until match
     * @returns {string}
     */
    function formatTimeUntil(timeUntilMs) {
        if (timeUntilMs <= 0) return "NOW";
        
        var minutes = Math.floor(timeUntilMs / 60000);
        var hours = Math.floor(minutes / 60);
        minutes = minutes % 60;
        
        if (hours > 0) {
            return hours + "h " + minutes + "m";
        }
        return minutes + "m";
    }
    
    // ========== AVAILABILITY PRESETS ==========
    
    /**
     * Get available presets from config
     * @returns {Object} Map of preset name -> { label, blocks }
     */
    function getAvailabilityPresets() {
        // These match the AVAILABILITY_PRESETS in game-mode-constants.js
        return {
            weeknights: {
                label: "Weeknights (Mon-Fri evenings UTC)",
                blocks: [
                    { dayOfWeek: 1, startMinuteUTC: 0 },   { dayOfWeek: 1, startMinuteUTC: 120 },
                    { dayOfWeek: 2, startMinuteUTC: 0 },   { dayOfWeek: 2, startMinuteUTC: 120 },
                    { dayOfWeek: 3, startMinuteUTC: 0 },   { dayOfWeek: 3, startMinuteUTC: 120 },
                    { dayOfWeek: 4, startMinuteUTC: 0 },   { dayOfWeek: 4, startMinuteUTC: 120 },
                    { dayOfWeek: 5, startMinuteUTC: 0 },   { dayOfWeek: 5, startMinuteUTC: 120 }
                ]
            },
            weekend_day: {
                label: "Weekend Daytime (Sat-Sun afternoons UTC)",
                blocks: [
                    { dayOfWeek: 6, startMinuteUTC: 840 },  { dayOfWeek: 6, startMinuteUTC: 960 },
                    { dayOfWeek: 6, startMinuteUTC: 1080 }, { dayOfWeek: 6, startMinuteUTC: 1200 },
                    { dayOfWeek: 0, startMinuteUTC: 840 },  { dayOfWeek: 0, startMinuteUTC: 960 },
                    { dayOfWeek: 0, startMinuteUTC: 1080 }, { dayOfWeek: 0, startMinuteUTC: 1200 }
                ]
            },
            weekend_night: {
                label: "Weekend Nights (Sat-Sun evenings UTC)",
                blocks: [
                    { dayOfWeek: 6, startMinuteUTC: 1320 },
                    { dayOfWeek: 0, startMinuteUTC: 0 },    { dayOfWeek: 0, startMinuteUTC: 120 },
                    { dayOfWeek: 0, startMinuteUTC: 1320 },
                    { dayOfWeek: 1, startMinuteUTC: 0 },    { dayOfWeek: 1, startMinuteUTC: 120 }
                ]
            },
            flexible: {
                label: "Flexible (All common times)",
                blocks: [
                    // Weeknights
                    { dayOfWeek: 1, startMinuteUTC: 0 }, { dayOfWeek: 1, startMinuteUTC: 120 },
                    { dayOfWeek: 2, startMinuteUTC: 0 }, { dayOfWeek: 2, startMinuteUTC: 120 },
                    { dayOfWeek: 3, startMinuteUTC: 0 }, { dayOfWeek: 3, startMinuteUTC: 120 },
                    { dayOfWeek: 4, startMinuteUTC: 0 }, { dayOfWeek: 4, startMinuteUTC: 120 },
                    { dayOfWeek: 5, startMinuteUTC: 0 }, { dayOfWeek: 5, startMinuteUTC: 120 },
                    // Weekend day
                    { dayOfWeek: 6, startMinuteUTC: 840 }, { dayOfWeek: 6, startMinuteUTC: 960 },
                    { dayOfWeek: 6, startMinuteUTC: 1080 }, { dayOfWeek: 6, startMinuteUTC: 1200 },
                    { dayOfWeek: 0, startMinuteUTC: 840 }, { dayOfWeek: 0, startMinuteUTC: 960 },
                    { dayOfWeek: 0, startMinuteUTC: 1080 }, { dayOfWeek: 0, startMinuteUTC: 1200 },
                    // Weekend night
                    { dayOfWeek: 6, startMinuteUTC: 1320 }, { dayOfWeek: 0, startMinuteUTC: 1320 }
                ]
            }
        };
    }
    
    // ========== MISSED MATCH DETECTION ==========
    
    /**
     * Get any missed scheduled matches for a player (grace expired but not resolved).
     * Called on login to notify player of missed matches.
     * 
     * @param {string} playerId - Player ID
     * @returns {Array} Array of { match, bracket, missedAtMs, canReschedule }
     */
    function getMissedScheduledMatches(playerId) {
        var results = [];
        var now = nowMs();
        
        if (!LORB.Playoffs || !LORB.Playoffs.getAllActiveBrackets) {
            return results;
        }
        
        var brackets = LORB.Playoffs.getAllActiveBrackets();
        if (!brackets || brackets.length === 0) {
            return results;
        }
        
        for (var b = 0; b < brackets.length; b++) {
            var bracket = brackets[b];
            if (!bracket.matches) continue;
            
            for (var i = 0; i < bracket.matches.length; i++) {
                var match = bracket.matches[i];
                
                // Skip completed/bye matches
                if (match.status === "completed" || match.status === "bye") continue;
                
                // Check if player is in this match
                var isPlayer1 = match.player1 && match.player1.playerId === playerId;
                var isPlayer2 = match.player2 && match.player2.playerId === playerId;
                if (!isPlayer1 && !isPlayer2) continue;
                
                // Check if this match had a scheduled time that's now expired
                if (match.scheduling && match.scheduling.graceEndsUTC) {
                    if (now > match.scheduling.graceEndsUTC) {
                        // This scheduled time was missed
                        results.push({
                            match: match,
                            bracket: bracket,
                            missedAtMs: match.scheduling.scheduledStartUTC,
                            graceEndedMs: match.scheduling.graceEndsUTC,
                            canReschedule: canDefer(match, playerId)
                        });
                    }
                }
            }
        }
        
        return results;
    }
    
    /**
     * Check if a match is past its hard deadline and should be auto-resolved
     * @param {Object} match - Match object  
     * @returns {boolean}
     */
    function isPastHardDeadline(match) {
        if (!match.hardDeadline) {
            return false;
        }
        return nowMs() > match.hardDeadline;
    }
    
    /**
     * Get all matches past hard deadline that need auto-resolution
     * @returns {Array} Array of { match, bracket }
     */
    function getMatchesPastHardDeadline() {
        var results = [];
        var now = nowMs();
        
        if (!LORB.Playoffs || !LORB.Playoffs.getAllActiveBrackets) {
            return results;
        }
        
        var brackets = LORB.Playoffs.getAllActiveBrackets();
        if (!brackets || brackets.length === 0) {
            return results;
        }
        
        for (var b = 0; b < brackets.length; b++) {
            var bracket = brackets[b];
            if (!bracket.matches) continue;
            
            for (var i = 0; i < bracket.matches.length; i++) {
                var match = bracket.matches[i];
                
                // Skip completed/bye matches
                if (match.status === "completed" || match.status === "bye") continue;
                
                // Check hard deadline
                if (match.hardDeadline && now > match.hardDeadline) {
                    results.push({
                        match: match,
                        bracket: bracket
                    });
                }
            }
        }
        
        return results;
    }
    
    // ========== EXPORTS ==========
    
    LORB.Playoffs.Scheduling = {
        // Availability management
        getPlayerAvailability: getPlayerAvailability,
        hasSetAvailability: hasSetAvailability,
        setAvailability: setAvailability,
        addAvailabilityBlocks: addAvailabilityBlocks,
        getAvailabilityPresets: getAvailabilityPresets,
        
        // Scheduling operations
        findEarliestOverlap: findEarliestOverlap,
        initializeMatchScheduling: initializeMatchScheduling,
        rescheduleMatch: rescheduleMatch,
        
        // Grace period
        isInGraceWindow: isInGraceWindow,
        isGraceExpired: isGraceExpired,
        canDefer: canDefer,
        useDefer: useDefer,
        
        // Missed match detection
        getMissedScheduledMatches: getMissedScheduledMatches,
        isPastHardDeadline: isPastHardDeadline,
        getMatchesPastHardDeadline: getMatchesPastHardDeadline,
        
        // Notifications
        getUpcomingScheduledMatches: getUpcomingScheduledMatches,
        formatScheduleTime: formatScheduleTime,
        formatTimeUntil: formatTimeUntil,
        
        // Utilities (exposed for testing)
        expandBlocksToWindow: expandBlocksToWindow,
        findOverlaps: findOverlaps
    };
    
})();
