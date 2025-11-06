// bookie.js - NBA JAM Betting Odds Calculator
// Calculates and displays betting odds based on team ratings

// Key constants for navigation (if not already defined)
if (typeof KEY_UP === 'undefined') var KEY_UP = '\x1e';
if (typeof KEY_DOWN === 'undefined') var KEY_DOWN = '\x1f';
if (typeof KEY_LEFT === 'undefined') var KEY_LEFT = '\x1d';
if (typeof KEY_RIGHT === 'undefined') var KEY_RIGHT = '\x1c';


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
            (attrs[0] || 0) * 1.2 +  // Speed (most important)
            (attrs[1] || 0) * 1.1 +  // 3PT shooting
            (attrs[2] || 0) * 1.0 +  // Dunk
            (attrs[3] || 0) * 0.9 +  // Power
            (attrs[4] || 0) * 0.8 +  // Steal
            (attrs[5] || 0) * 0.7;   // Block

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
        return { favorite: -110, underdog: +110 };
    }

    var powerDiff = Math.abs(favoritePower - underdogPower);
    var totalPower = favoritePower + underdogPower;
    var diffPercent = (powerDiff / totalPower) * 100;

    // Even matchup baseline
    if (diffPercent < 2) {
        return { favorite: -105, underdog: +105 };
    }

    // Scale odds based on power difference
    // More difference = higher odds spread
    var baseOdds = 110;
    var oddsIncrease = Math.floor(diffPercent * 8); // Scale factor

    var favoriteOdds = -(baseOdds + oddsIncrease);
    var underdogOdds = baseOdds + oddsIncrease;

    // Cap extreme odds
    if (favoriteOdds < -500) favoriteOdds = -500;
    if (underdogOdds > 500) underdogOdds = 500;

    return {
        favorite: favoriteOdds,
        underdog: underdogOdds
    };
}

/**
 * Get matchup odds for two teams
 * @param {Array} redPlayers - Red team player data
 * @param {Array} bluePlayers - Blue team player data
 * @returns {Object} - { redOdds: -110, blueOdds: +110, favorite: "red" }
 */
function getMatchupOdds(redPlayers, bluePlayers) {
    var redPower = calculateTeamPower(redPlayers);
    var bluePower = calculateTeamPower(bluePlayers);

    var isFavorite = redPower > bluePower;
    var odds;

    if (isFavorite) {
        odds = calculateOdds(redPower, bluePower);
        return {
            redOdds: odds.favorite,
            blueOdds: odds.underdog,
            favorite: "red",
            redPower: redPower,
            bluePower: bluePower
        };
    } else {
        odds = calculateOdds(bluePower, redPower);
        return {
            redOdds: odds.underdog,
            blueOdds: odds.favorite,
            favorite: "blue",
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
 * @param {Array} redPlayers - Red team player data
 * @param {Array} bluePlayers - Blue team player data
 * @returns {Object} - { leftLine: "RED -110", rightLine: "BLUE +110" }
 */
function getOddsDisplayLines(redPlayers, bluePlayers) {
    var matchup = getMatchupOdds(redPlayers, bluePlayers);

    // Red team is on left, blue team is on right
    var leftLine = "ODDS: " + formatOdds(matchup.redOdds);
    var rightLine = "ODDS: " + formatOdds(matchup.blueOdds);

    return {
        leftLine: leftLine,
        rightLine: rightLine,
        matchup: matchup
    };
}

/**
 * Calculate suggested point spread based on team power difference
 * @param {Array} redPlayers - Red team player data
 * @param {Array} bluePlayers - Blue team player data
 * @returns {Object} - { favorite: "red", spread: 5.5 }
 */
function calculateSpread(redPlayers, bluePlayers) {
    var redPower = calculateTeamPower(redPlayers);
    var bluePower = calculateTeamPower(bluePlayers);

    var powerDiff = Math.abs(redPower - bluePower);
    // Convert power difference to points (roughly 1 power = 1.5 points)
    var spread = Math.round(powerDiff * 1.5 * 2) / 2; // Round to nearest 0.5

    if (spread < 0.5) spread = 0.5;
    if (spread > 20) spread = 20;

    return {
        favorite: redPower > bluePower ? "red" : "blue",
        spread: spread,
        redPower: redPower,
        bluePower: bluePower
    };
}

/**
 * Calculate over/under line based on team offensive power
 * @param {Array} redPlayers - Red team player data
 * @param {Array} bluePlayers - Blue team player data
 * @returns {Number} - Total points line (e.g., 85.5)
 */
function calculateOverUnder(redPlayers, bluePlayers) {
    var redPower = calculateTeamPower(redPlayers);
    var bluePower = calculateTeamPower(bluePlayers);

    // Base total on average team power
    var avgPower = (redPower + bluePower) / 2;
    // Scale to reasonable NBA JAM score range (30-70 per team)
    var total = Math.round((30 + avgPower * 4) * 2) / 2; // Round to nearest 0.5

    if (total < 60) total = 60;
    if (total > 140) total = 140;

    return total;
}

/**
 * Betting slip to track user's bets
 */
function BettingSlip() {
    this.bets = [];
    this.startingBankroll = 1000;

    this.addBet = function(betType, selection, odds, risk) {
        this.bets.push({
            type: betType,
            selection: selection,
            odds: odds,
            risk: risk || 100,
            result: null, // Will be 'win', 'loss', or 'push' after game
            payout: 0
        });
    };

    this.getTotalRisk = function() {
        var total = 0;
        for (var i = 0; i < this.bets.length; i++) {
            total += this.bets[i].risk;
        }
        return total;
    };

    this.calculatePayout = function(odds, risk) {
        if (odds > 0) {
            // Underdog: +150 means win $150 on $100 bet
            return risk + (risk * (odds / 100));
        } else {
            // Favorite: -150 means win $100 on $150 bet
            return risk + (risk / (Math.abs(odds) / 100));
        }
    };

    this.gradeBets = function(gameResults) {
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
                        var margin = Math.abs(gameResults.redScore - gameResults.blueScore);
                        won = (margin > bet.selection.spread);
                    } else {
                        // Underdog - did they cover or win?
                        var marginUd = Math.abs(gameResults.redScore - gameResults.blueScore);
                        won = (bet.selection.team === gameResults.winner || marginUd < bet.selection.spread);
                    }
                    break;

                case 'total':
                    var total = gameResults.redScore + gameResults.blueScore;
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
    var teamColor1 = getTeamColorCode("red", matchupData);
    var teamColor2 = getTeamColorCode("blue", matchupData);

    if (bet.type === 'moneyline') {
        var teamColor = bet.selection === 'red' ? teamColor1 : teamColor2;
        var teamName = bet.selection === 'red' ? matchupData.redTeam : matchupData.blueTeam;
        return teamColor + teamName + " " + formatOdds(bet.odds) + "\1n";
    } else if (bet.type === 'spread') {
        var tColor = bet.selection.team === 'red' ? teamColor1 : teamColor2;
        var tName = bet.selection.team === 'red' ? matchupData.redTeam : matchupData.blueTeam;
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
 * Show betting interface and collect bets
 * @param {Object} matchupData - Contains team info, players, odds, sprites
 * @returns {BettingSlip} - Completed betting slip with user's bets
 */
function showBettingInterface(matchupData) {
    if (typeof console === "undefined") return null;

    var slip = new BettingSlip();
    var odds = matchupData.odds;
    var spread = matchupData.spread;
    var total = matchupData.total;

    var currentScreen = 'menu';
    var betAmount = 100;

    var redColor = getTeamColorCode("red", matchupData);
    var blueColor = getTeamColorCode("blue", matchupData);

    while (true) {
        console.clear();
        console.putmsg("\1h\1y" + ascii(201));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(187) + "\1n\r\n");

        console.putmsg("\1h\1y" + ascii(186) + "  NBA JAM SPORTS BOOK");
        for (var s = 0; s < 54; s++) console.putmsg(" ");
        console.putmsg(ascii(186) + "\1n\r\n");

        console.putmsg("\1h\1y" + ascii(200));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(188) + "\1n\r\n\r\n");

        // Bankroll display
        console.putmsg("Bankroll: \1h\1g$" + slip.startingBankroll + "\1n  |  ");
        console.putmsg("Risked: \1h\1r$" + slip.getTotalRisk() + "\1n  |  ");
        console.putmsg("Remaining: \1h\1c$" + (slip.startingBankroll - slip.getTotalRisk()) + "\1n\r\n\r\n");

        // Team matchup header with colors
        console.putmsg(redColor + matchupData.redTeam + "\1n");
        console.putmsg("  \1h\1wvs\1n  ");
        console.putmsg(blueColor + matchupData.blueTeam + "\1n\r\n\r\n");

        if (currentScreen === 'menu') {
            // Display player sprites if available
            if (matchupData.sprites && matchupData.sprites.length === 4) {
                console.putmsg("\1h\1wStarting Lineups:\1n\r\n");

                // Red team header
                console.putmsg(redColor + matchupData.redTeam.substring(0, 35) + "\1n");
                for (var sp = 0; sp < (40 - matchupData.redTeam.length); sp++) console.putmsg(" ");
                console.putmsg(blueColor + matchupData.blueTeam.substring(0, 35) + "\1n\r\n");

                // Red team player names
                var rp1Name = matchupData.redPlayers[0] ? matchupData.redPlayers[0].name.substring(0, 18) : "Player 1";
                var rp2Name = matchupData.redPlayers[1] ? matchupData.redPlayers[1].name.substring(0, 18) : "Player 2";
                var bp1Name = matchupData.bluePlayers[0] ? matchupData.bluePlayers[0].name.substring(0, 18) : "Player 1";
                var bp2Name = matchupData.bluePlayers[1] ? matchupData.bluePlayers[1].name.substring(0, 18) : "Player 2";

                console.putmsg(redColor + rp1Name + "\1n");
                for (var s1 = 0; s1 < (20 - rp1Name.length); s1++) console.putmsg(" ");
                console.putmsg(redColor + rp2Name + "\1n");
                for (var s2 = 0; s2 < (20 - rp2Name.length); s2++) console.putmsg(" ");
                console.putmsg(blueColor + bp1Name + "\1n");
                for (var s3 = 0; s3 < (20 - bp1Name.length); s3++) console.putmsg(" ");
                console.putmsg(blueColor + bp2Name + "\1n\r\n");

                // Create Frame for sprite display
                var sprites = matchupData.sprites;
                var spriteFrame = new Frame(1, console.getxy().y, 78, 4, BG_BLACK);
                spriteFrame.checkbounds = false;
                spriteFrame.atcodes = false;
                spriteFrame.open();

                var spriteTeamKeys = ['red', 'red', 'blue', 'blue'];
                var xPos = 0;

                // Render each sprite into the frame
                for (var spriteIdx = 0; spriteIdx < 4; spriteIdx++) {
                    var sprite = sprites[spriteIdx];
                    if (sprite && sprite.frame) {
                        var width = (sprite.ini && sprite.ini.width) ? parseInt(sprite.ini.width) : 5;
                        var height = (sprite.ini && sprite.ini.height) ? parseInt(sprite.ini.height) : 4;

                        // Get team text attr for fallback
                        var teamKey = spriteTeamKeys[spriteIdx];
                        var teamColors = (matchupData.teamColors && matchupData.teamColors[teamKey]) || {};
                        var FG_MASK = 0x0F;
                        var teamFg = (typeof teamColors.fg === "number") ? (teamColors.fg & FG_MASK) : 7;
                        var textAttr = teamFg | BG_BLACK;

                        for (var sy = 0; sy < height; sy++) {
                            for (var sx = 0; sx < width; sx++) {
                                var cell = sprite.frame.getData(sx, sy, false);
                                if (!cell) continue;
                                var ch = cell.ch;
                                var attr = cell.attr;
                                if (!ch || ch === '\0') ch = ' ';
                                if (attr === undefined || attr === null) attr = textAttr;
                                spriteFrame.gotoxy(xPos + sx, sy);
                                spriteFrame.putmsg(ch, attr);
                            }
                        }
                        xPos += width + 2; // spacing between sprites
                    }
                }

                spriteFrame.draw();
                spriteFrame.close();
                console.putmsg("\r\n");
            }

            console.putmsg("\1h\1y=== BETTING OPTIONS ===\1n\r\n\r\n");

            // Moneyline
            console.putmsg("\1h\1g1\1n. \1h\1wMONEYLINE\1n - Pick the winner\r\n");
            var favoriteML = odds.redOdds < odds.blueOdds ? "red" : "blue";
            var favColorML = favoriteML === "red" ? redColor : blueColor;
            var undColorML = favoriteML === "red" ? blueColor : redColor;
            var favTeamML = favoriteML === "red" ? matchupData.redTeam : matchupData.blueTeam;
            var undTeamML = favoriteML === "red" ? matchupData.blueTeam : matchupData.redTeam;
            var favOddsML = favoriteML === "red" ? odds.redOdds : odds.blueOdds;
            var undOddsML = favoriteML === "red" ? odds.blueOdds : odds.redOdds;

            console.putmsg("   " + favColorML + favTeamML + " \1h\1y" + formatOdds(favOddsML) + " \1n\1k(FAVORITE)\1n\r\n");
            console.putmsg("   " + undColorML + undTeamML + " \1h\1g" + formatOdds(undOddsML) + " \1n\1k(UNDERDOG)\1n\r\n\r\n");

            // Spread
            console.putmsg("\1h\1g2\1n. \1h\1wPOINT SPREAD\1n - Can the favorite win by enough?\r\n");
            if (spread.favorite === "red") {
                console.putmsg("   " + redColor + matchupData.redTeam + " -" + spread.spread + "\1n \1k(must win by more than " + spread.spread + ")\1n\r\n");
                console.putmsg("   " + blueColor + matchupData.blueTeam + " +" + spread.spread + "\1n \1k(must lose by less than " + spread.spread + " or win)\1n\r\n\r\n");
            } else {
                console.putmsg("   " + blueColor + matchupData.blueTeam + " -" + spread.spread + "\1n \1k(must win by more than " + spread.spread + ")\1n\r\n");
                console.putmsg("   " + redColor + matchupData.redTeam + " +" + spread.spread + "\1n \1k(must lose by less than " + spread.spread + " or win)\1n\r\n\r\n");
            }

            // Over/Under
            console.putmsg("\1h\1g3\1n. \1h\1wOVER/UNDER\1n - Total combined score\r\n");
            console.putmsg("   \1h\1gOver " + total + "\1n \1k(both teams score more than " + total + " combined)\1n\r\n");
            console.putmsg("   \1h\1cUnder " + total + "\1n \1k(both teams score less than " + total + " combined)\1n\r\n\r\n");

            // Stat Leaders
            console.putmsg("\1h\1g4\1n. \1h\1wSTAT LEADERS\1n - Pick game leaders \1h\1y+200\1n odds\r\n\r\n");

            // Current bets display
            if (slip.bets.length > 0) {
                console.putmsg("\1h\1y" + ascii(196) + ascii(196) + " YOUR BETS (" + slip.bets.length + ") " + ascii(196));
                for (var d = 0; d < 60; d++) console.putmsg(ascii(196));
                console.putmsg("\1n\r\n");

                for (var i = 0; i < slip.bets.length; i++) {
                    var bet = slip.bets[i];
                    console.putmsg("  \1h" + (i + 1) + ".\1n ");
                    console.putmsg(formatBetDisplay(bet, matchupData));
                    console.putmsg(" - \1h\1r$" + bet.risk + "\1n\r\n");
                }
                console.putmsg("\r\n");
            }

            console.putmsg("\1h\1cD\1n. Done - Lock in bets and start game!\r\n");
            console.putmsg("\1h\1rQ\1n. Cancel and return\r\n\r\n");
            console.putmsg("Select: ");

            var key = console.getkey().toUpperCase();

            if (key === 'Q') {
                return null;
            } else if (key === 'D' && slip.bets.length > 0) {
                return slip;
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
            // Sub-screens handled here
            var subResult = handleBettingSubScreen(currentScreen, matchupData, betAmount, slip);
            if (subResult === null) {
                currentScreen = 'menu';
            } else if (subResult) {
                slip.addBet(subResult.type, subResult.selection, subResult.odds, subResult.risk);
                currentScreen = 'menu';
            }
        }
    }
}

function handleBettingSubScreen(screen, matchupData, defaultAmount, slip) {
    var redColor = getTeamColorCode("red", matchupData);
    var blueColor = getTeamColorCode("blue", matchupData);

    if (screen === 'moneyline') {
        console.clear();
        console.putmsg("\1h\1y" + ascii(201));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(187) + "\1n\r\n");
        console.putmsg("\1h\1y" + ascii(186) + "  MONEYLINE - Pick the Winner");
        for (var s = 0; s < 45; s++) console.putmsg(" ");
        console.putmsg(ascii(186) + "\1n\r\n");
        console.putmsg("\1h\1y" + ascii(200));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(188) + "\1n\r\n\r\n");

        console.putmsg("\1h\1g1\1n. " + redColor + matchupData.redTeam + "\1n " + formatOdds(matchupData.odds.redOdds) + "\r\n");
        console.putmsg("\1h\1g2\1n. " + blueColor + matchupData.blueTeam + "\1n " + formatOdds(matchupData.odds.blueOdds) + "\r\n\r\n");
        console.putmsg("\1h\1kQ\1n. Back\r\n\r\n");
        console.putmsg("Pick: ");

        var key = console.getkey();
        if (key === '1') {
            return { type: 'moneyline', selection: 'red', odds: matchupData.odds.redOdds, risk: 100 };
        } else if (key === '2') {
            return { type: 'moneyline', selection: 'blue', odds: matchupData.odds.blueOdds, risk: 100 };
        }
    } else if (screen === 'spread') {
        console.clear();
        console.putmsg("\1h\1y" + ascii(201));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(187) + "\1n\r\n");
        console.putmsg("\1h\1y" + ascii(186) + "  POINT SPREAD");
        for (var s = 0; s < 61; s++) console.putmsg(" ");
        console.putmsg(ascii(186) + "\1n\r\n");
        console.putmsg("\1h\1y" + ascii(200));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(188) + "\1n\r\n\r\n");

        var spread = matchupData.spread;
        if (spread.favorite === "red") {
            console.putmsg("\1h\1g1\1n. " + redColor + matchupData.redTeam + " -" + spread.spread + "\1n (-110)\r\n");
            console.putmsg("   \1k(must win by more than " + spread.spread + " points)\1n\r\n\r\n");
            console.putmsg("\1h\1g2\1n. " + blueColor + matchupData.blueTeam + " +" + spread.spread + "\1n (-110)\r\n");
            console.putmsg("   \1k(must lose by less than " + spread.spread + " or win)\1n\r\n\r\n");
        } else {
            console.putmsg("\1h\1g1\1n. " + blueColor + matchupData.blueTeam + " -" + spread.spread + "\1n (-110)\r\n");
            console.putmsg("   \1k(must win by more than " + spread.spread + " points)\1n\r\n\r\n");
            console.putmsg("\1h\1g2\1n. " + redColor + matchupData.redTeam + " +" + spread.spread + "\1n (-110)\r\n");
            console.putmsg("   \1k(must lose by less than " + spread.spread + " or win)\1n\r\n\r\n");
        }
        console.putmsg("\1h\1kQ\1n. Back\r\n\r\n");
        console.putmsg("Pick: ");

        var keySpread = console.getkey();
        if (keySpread === '1') {
            var team1 = spread.favorite === "red" ? "red" : "blue";
            return { type: 'spread', selection: { team: team1, spread: spread.spread }, odds: -110, risk: 100 };
        } else if (keySpread === '2') {
            var team2 = spread.favorite === "red" ? "blue" : "red";
            return { type: 'spread', selection: { team: team2, spread: spread.spread }, odds: -110, risk: 100 };
        }
    } else if (screen === 'total') {
        console.clear();
        console.putmsg("\1h\1y" + ascii(201));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(187) + "\1n\r\n");
        console.putmsg("\1h\1y" + ascii(186) + "  OVER/UNDER - Total Points");
        for (var s = 0; s < 47; s++) console.putmsg(" ");
        console.putmsg(ascii(186) + "\1n\r\n");
        console.putmsg("\1h\1y" + ascii(200));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(188) + "\1n\r\n\r\n");

        console.putmsg("\1h\1g1\1n. \1h\1gOver " + matchupData.total + "\1n (-110)\r\n");
        console.putmsg("   \1k(both teams score MORE than " + matchupData.total + " combined)\1n\r\n\r\n");
        console.putmsg("\1h\1g2\1n. \1h\1cUnder " + matchupData.total + "\1n (-110)\r\n");
        console.putmsg("   \1k(both teams score LESS than " + matchupData.total + " combined)\1n\r\n\r\n");
        console.putmsg("\1h\1kQ\1n. Back\r\n\r\n");
        console.putmsg("Pick: ");

        var keyTotal = console.getkey();
        if (keyTotal === '1') {
            return { type: 'total', selection: 'over', odds: matchupData.total, risk: 100 };
        } else if (keyTotal === '2') {
            return { type: 'total', selection: 'under', odds: matchupData.total, risk: 100 };
        }
    } else if (screen === 'leaders') {
        return showStatLeadersCarousel(matchupData, slip);
    }

    return null; // Go back
}

/**
 * Show stat leaders interface with carousel for player selection
 */
function showStatLeadersCarousel(matchupData, slip) {
    var statCategories = ['points', 'assists', 'rebounds', 'steals', 'blocks'];
    var statNames = ['POINTS', 'ASSISTS', 'REBOUNDS', 'STEALS', 'BLOCKS'];
    var currentStat = 0;

    var allPlayers = [];
    var playerSprites = matchupData.sprites || [];

    // Build player list
    for (var i = 0; i < matchupData.redPlayers.length; i++) {
        var rp = matchupData.redPlayers[i];
        if (rp) allPlayers.push({
            name: rp.name,
            team: 'red',
            odds: +200,
            sprite: playerSprites[i] || null
        });
    }
    for (var j = 0; j < matchupData.bluePlayers.length; j++) {
        var bp = matchupData.bluePlayers[j];
        if (bp) allPlayers.push({
            name: bp.name,
            team: 'blue',
            odds: +200,
            sprite: playerSprites[j + 2] || null
        });
    }

    var currentPlayer = 0;
    var selectedBets = {}; // Track selections per stat

    while (true) {
        console.clear();
        console.putmsg("\1h\1y" + ascii(201));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(187) + "\1n\r\n");
        console.putmsg("\1h\1y" + ascii(186) + "  STAT LEADERS - Who will lead?");
        for (var s = 0; s < 44; s++) console.putmsg(" ");
        console.putmsg(ascii(186) + "\1n\r\n");
        console.putmsg("\1h\1y" + ascii(200));
        for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
        console.putmsg(ascii(188) + "\1n\r\n\r\n");

        // Show stat categories with selection indicator
        console.putmsg("Category: ");
        for (var c = 0; c < statCategories.length; c++) {
            if (c === currentStat) {
                console.putmsg("\1h\1y[" + statNames[c] + "]\1n ");
            } else {
                console.putmsg("\1k" + statNames[c] + "\1n ");
            }
        }
        console.putmsg("\r\n\r\n");

        // Show current player with sprite
        var player = allPlayers[currentPlayer];
        var playerColor = player.team === 'red' ? getTeamColorCode("red", matchupData) : getTeamColorCode("blue", matchupData);

        // Display player sprite
        if (player.sprite && player.sprite.frame) {
            var spriteWidth = (player.sprite.ini && player.sprite.ini.width) ? parseInt(player.sprite.ini.width) : 5;
            var spriteHeight = (player.sprite.ini && player.sprite.ini.height) ? parseInt(player.sprite.ini.height) : 4;

            // Center the sprite display
            var totalWidth = 40;
            var nameAndOdds = player.name + " +200 odds";
            var padding = Math.floor((totalWidth - nameAndOdds.length) / 2);

            // Display name centered
            for (var pad = 0; pad < padding; pad++) console.putmsg(" ");
            console.putmsg(playerColor + player.name + "\1n \1h\1y+200\1n odds\r\n\r\n");

            // Create Frame for sprite display
            var spritePadding = Math.floor((totalWidth - spriteWidth) / 2);
            var spriteStartY = console.getxy().y;
            var playerFrame = new Frame(1, spriteStartY, 78, spriteHeight, BG_BLACK);
            playerFrame.checkbounds = false;
            playerFrame.atcodes = false;
            playerFrame.open();

            // Get team text attr for fallback
            var teamColors = (matchupData.teamColors && matchupData.teamColors[player.team]) || {};
            var FG_MASK = 0x0F;
            var teamFg = (typeof teamColors.fg === "number") ? (teamColors.fg & FG_MASK) : 7;
            var textAttr = teamFg | BG_BLACK;

            // Render sprite into frame
            for (var sy = 0; sy < spriteHeight; sy++) {
                for (var sx = 0; sx < spriteWidth; sx++) {
                    var cell = player.sprite.frame.getData(sx, sy, false);
                    if (!cell) continue;
                    var ch = cell.ch;
                    var attr = cell.attr;
                    if (!ch || ch === '\0') ch = ' ';
                    if (attr === undefined || attr === null) attr = textAttr;
                    playerFrame.gotoxy(spritePadding + sx, sy);
                    playerFrame.putmsg(ch, attr);
                }
            }

            playerFrame.draw();
            playerFrame.close();
            console.putmsg("\r\n");
        } else {
            console.putmsg(playerColor + player.name + "\1n \1h\1y+200\1n odds\r\n\r\n");
        }

        // Show current selections
        if (Object.keys(selectedBets).length > 0) {
            console.putmsg("\1h\1y" + ascii(196) + " Your Selections " + ascii(196));
            for (var d = 0; d < 58; d++) console.putmsg(ascii(196));
            console.putmsg("\1n\r\n");

            for (var stat in selectedBets) {
                if (selectedBets.hasOwnProperty(stat)) {
                    var sel = selectedBets[stat];
                    var selColor = sel.team === 'red' ? getTeamColorCode("red", matchupData) : getTeamColorCode("blue", matchupData);
                    console.putmsg("  " + stat.toUpperCase() + ": " + selColor + sel.name + "\1n\r\n");
                }
            }
            console.putmsg("\r\n");
        }

        console.putmsg("\1h\1g[LEFT/RIGHT]\1n Change player  |  \1h\1g[UP/DOWN]\1n Change stat\r\n");
        console.putmsg("\1h\1g[SPACE]\1n Select this player  |  \1h\1cD\1n Done adding stat bets\r\n");
        console.putmsg("\1h\1rQ\1n Cancel and go back\r\n\r\n");
        console.putmsg("Command: ");

        var key = console.getkey();
        var keyUpper = key ? key.toUpperCase() : '';

        if (keyUpper === 'Q') {
            return null; // Go back without adding
        } else if (keyUpper === 'D') {
            // Add all selected bets to slip
            var addedAny = false;
            for (var statKey in selectedBets) {
                if (selectedBets.hasOwnProperty(statKey)) {
                    var bet = selectedBets[statKey];
                    slip.addBet('leader', { stat: statKey, player: bet.name }, bet.odds, 100);
                    addedAny = true;
                }
            }
            return addedAny ? {} : null; // Return empty object to signal added bets
        } else if (key === ' ') {
            // Select current player for current stat
            selectedBets[statCategories[currentStat]] = {
                name: player.name,
                team: player.team,
                odds: player.odds
            };
        } else if (key === KEY_LEFT || keyUpper === 'A') {
            currentPlayer = (currentPlayer - 1 + allPlayers.length) % allPlayers.length;
        } else if (key === KEY_RIGHT || keyUpper === 'D') {
            currentPlayer = (currentPlayer + 1) % allPlayers.length;
        } else if (key === KEY_UP || keyUpper === 'W') {
            currentStat = (currentStat - 1 + statCategories.length) % statCategories.length;
        } else if (key === KEY_DOWN || keyUpper === 'S') {
            currentStat = (currentStat + 1) % statCategories.length;
        }
    }
}

/**
 * Show betting results after game completes
 * @param {BettingSlip} slip - The betting slip with bets
 * @param {Object} gameResults - Final game results
 */
function showBettingResults(slip, gameResults) {
    if (!slip || !gameResults) return;
    if (typeof console === "undefined") return;

    var results = slip.gradeBets(gameResults);

    console.clear();

    // Fancy header
    console.putmsg("\1h\1y" + ascii(201));
    for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
    console.putmsg(ascii(187) + "\1n\r\n");

    console.putmsg("\1h\1y" + ascii(186) + "  BETTING RESULTS");
    for (var s = 0; s < 58; s++) console.putmsg(" ");
    console.putmsg(ascii(186) + "\1n\r\n");

    console.putmsg("\1h\1y" + ascii(200));
    for (var i = 0; i < 76; i++) console.putmsg(ascii(205));
    console.putmsg(ascii(188) + "\1n\r\n\r\n");

    // Final Score with visual emphasis
    console.putmsg("\1h\1wFinal Score:\1n\r\n");
    console.putmsg("  \1h\1r" + gameResults.redTeam + ": " + gameResults.redScore + "\1n\r\n");
    console.putmsg("  \1h\1c" + gameResults.blueTeam + ": " + gameResults.blueScore + "\1n\r\n");

    // Winner announcement
    var winnerName = gameResults.winner === 'red' ? gameResults.redTeam : gameResults.blueTeam;
    var winnerColor = gameResults.winner === 'red' ? '\1h\1r' : '\1h\1c';
    console.putmsg("\r\n" + winnerColor + ascii(16) + " " + winnerName + " WINS! " + ascii(17) + "\1n\r\n\r\n");

    // Divider
    console.putmsg("\1h\1y" + ascii(196));
    for (var d = 0; d < 75; d++) console.putmsg(ascii(196));
    console.putmsg("\1n\r\n\r\n");

    // Your bets
    console.putmsg("\1h\1wYour Bets:\1n\r\n\r\n");

    var wins = 0;
    var losses = 0;

    for (var i = 0; i < slip.bets.length; i++) {
        var bet = slip.bets[i];
        var isWin = bet.result === 'win';
        var resultColor = isWin ? '\1h\1g' : '\1h\1r';
        var resultSymbol = isWin ? ascii(251) : ascii(250); // √ or ·
        var resultText = isWin ? 'WIN' : 'LOSS';

        if (isWin) wins++;
        else losses++;

        console.putmsg("  " + resultColor + resultSymbol + "\1n ");

        if (bet.type === 'moneyline') {
            var teamName = bet.selection === 'red' ? gameResults.redTeam : gameResults.blueTeam;
            console.putmsg("\1h\1wMoneyline:\1n " + teamName + " " + formatOdds(bet.odds));
        } else if (bet.type === 'spread') {
            var tName = bet.selection.team === 'red' ? gameResults.redTeam : gameResults.blueTeam;
            var sign = bet.selection.spread > 0 ? "+" : "-";
            console.putmsg("\1h\1wSpread:\1n " + tName + " " + sign + Math.abs(bet.selection.spread));
        } else if (bet.type === 'total') {
            var actualTotal = gameResults.redScore + gameResults.blueScore;
            console.putmsg("\1h\1wTotal:\1n " + bet.selection.toUpperCase() + " " + bet.odds);
            console.putmsg(" \1k(actual: " + actualTotal + ")\1n");
        } else if (bet.type === 'leader') {
            console.putmsg("\1h\1wLeader:\1n " + bet.selection.player + " (" + bet.selection.stat + ")");
        }

        console.putmsg("\r\n    Risk: \1h\1r$" + bet.risk + "\1n");

        if (isWin) {
            console.putmsg("  " + ascii(26) + " Payout: \1h\1g$" + Math.round(bet.payout) + "\1n");
            console.putmsg("  (+" + Math.round(bet.payout - bet.risk) + ")");
        } else {
            console.putmsg("  " + resultColor + resultText + "\1n");
        }

        console.putmsg("\r\n\r\n");
    }

    // Summary box
    console.putmsg("\1h\1y" + ascii(196));
    for (var d = 0; d < 75; d++) console.putmsg(ascii(196));
    console.putmsg("\1n\r\n");

    console.putmsg("  Record: \1h\1g" + wins + "W\1n - \1h\1r" + losses + "L\1n");
    console.putmsg("  |  Total Risked: \1h\1r$" + results.totalRisk + "\1n");
    console.putmsg("  |  Total Won: \1h\1g$" + Math.round(results.totalPayout) + "\1n\r\n");

    var profitColor = results.netProfit >= 0 ? '\1h\1g' : '\1h\1r';
    var profitSign = results.netProfit >= 0 ? '+' : '';
    var profitSymbol = results.netProfit >= 0 ? ascii(24) : ascii(25); // ↑ or ↓
    console.putmsg("  \1h\1wNet Profit: " + profitColor + profitSymbol + " " + profitSign + "$" + Math.round(results.netProfit) + "\1n\r\n");

    console.putmsg("\1h\1y" + ascii(196));
    for (var d = 0; d < 75; d++) console.putmsg(ascii(196));
    console.putmsg("\1n\r\n\r\n");

    // Show stat leaders
    if (gameResults.leaders) {
        console.putmsg("\1h\1wGame Leaders:\1n\r\n");
        if (gameResults.leaders.points) console.putmsg("  " + ascii(254) + " Points:   \1h\1y" + gameResults.leaders.points + "\1n\r\n");
        if (gameResults.leaders.assists) console.putmsg("  " + ascii(254) + " Assists:  \1h\1y" + gameResults.leaders.assists + "\1n\r\n");
        if (gameResults.leaders.rebounds) console.putmsg("  " + ascii(254) + " Rebounds: \1h\1y" + gameResults.leaders.rebounds + "\1n\r\n");
        if (gameResults.leaders.steals) console.putmsg("  " + ascii(254) + " Steals:   \1h\1y" + gameResults.leaders.steals + "\1n\r\n");
        if (gameResults.leaders.blocks) console.putmsg("  " + ascii(254) + " Blocks:   \1h\1y" + gameResults.leaders.blocks + "\1n\r\n");
        console.putmsg("\r\n");
    }

    if (results.netProfit > 0) {
        console.putmsg("\1h\1g" + ascii(1) + " NICE WIN! " + ascii(1) + "\1n\r\n\r\n");
    } else if (results.netProfit < 0) {
        console.putmsg("\1h\1r Better luck next time!\1n\r\n\r\n");
    } else {
        console.putmsg("\1h\1y You broke even!\1n\r\n\r\n");
    }

    console.putmsg("\1h\1wPress any key to continue...\1n\r\n");
    console.getkey();
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
