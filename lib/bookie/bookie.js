// bookie.js - NBA JAM Betting Odds Calculator
// Calculates and displays betting odds based on team ratings

// Key constants for navigation (if not already defined)
if (typeof KEY_UP === 'undefined') var KEY_UP = '\x1e';
if (typeof KEY_DOWN === 'undefined') var KEY_DOWN = '\x1f';
if (typeof KEY_LEFT === 'undefined') var KEY_LEFT = '\x1d';
if (typeof KEY_RIGHT === 'undefined') var KEY_RIGHT = '\x1c';

var BOOKIE_CONFIG = (typeof GAME_MODE_CONSTANTS === "object" && GAME_MODE_CONSTANTS.BOOKIE) ? GAME_MODE_CONSTANTS.BOOKIE : null;
var BETTING_CONFIG = (typeof GAME_MODE_CONSTANTS === "object" && GAME_MODE_CONSTANTS.BETTING) ? GAME_MODE_CONSTANTS.BETTING : null;

var BOOKIE_ATTR_WEIGHTS = (BOOKIE_CONFIG && BOOKIE_CONFIG.ATTRIBUTE_WEIGHTS) ? BOOKIE_CONFIG.ATTRIBUTE_WEIGHTS : {
    speed: 1.2,
    threePoint: 1.1,
    dunk: 1.0,
    power: 0.9,
    steal: 0.8,
    block: 0.7
};

var BOOKIE_ODDS_CONFIG = (BOOKIE_CONFIG && BOOKIE_CONFIG.ODDS) ? BOOKIE_CONFIG.ODDS : {
    invalidFavorite: -110,
    invalidUnderdog: 110,
    evenFavorite: -105,
    evenUnderdog: 105,
    evenDiffPercent: 2,
    baseOdds: 110,
    diffScaleFactor: 8,
    minFavorite: -500,
    maxUnderdog: 500
};

var BOOKIE_SPREAD_CONFIG = (BOOKIE_CONFIG && BOOKIE_CONFIG.SPREAD) ? BOOKIE_CONFIG.SPREAD : {
    pointsPerPower: 1.5,
    minSpread: 0.5,
    maxSpread: 20,
    roundingIncrement: 0.5
};

var BOOKIE_TOTALS_CONFIG = (BOOKIE_CONFIG && BOOKIE_CONFIG.OVER_UNDER) ? BOOKIE_CONFIG.OVER_UNDER : {
    basePerTeam: 30,
    powerScale: 4,
    minTotal: 60,
    maxTotal: 140,
    roundingIncrement: 0.5
};

var BETTING_DEFAULTS = BETTING_CONFIG ? BETTING_CONFIG : {
    defaultBankroll: 1000,
    defaultWager: 100
};

/**
 * Calculate team power rating based on player attributes
 * @param {Array} players - Array of player data objects with attributes
 * @returns {Number} - Team power rating
 */
function calculateTeamPower(players) {
    if (!players || players.length === 0) return 0;

    var totalPower = 0;
    var playerCount = 0;

    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (!player || !player.attributes) continue;

        var attrs = player.attributes;
        // Weighted attribute calculation
        // Speed, 3PT, Dunk, Power, Steal, Block
        var playerPower =
            (attrs[0] || 0) * BOOKIE_ATTR_WEIGHTS.speed +       // Speed (most important)
            (attrs[1] || 0) * BOOKIE_ATTR_WEIGHTS.threePoint +  // 3PT shooting
            (attrs[2] || 0) * BOOKIE_ATTR_WEIGHTS.dunk +        // Dunk
            (attrs[3] || 0) * BOOKIE_ATTR_WEIGHTS.power +       // Power
            (attrs[4] || 0) * BOOKIE_ATTR_WEIGHTS.steal +       // Steal
            (attrs[5] || 0) * BOOKIE_ATTR_WEIGHTS.block;        // Block

        totalPower += playerPower;
        playerCount++;
    }

    return playerCount > 0 ? totalPower / playerCount : 0;
}

/**
 * Convert power difference to American-style betting odds
 * @param {Number} favoritePower - Power rating of favorite team
 * @param {Number} underdogPower - Power rating of underdog team
 * @returns {Object} - { favorite: -110, underdog: +110 }
 */
function calculateOdds(favoritePower, underdogPower) {
    // Handle edge cases
    if (favoritePower <= 0 || underdogPower <= 0) {
        return { favorite: BOOKIE_ODDS_CONFIG.invalidFavorite, underdog: BOOKIE_ODDS_CONFIG.invalidUnderdog };
    }

    var powerDiff = Math.abs(favoritePower - underdogPower);
    var totalPower = favoritePower + underdogPower;
    var diffPercent = (powerDiff / totalPower) * 100;

    // Even matchup baseline
    if (diffPercent < BOOKIE_ODDS_CONFIG.evenDiffPercent) {
        return { favorite: BOOKIE_ODDS_CONFIG.evenFavorite, underdog: BOOKIE_ODDS_CONFIG.evenUnderdog };
    }

    // Scale odds based on power difference
    // More difference = higher odds spread
    var baseOdds = BOOKIE_ODDS_CONFIG.baseOdds;
    var oddsIncrease = Math.floor(diffPercent * BOOKIE_ODDS_CONFIG.diffScaleFactor); // Scale factor

    var favoriteOdds = -(baseOdds + oddsIncrease);
    var underdogOdds = baseOdds + oddsIncrease;

    // Cap extreme odds
    if (favoriteOdds < BOOKIE_ODDS_CONFIG.minFavorite) favoriteOdds = BOOKIE_ODDS_CONFIG.minFavorite;
    if (underdogOdds > BOOKIE_ODDS_CONFIG.maxUnderdog) underdogOdds = BOOKIE_ODDS_CONFIG.maxUnderdog;

    return {
        favorite: favoriteOdds,
        underdog: underdogOdds
    };
}

/**
 * Get matchup odds for two teams
 * @param {Array} teamAPlayers - Red team player data
 * @param {Array} teamBPlayers - Blue team player data
 * @returns {Object} - { teamAOdds: -110, teamBOdds: +110, favorite: "teamA" }
 */
function getMatchupOdds(teamAPlayers, teamBPlayers) {
    var redPower = calculateTeamPower(teamAPlayers);
    var bluePower = calculateTeamPower(teamBPlayers);

    var isFavorite = redPower > bluePower;
    var odds;

    if (isFavorite) {
        odds = calculateOdds(redPower, bluePower);
        return {
            teamAOdds: odds.favorite,
            teamBOdds: odds.underdog,
            favorite: "teamA",
            redPower: redPower,
            bluePower: bluePower
        };
    } else {
        odds = calculateOdds(bluePower, redPower);
        return {
            teamAOdds: odds.underdog,
            teamBOdds: odds.favorite,
            favorite: "teamB",
            redPower: redPower,
            bluePower: bluePower
        };
    }
}

/**
 * Format odds for display (American style)
 * @param {Number} odds - Numeric odds value
 * @returns {String} - Formatted odds string (e.g., "-110" or "+110")
 */
function formatOdds(odds) {
    if (typeof odds !== "number") return "EVEN";
    if (odds === 0) return "EVEN";
    if (odds > 0) return "+" + odds;
    return "" + odds;
}

/**
 * Get odds display lines for matchup screen
 * @param {Array} teamAPlayers - Red team player data
 * @param {Array} teamBPlayers - Blue team player data
 * @returns {Object} - { leftLine: "RED -110", rightLine: "BLUE +110" }
 */
function getOddsDisplayLines(teamAPlayers, teamBPlayers) {
    var matchup = getMatchupOdds(teamAPlayers, teamBPlayers);

    // Red team is on left, blue team is on right
    var leftLine = "ODDS: " + formatOdds(matchup.teamAOdds);
    var rightLine = "ODDS: " + formatOdds(matchup.teamBOdds);

    return {
        leftLine: leftLine,
        rightLine: rightLine,
        matchup: matchup
    };
}

/**
 * Calculate suggested point spread based on team power difference
 * @param {Array} teamAPlayers - Red team player data
 * @param {Array} teamBPlayers - Blue team player data
 * @returns {Object} - { favorite: "teamA", spread: 5.5 }
 */
function calculateSpread(teamAPlayers, teamBPlayers) {
    var redPower = calculateTeamPower(teamAPlayers);
    var bluePower = calculateTeamPower(teamBPlayers);

    var powerDiff = Math.abs(redPower - bluePower);
    // Convert power difference to points (roughly 1 power = N points)
    var spread = powerDiff * BOOKIE_SPREAD_CONFIG.pointsPerPower;
    var spreadIncrement = BOOKIE_SPREAD_CONFIG.roundingIncrement || 0.5;
    if (spreadIncrement > 0) {
        spread = Math.round(spread / spreadIncrement) * spreadIncrement;
    }

    if (spread < BOOKIE_SPREAD_CONFIG.minSpread) spread = BOOKIE_SPREAD_CONFIG.minSpread;
    if (spread > BOOKIE_SPREAD_CONFIG.maxSpread) spread = BOOKIE_SPREAD_CONFIG.maxSpread;

    return {
        favorite: redPower > bluePower ? "teamA" : "teamB",
        spread: spread,
        redPower: redPower,
        bluePower: bluePower
    };
}

/**
 * Calculate over/under line based on team offensive power
 * @param {Array} teamAPlayers - Red team player data
 * @param {Array} teamBPlayers - Blue team player data
 * @returns {Number} - Total points line (e.g., 85.5)
 */
function calculateOverUnder(teamAPlayers, teamBPlayers) {
    var redPower = calculateTeamPower(teamAPlayers);
    var bluePower = calculateTeamPower(teamBPlayers);

    // Base total on average team power
    var avgPower = (redPower + bluePower) / 2;
    // Scale to reasonable NBA JAM score range (30-70 per team)
    var total = BOOKIE_TOTALS_CONFIG.basePerTeam + (avgPower * BOOKIE_TOTALS_CONFIG.powerScale);
    var totalIncrement = BOOKIE_TOTALS_CONFIG.roundingIncrement || 0.5;
    if (totalIncrement > 0) {
        total = Math.round(total / totalIncrement) * totalIncrement;
    }

    if (total < BOOKIE_TOTALS_CONFIG.minTotal) total = BOOKIE_TOTALS_CONFIG.minTotal;
    if (total > BOOKIE_TOTALS_CONFIG.maxTotal) total = BOOKIE_TOTALS_CONFIG.maxTotal;

    return total;
}

/**
 * Betting slip to track user's bets
 * @param {number} [initialBankroll] - Optional starting bankroll (defaults to BETTING_DEFAULTS.defaultBankroll)
 */
function BettingSlip(initialBankroll) {
    this.bets = [];
    this.startingBankroll = (typeof initialBankroll === "number" && initialBankroll > 0) 
        ? initialBankroll 
        : BETTING_DEFAULTS.defaultBankroll;

    this.addBet = function (betType, selection, odds, risk) {
        this.bets.push({
            type: betType,
            selection: selection,
            odds: odds,
            risk: risk || BETTING_DEFAULTS.defaultWager,
            result: null, // Will be 'win', 'loss', or 'push' after game
            payout: 0
        });
    };

    this.getTotalRisk = function () {
        var total = 0;
        for (var i = 0; i < this.bets.length; i++) {
            total += this.bets[i].risk;
        }
        return total;
    };

    this.calculatePayout = function (odds, risk) {
        if (odds > 0) {
            // Underdog: +150 means win $150 on $100 bet
            return risk + (risk * (odds / 100));
        } else {
            // Favorite: -150 means win $100 on $150 bet
            return risk + (risk / (Math.abs(odds) / 100));
        }
    };

    this.gradeBets = function (gameResults) {
        var totalPayout = 0;

        for (var i = 0; i < this.bets.length; i++) {
            var bet = this.bets[i];
            var won = false;

            switch (bet.type) {
                case 'moneyline':
                    won = (bet.selection === gameResults.winner);
                    break;

                case 'spread':
                    if (bet.selection.team === gameResults.winner) {
                        // Favorite won - did they cover?
                        var margin = Math.abs(gameResults.teamAScore - gameResults.teamBScore);
                        won = (margin > bet.selection.spread);
                    } else {
                        // Underdog - did they cover or win?
                        var marginUd = Math.abs(gameResults.teamAScore - gameResults.teamBScore);
                        won = (bet.selection.team === gameResults.winner || marginUd < bet.selection.spread);
                    }
                    break;

                case 'total':
                    var total = gameResults.teamAScore + gameResults.teamBScore;
                    won = (bet.selection === 'over') ? (total > bet.odds) : (total < bet.odds);
                    break;

                case 'leader':
                    won = (bet.selection.player === gameResults.leaders[bet.selection.stat]);
                    break;
            }

            if (won) {
                bet.result = 'win';
                bet.payout = this.calculatePayout(bet.odds, bet.risk);
                totalPayout += bet.payout;
            } else {
                bet.result = 'loss';
                bet.payout = 0;
            }
        }

        return {
            totalPayout: totalPayout,
            totalRisk: this.getTotalRisk(),
            netProfit: totalPayout - this.getTotalRisk()
        };
    };
}

/**
 * Get team color codes for console output
 */
function getTeamColorCode(teamKey, matchupData) {
    if (!matchupData.teamColors) return "\1h\1w";
    var colors = matchupData.teamColors[teamKey];
    if (!colors || !colors.fg_code) return "\1h\1w";
    return colors.fg_code;
}

/**
 * Render player sprite to console at current position
 */
function renderPlayerSpriteToConsole(sprite, startRow) {
    if (!sprite || !sprite.frame) return;
    var width = sprite.frame.width || 5;
    var height = sprite.frame.height || 4;

    for (var y = 0; y < height && y < 4; y++) {
        console.gotoxy(console.getxy().x, startRow + y);
        for (var x = 0; x < width; x++) {
            var cell = sprite.frame.getData(x, y, false);
            if (!cell) continue;
            var ch = cell.ch || ' ';
            var attr = cell.attr || 7;
            if (ch === '\0' || ch === null) ch = ' ';
            console.putmsg(ch, attr);
        }
    }
}

/**
 * Format bet for display (no JSON)
 */
function formatBetDisplay(bet, matchupData) {
    var teamColor1 = getTeamColorCode("teamA", matchupData);
    var teamColor2 = getTeamColorCode("teamB", matchupData);

    if (bet.type === 'moneyline') {
        var teamColor = bet.selection === 'teamA' ? teamColor1 : teamColor2;
        var teamName = bet.selection === 'teamA' ? matchupData.teamATeam : matchupData.teamBTeam;
        return teamColor + teamName + " " + formatOdds(bet.odds) + "\1n";
    } else if (bet.type === 'spread') {
        var tColor = bet.selection.team === 'teamA' ? teamColor1 : teamColor2;
        var tName = bet.selection.team === 'teamA' ? matchupData.teamATeam : matchupData.teamBTeam;
        var sign = bet.selection.spread > 0 ? "+" : "-";
        return tColor + tName + " " + sign + Math.abs(bet.selection.spread) + "\1n";
    } else if (bet.type === 'total') {
        var dirColor = bet.selection === 'over' ? '\1h\1g' : '\1h\1c';
        return dirColor + bet.selection.toUpperCase() + " " + bet.odds + "\1n";
    } else if (bet.type === 'leader') {
        return "\1h\1y" + bet.selection.player + "\1n (" + bet.selection.stat + ")";
    }
    return "";
}

/**
 * Format dollar amount to 2 decimal places
 */
function formatDollars(amount) {
    if (typeof amount !== "number") return "$0.00";
    return "$" + amount.toFixed(2);
}

/**
 * Show betting interface and collect bets
 * Wave 24: Refactored to use Frame-based rendering, fit within 24 rows, variable wagers
 * @param {Object} matchupData - Contains team info, players, odds, sprites
 * @param {number} [bankroll] - Optional starting bankroll (for LORB integration)
 * @returns {BettingSlip} - Completed betting slip with user's bets
 */
function showBettingInterface(matchupData, bankroll) {
    if (typeof console === "undefined") return null;
    if (typeof Frame === "undefined") {
        try { load("frame.js"); } catch (e) { return null; }
    }

    var slip = new BettingSlip(bankroll);
    var odds = matchupData.odds;
    var spread = matchupData.spread;
    var total = matchupData.total;

    var currentScreen = 'menu';
    var currentWager = 100;  // Default wager amount
    var MIN_WAGER = 50;
    var MAX_WAGER = 500;
    var WAGER_STEP = 50;

    var teamAColor = getTeamColorCode("teamA", matchupData);
    var teamBColor = getTeamColorCode("teamB", matchupData);
    
    // Create main frame for clean rendering (24 rows max)
    var mainFrame = new Frame(1, 1, 80, 24, BG_BLACK);
    mainFrame.checkbounds = false;
    mainFrame.atcodes = true;
    mainFrame.open();

    while (true) {
        mainFrame.clear();
        
        // Row 1-3: Header box with matchup
        var teamMatchup = matchupData.teamATeam + " vs " + matchupData.teamBTeam;
        var headerText = "NBA JAM SPORTS BOOK - " + teamMatchup;
        if (headerText.length > 74) headerText = headerText.substring(0, 74);
        
        mainFrame.gotoxy(1, 1);
        mainFrame.putmsg("\1h\1y" + ascii(201) + repeatChar(ascii(205), 78) + ascii(187) + "\1n");
        mainFrame.gotoxy(1, 2);
        mainFrame.putmsg("\1h\1y" + ascii(186) + "\1n " + teamAColor + matchupData.teamATeam + "\1n \1h\1wvs\1n " + teamBColor + matchupData.teamBTeam + "\1n");
        // Pad to end of line
        var matchupLen = matchupData.teamATeam.length + matchupData.teamBTeam.length + 6;
        mainFrame.putmsg(repeatChar(" ", 76 - matchupLen) + "\1h\1y" + ascii(186) + "\1n");
        mainFrame.gotoxy(1, 3);
        mainFrame.putmsg("\1h\1y" + ascii(200) + repeatChar(ascii(205), 78) + ascii(188) + "\1n");
        
        // Row 4: Bankroll display (no padding above)
        var bankrollStr = formatDollars(slip.startingBankroll);
        var riskedStr = formatDollars(slip.getTotalRisk());
        var remainingStr = formatDollars(slip.startingBankroll - slip.getTotalRisk());
        mainFrame.gotoxy(1, 4);
        mainFrame.putmsg("Bankroll: \1h\1g" + bankrollStr + "\1n | Risked: \1h\1r" + riskedStr + "\1n | Remaining: \1h\1c" + remainingStr + "\1n");

        if (currentScreen === 'menu') {
            // Row 5: Wager amount selector
            mainFrame.gotoxy(1, 5);
            mainFrame.putmsg("Wager: \1h\1y" + formatDollars(currentWager) + "\1n  \1k[\1h\1c-\1n\1k/\1h\1c+\1n\1k to adjust]\1n");
            
            // Row 6-7: Moneyline
            var favoriteML = odds.teamAOdds < odds.teamBOdds ? "teamA" : "teamB";
            var favColorML = favoriteML === "teamA" ? teamAColor : teamBColor;
            var undColorML = favoriteML === "teamA" ? teamBColor : teamAColor;
            var favTeamML = favoriteML === "teamA" ? matchupData.teamATeam : matchupData.teamBTeam;
            var undTeamML = favoriteML === "teamA" ? matchupData.teamBTeam : matchupData.teamATeam;
            var favOddsML = favoriteML === "teamA" ? odds.teamAOdds : odds.teamBOdds;
            var undOddsML = favoriteML === "teamA" ? odds.teamBOdds : odds.teamAOdds;
            
            mainFrame.gotoxy(1, 7);
            mainFrame.putmsg("\1h\1g1\1n. \1wMONEYLINE\1n  " + favColorML + favTeamML + " \1h\1y" + formatOdds(favOddsML) + "\1n  " + undColorML + undTeamML + " \1h\1g" + formatOdds(undOddsML) + "\1n");
            
            // Row 8-9: Spread
            var spreadFav = spread.favorite === "teamA" ? matchupData.teamATeam : matchupData.teamBTeam;
            var spreadDog = spread.favorite === "teamA" ? matchupData.teamBTeam : matchupData.teamATeam;
            var spreadFavColor = spread.favorite === "teamA" ? teamAColor : teamBColor;
            var spreadDogColor = spread.favorite === "teamA" ? teamBColor : teamAColor;
            mainFrame.gotoxy(1, 9);
            mainFrame.putmsg("\1h\1g2\1n. \1wSPREAD\1n     " + spreadFavColor + spreadFav + " -" + spread.spread + "\1n  " + spreadDogColor + spreadDog + " +" + spread.spread + "\1n");
            
            // Row 10-11: Over/Under
            mainFrame.gotoxy(1, 11);
            mainFrame.putmsg("\1h\1g3\1n. \1wOVER/UNDER\1n \1h\1gOver " + total + "\1n / \1h\1cUnder " + total + "\1n");
            
            // Row 12: Stat Leaders
            mainFrame.gotoxy(1, 13);
            mainFrame.putmsg("\1h\1g4\1n. \1wSTAT LEADERS\1n  \1k(+200 odds)\1n");
            
            // Row 14-18: Current bets display
            if (slip.bets.length > 0) {
                mainFrame.gotoxy(1, 15);
                mainFrame.putmsg("\1h\1yYOUR BETS (" + slip.bets.length + "):\1n");
                for (var i = 0; i < slip.bets.length && i < 3; i++) {
                    var bet = slip.bets[i];
                    mainFrame.gotoxy(1, 16 + i);
                    mainFrame.putmsg("  " + formatBetDisplay(bet, matchupData) + " \1r" + formatDollars(bet.risk) + "\1n");
                }
                if (slip.bets.length > 3) {
                    mainFrame.gotoxy(1, 19);
                    mainFrame.putmsg("  \1k... and " + (slip.bets.length - 3) + " more\1n");
                }
            }
            
            // Row 22-23: Commands (combined on fewer lines)
            mainFrame.gotoxy(1, 21);
            mainFrame.putmsg("\1h\1c-/+\1n Adjust wager   \1h\1cD\1n Done & start game   \1h\1rQ\1n Cancel");
            mainFrame.gotoxy(1, 23);
            mainFrame.putmsg("Select option: ");
        }
        
        mainFrame.cycle();
        
        if (currentScreen === 'menu') {
            var key = console.getkey().toUpperCase();
            
            if (key === 'Q') {
                mainFrame.close();
                console.clear();
                return null;
            } else if (key === 'D' && slip.bets.length > 0) {
                mainFrame.close();
                console.clear();
                return slip;
            } else if (key === '-' || key === '_') {
                currentWager = Math.max(MIN_WAGER, currentWager - WAGER_STEP);
            } else if (key === '+' || key === '=') {
                var maxAllowed = Math.min(MAX_WAGER, slip.startingBankroll - slip.getTotalRisk());
                currentWager = Math.min(maxAllowed, currentWager + WAGER_STEP);
            } else if (key === '1') {
                currentScreen = 'moneyline';
            } else if (key === '2') {
                currentScreen = 'spread';
            } else if (key === '3') {
                currentScreen = 'total';
            } else if (key === '4') {
                currentScreen = 'leaders';
            }
        } else {
            // Sub-screens
            mainFrame.close();
            var subResult = handleBettingSubScreen(currentScreen, matchupData, currentWager, slip);
            // Re-open main frame
            mainFrame = new Frame(1, 1, 80, 24, BG_BLACK);
            mainFrame.checkbounds = false;
            mainFrame.atcodes = true;
            mainFrame.open();
            
            if (subResult && subResult.type) {
                slip.addBet(subResult.type, subResult.selection, subResult.odds, subResult.risk);
            }
            currentScreen = 'menu';
        }
    }
}



function handleBettingSubScreen(screen, matchupData, wagerAmount, slip) {
    var teamAColor = getTeamColorCode("teamA", matchupData);
    var teamBColor = getTeamColorCode("teamB", matchupData);
    
    // Create frame for sub-screen
    var subFrame = new Frame(1, 1, 80, 24, BG_BLACK);
    subFrame.checkbounds = false;
    subFrame.atcodes = true;
    subFrame.open();
    
    // Helper to draw header box
    function drawHeader(title) {
        var h = ascii(205);
        var line = repeatChar(h, 76);
        subFrame.gotoxy(1, 1);
        subFrame.putmsg("\1h\1y" + ascii(201) + line + ascii(187) + "\1n");
        subFrame.gotoxy(1, 2);
        var titlePad = repeatChar(" ", 74 - title.length);
        subFrame.putmsg("\1h\1y" + ascii(186) + "  " + title + titlePad + ascii(186) + "\1n");
        subFrame.gotoxy(1, 3);
        subFrame.putmsg("\1h\1y" + ascii(200) + line + ascii(188) + "\1n");
    }
    
    var result = null;

    if (screen === 'moneyline') {
        drawHeader("MONEYLINE - Pick the Winner");
        subFrame.gotoxy(2, 5);
        subFrame.putmsg("\1h\1g1\1n. " + teamAColor + matchupData.teamATeam + "\1n " + formatOdds(matchupData.odds.teamAOdds));
        subFrame.gotoxy(2, 6);
        subFrame.putmsg("\1h\1g2\1n. " + teamBColor + matchupData.teamBTeam + "\1n " + formatOdds(matchupData.odds.teamBOdds));
        subFrame.gotoxy(2, 8);
        subFrame.putmsg("\1h\1kQ\1n. Back");
        subFrame.gotoxy(2, 10);
        subFrame.putmsg("Wager: \1h\1y" + formatDollars(wagerAmount) + "\1n");
        subFrame.gotoxy(2, 12);
        subFrame.putmsg("Pick: ");
        subFrame.draw();

        var key = console.getkey().toUpperCase();
        if (key === '1') {
            result = { type: 'moneyline', selection: 'teamA', odds: matchupData.odds.teamAOdds, risk: wagerAmount };
        } else if (key === '2') {
            result = { type: 'moneyline', selection: 'teamB', odds: matchupData.odds.teamBOdds, risk: wagerAmount };
        }
    } else if (screen === 'spread') {
        drawHeader("POINT SPREAD");
        var spread = matchupData.spread;
        var y = 5;
        if (spread.favorite === "teamA") {
            subFrame.gotoxy(2, y);
            subFrame.putmsg("\1h\1g1\1n. " + teamAColor + matchupData.teamATeam + " -" + spread.spread + "\1n (-110)");
            subFrame.gotoxy(5, y + 1);
            subFrame.putmsg("\1k(must win by more than " + spread.spread + " pts)\1n");
            subFrame.gotoxy(2, y + 3);
            subFrame.putmsg("\1h\1g2\1n. " + teamBColor + matchupData.teamBTeam + " +" + spread.spread + "\1n (-110)");
            subFrame.gotoxy(5, y + 4);
            subFrame.putmsg("\1k(must lose by less than " + spread.spread + " or win)\1n");
        } else {
            subFrame.gotoxy(2, y);
            subFrame.putmsg("\1h\1g1\1n. " + teamBColor + matchupData.teamBTeam + " -" + spread.spread + "\1n (-110)");
            subFrame.gotoxy(5, y + 1);
            subFrame.putmsg("\1k(must win by more than " + spread.spread + " pts)\1n");
            subFrame.gotoxy(2, y + 3);
            subFrame.putmsg("\1h\1g2\1n. " + teamAColor + matchupData.teamATeam + " +" + spread.spread + "\1n (-110)");
            subFrame.gotoxy(5, y + 4);
            subFrame.putmsg("\1k(must lose by less than " + spread.spread + " or win)\1n");
        }
        subFrame.gotoxy(2, y + 6);
        subFrame.putmsg("\1h\1kQ\1n. Back");
        subFrame.gotoxy(2, y + 8);
        subFrame.putmsg("Wager: \1h\1y" + formatDollars(wagerAmount) + "\1n");
        subFrame.gotoxy(2, y + 10);
        subFrame.putmsg("Pick: ");
        subFrame.draw();

        var keySpread = console.getkey().toUpperCase();
        if (keySpread === '1') {
            var team1 = spread.favorite === "teamA" ? "teamA" : "teamB";
            result = { type: 'spread', selection: { team: team1, spread: spread.spread }, odds: -110, risk: wagerAmount };
        } else if (keySpread === '2') {
            var team2 = spread.favorite === "teamA" ? "teamB" : "teamA";
            result = { type: 'spread', selection: { team: team2, spread: spread.spread }, odds: -110, risk: wagerAmount };
        }
    } else if (screen === 'total') {
        drawHeader("OVER/UNDER - Total Points");
        var y = 5;
        subFrame.gotoxy(2, y);
        subFrame.putmsg("\1h\1g1\1n. \1h\1gOver " + matchupData.total + "\1n (-110)");
        subFrame.gotoxy(5, y + 1);
        subFrame.putmsg("\1k(teams score MORE than " + matchupData.total + " combined)\1n");
        subFrame.gotoxy(2, y + 3);
        subFrame.putmsg("\1h\1g2\1n. \1h\1cUnder " + matchupData.total + "\1n (-110)");
        subFrame.gotoxy(5, y + 4);
        subFrame.putmsg("\1k(teams score LESS than " + matchupData.total + " combined)\1n");
        subFrame.gotoxy(2, y + 6);
        subFrame.putmsg("\1h\1kQ\1n. Back");
        subFrame.gotoxy(2, y + 8);
        subFrame.putmsg("Wager: \1h\1y" + formatDollars(wagerAmount) + "\1n");
        subFrame.gotoxy(2, y + 10);
        subFrame.putmsg("Pick: ");
        subFrame.draw();

        var keyTotal = console.getkey().toUpperCase();
        if (keyTotal === '1') {
            result = { type: 'total', selection: 'over', odds: matchupData.total, risk: wagerAmount };
        } else if (keyTotal === '2') {
            result = { type: 'total', selection: 'under', odds: matchupData.total, risk: wagerAmount };
        }
    } else if (screen === 'leaders') {
        subFrame.close();
        return showStatLeadersCarousel(matchupData, slip, wagerAmount);
    }

    subFrame.close();
    return result;
}

/**
 * Show stat leaders interface with carousel for player selection
 * Uses Frame-based rendering for clean display
 */
function showStatLeadersCarousel(matchupData, slip, wagerAmount) {
    var statCategories = ['points', 'assists', 'rebounds', 'steals', 'blocks'];
    var statNames = ['POINTS', 'ASSISTS', 'REBOUNDS', 'STEALS', 'BLOCKS'];
    var currentStat = 0;
    var currentPlayer = 0;
    var selectedBets = {};

    var allPlayers = [];
    var playerSprites = matchupData.sprites || [];

    // Build player list
    for (var i = 0; i < matchupData.teamAPlayers.length; i++) {
        var rp = matchupData.teamAPlayers[i];
        if (rp) allPlayers.push({
            name: rp.name,
            team: 'teamA',
            odds: +200,
            sprite: playerSprites[i] || null
        });
    }
    for (var j = 0; j < matchupData.teamBPlayers.length; j++) {
        var bp = matchupData.teamBPlayers[j];
        if (bp) allPlayers.push({
            name: bp.name,
            team: 'teamB',
            odds: +200,
            sprite: playerSprites[j + 2] || null
        });
    }

    if (allPlayers.length === 0) return null;

    while (true) {
        // Create frame for this screen
        var leadFrame = new Frame(1, 1, 80, 24, BG_BLACK);
        leadFrame.checkbounds = false;
        leadFrame.atcodes = true;
        leadFrame.open();

        // Draw header box
        var h = ascii(205);
        var line = repeatChar(h, 76);
        leadFrame.gotoxy(1, 1);
        leadFrame.putmsg("\1h\1y" + ascii(201) + line + ascii(187) + "\1n");
        leadFrame.gotoxy(1, 2);
        leadFrame.putmsg("\1h\1y" + ascii(186) + "  STAT LEADERS - Who will lead?                                            " + ascii(186) + "\1n");
        leadFrame.gotoxy(1, 3);
        leadFrame.putmsg("\1h\1y" + ascii(200) + line + ascii(188) + "\1n");

        // Show stat categories with selection indicator (row 5)
        leadFrame.gotoxy(2, 5);
        var catLine = "Category: ";
        for (var c = 0; c < statCategories.length; c++) {
            if (c === currentStat) {
                catLine += "\1h\1y[" + statNames[c] + "]\1n ";
            } else {
                catLine += "\1k" + statNames[c] + "\1n ";
            }
        }
        leadFrame.putmsg(catLine);

        // Show current player (row 7-8)
        var player = allPlayers[currentPlayer];
        var playerColor = player.team === 'teamA' ? getTeamColorCode("teamA", matchupData) : getTeamColorCode("teamB", matchupData);
        
        leadFrame.gotoxy(2, 7);
        leadFrame.putmsg("Player: " + playerColor + player.name + "\1n \1h\1y+200\1n odds");
        leadFrame.gotoxy(2, 8);
        leadFrame.putmsg("\1k<" + ascii(17) + " " + (currentPlayer + 1) + "/" + allPlayers.length + " " + ascii(16) + ">\1n");

        // Wager display (row 10)
        leadFrame.gotoxy(2, 10);
        leadFrame.putmsg("Wager per stat: \1h\1y" + formatDollars(wagerAmount) + "\1n");

        // Show current selections (rows 12-16)
        var selKeys = Object.keys(selectedBets);
        if (selKeys.length > 0) {
            leadFrame.gotoxy(2, 12);
            var selLine = repeatChar(ascii(196), 3) + " Your Selections " + repeatChar(ascii(196), 40);
            leadFrame.putmsg("\1h\1y" + selLine + "\1n");
            
            var selY = 13;
            for (var sk = 0; sk < selKeys.length && selY < 17; sk++) {
                var statKey = selKeys[sk];
                var sel = selectedBets[statKey];
                var selColor = sel.team === 'teamA' ? getTeamColorCode("teamA", matchupData) : getTeamColorCode("teamB", matchupData);
                leadFrame.gotoxy(4, selY);
                leadFrame.putmsg(statKey.toUpperCase() + ": " + selColor + sel.name + "\1n");
                selY++;
            }
        }

        // Commands (rows 19-21)
        leadFrame.gotoxy(2, 19);
        leadFrame.putmsg("\1h\1g[" + ascii(17) + "/" + ascii(16) + "]\1n Player  \1h\1g[" + ascii(30) + "/" + ascii(31) + "]\1n Stat  \1h\1g[SPACE]\1n Select");
        leadFrame.gotoxy(2, 20);
        leadFrame.putmsg("\1h\1cD\1n Done adding stat bets   \1h\1rQ\1n Cancel");
        leadFrame.gotoxy(2, 22);
        leadFrame.putmsg("Command: ");

        leadFrame.draw();

        var key = console.getkey();
        var keyUpper = key ? key.toUpperCase() : '';

        leadFrame.close();

        if (keyUpper === 'Q') {
            return null;
        } else if (keyUpper === 'D') {
            // Add all selected bets to slip and return
            for (var addKey in selectedBets) {
                if (selectedBets.hasOwnProperty(addKey)) {
                    var bet = selectedBets[addKey];
                    slip.addBet('leader', { stat: addKey, player: bet.name }, bet.odds, wagerAmount);
                }
            }
            return {}; // Signal bets added
        } else if (key === ' ') {
            // Select current player for current stat
            selectedBets[statCategories[currentStat]] = {
                name: player.name,
                team: player.team,
                odds: player.odds
            };
        } else if (key === KEY_LEFT || keyUpper === 'A') {
            currentPlayer = (currentPlayer - 1 + allPlayers.length) % allPlayers.length;
        } else if (key === KEY_RIGHT || keyUpper === 'S') {
            currentPlayer = (currentPlayer + 1) % allPlayers.length;
        } else if (key === KEY_UP || keyUpper === 'W') {
            currentStat = (currentStat - 1 + statCategories.length) % statCategories.length;
        } else if (key === KEY_DOWN || keyUpper === 'X') {
            currentStat = (currentStat + 1) % statCategories.length;
        }
    }
}

/**
 * Show betting results after game completes using Frame-based rendering
 * @param {BettingSlip} slip - The betting slip with bets
 * @param {Object} gameResults - Final game results
 */
function showBettingResults(slip, gameResults) {
    if (!slip || !gameResults) return;
    if (typeof console === "undefined") return;

    var results = slip.gradeBets(gameResults);

    // Create result frame
    var resultFrame = new Frame(1, 1, 80, 24, BG_BLACK);
    resultFrame.checkbounds = false;
    resultFrame.atcodes = true;
    resultFrame.open();

    var h = ascii(205);
    var line = repeatChar(h, 76);
    var y = 1;

    // Header
    resultFrame.gotoxy(1, y++);
    resultFrame.putmsg("\1h\1y" + ascii(201) + line + ascii(187) + "\1n");
    resultFrame.gotoxy(1, y++);
    resultFrame.putmsg("\1h\1y" + ascii(186) + "  BETTING RESULTS                                                          " + ascii(186) + "\1n");
    resultFrame.gotoxy(1, y++);
    resultFrame.putmsg("\1h\1y" + ascii(200) + line + ascii(188) + "\1n");
    y++;

    // Final Score
    resultFrame.gotoxy(2, y++);
    resultFrame.putmsg("\1h\1wFinal Score:\1n");
    resultFrame.gotoxy(4, y++);
    resultFrame.putmsg("\1h\1r" + gameResults.teamATeam + ": " + gameResults.teamAScore + "\1n  vs  \1h\1c" + gameResults.teamBTeam + ": " + gameResults.teamBScore + "\1n");

    var winnerName = gameResults.winner === 'teamA' ? gameResults.teamATeam : gameResults.teamBTeam;
    var winnerColor = gameResults.winner === 'teamA' ? '\1h\1r' : '\1h\1c';
    resultFrame.gotoxy(4, y++);
    resultFrame.putmsg(winnerColor + ascii(16) + " " + winnerName + " WINS! " + ascii(17) + "\1n");
    y++;

    // Bet results summary
    resultFrame.gotoxy(2, y++);
    resultFrame.putmsg("\1h\1wYour Bets:\1n");

    var wins = 0, losses = 0;
    for (var i = 0; i < slip.bets.length && y < 17; i++) {
        var bet = slip.bets[i];
        var isWin = bet.result === 'win';
        var resultColor = isWin ? '\1h\1g' : '\1h\1r';
        var resultSymbol = isWin ? ascii(251) : 'x';

        if (isWin) wins++;
        else losses++;

        resultFrame.gotoxy(4, y++);
        var betLine = resultColor + resultSymbol + "\1n ";

        if (bet.type === 'moneyline') {
            var teamName = bet.selection === 'teamA' ? gameResults.teamATeam : gameResults.teamBTeam;
            betLine += "ML: " + teamName + " " + formatOdds(bet.odds);
        } else if (bet.type === 'spread') {
            var tName = bet.selection.team === 'teamA' ? gameResults.teamATeam : gameResults.teamBTeam;
            var sign = bet.selection.spread > 0 ? "+" : "-";
            betLine += "Spread: " + tName + " " + sign + Math.abs(bet.selection.spread);
        } else if (bet.type === 'total') {
            var actualTotal = gameResults.teamAScore + gameResults.teamBScore;
            betLine += "O/U: " + bet.selection.toUpperCase() + " " + bet.odds + " \1k(actual: " + actualTotal + ")\1n";
        } else if (bet.type === 'leader') {
            betLine += "Leader: " + bet.selection.player + " (" + bet.selection.stat + ")";
        }

        betLine += " - " + formatDollars(bet.risk);
        if (isWin) {
            betLine += " \1h\1g" + ascii(26) + " " + formatDollars(bet.payout) + "\1n";
        }

        resultFrame.putmsg(betLine);
    }
    y++;

    // Summary divider
    resultFrame.gotoxy(2, y++);
    resultFrame.putmsg("\1h\1y" + repeatChar(ascii(196), 74) + "\1n");

    // Summary stats
    resultFrame.gotoxy(2, y++);
    resultFrame.putmsg("Record: \1h\1g" + wins + "W\1n-\1h\1r" + losses + "L\1n  |  Risked: \1h\1r" + formatDollars(results.totalRisk) + "\1n  |  Won: \1h\1g" + formatDollars(results.totalPayout) + "\1n");

    var profitColor = results.netProfit >= 0 ? '\1h\1g' : '\1h\1r';
    var profitSign = results.netProfit >= 0 ? '+' : '';
    var profitSymbol = results.netProfit >= 0 ? ascii(24) : ascii(25);
    resultFrame.gotoxy(2, y++);
    resultFrame.putmsg("\1h\1wNet Profit: " + profitColor + profitSymbol + " " + profitSign + formatDollars(results.netProfit) + "\1n");
    y++;

    // Final message
    resultFrame.gotoxy(2, y++);
    if (results.netProfit > 0) {
        resultFrame.putmsg("\1h\1g" + ascii(1) + " NICE WIN! " + ascii(1) + "\1n");
    } else if (results.netProfit < 0) {
        resultFrame.putmsg("\1h\1r Better luck next time!\1n");
    } else {
        resultFrame.putmsg("\1h\1y You broke even!\1n");
    }

    resultFrame.gotoxy(2, 23);
    resultFrame.putmsg("\1h\1wPress any key to continue...\1n");

    resultFrame.draw();
    console.getkey();
    resultFrame.close();
}

// Export functions for use in main game
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateTeamPower: calculateTeamPower,
        calculateOdds: calculateOdds,
        getMatchupOdds: getMatchupOdds,
        formatOdds: formatOdds,
        getOddsDisplayLines: getOddsDisplayLines,
        calculateSpread: calculateSpread,
        calculateOverUnder: calculateOverUnder,
        BettingSlip: BettingSlip,
        showBettingInterface: showBettingInterface,
        showBettingResults: showBettingResults
    };
}
