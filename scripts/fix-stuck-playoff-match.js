/**
 * Fix stuck playoff match in Season 3
 * 
 * This script:
 * 1. Sets winnerId on BYE matches that only have a winner object
 * 2. Creates the finals match if it doesn't exist
 * 3. Advances currentRound to finals
 * 
 * Run: /sbbs/exec/jsexec /sbbs/xtrn/nba_jam/scripts/fix-stuck-playoff-match.js
 */

var dataPath = '/sbbs/xtrn/nba_jam/data/lorb.json';

(function() {
    // Read the JSON file directly
    var f = new File(dataPath);
    if (!f.open('r')) {
        print('Cannot open ' + dataPath);
        return;
    }
    var contents = f.read();
    f.close();
    
    var data;
    try {
        data = JSON.parse(contents);
    } catch (e) {
        print('Error parsing JSON: ' + e);
        return;
    }
    
    if (!data.playoffBrackets) {
        print('No playoff brackets found');
        return;
    }
    
    // Find Season 3 bracket (it's an object keyed by season number)
    var season3Bracket = data.playoffBrackets['3'] || data.playoffBrackets[3];
    
    if (!season3Bracket) {
        print('Season 3 bracket not found');
        print('Available seasons: ' + Object.keys(data.playoffBrackets).join(', '));
        return;
    }
    
    print('Found Season 3 bracket');
    print('Status: ' + season3Bracket.status);
    print('Current round: ' + season3Bracket.currentRound);
    print('');
    
    // Fix all matches - ensure winnerId is set when status is bye/completed
    var semifinalWinners = {};
    
    for (var j = 0; j < season3Bracket.matches.length; j++) {
        var match = season3Bracket.matches[j];
        print('Checking match: ' + match.id + ' (round: ' + match.round + ', status: ' + match.status + ')');
        
        // For BYE matches, ensure winnerId is set from winner object
        if (match.status === 'bye' && !match.winnerId && match.winner) {
            match.winnerId = match.winner.playerId;
            match.loserId = match.loser ? match.loser.playerId : null;
            print('  -> Fixed winnerId for BYE match: ' + match.winnerId);
        }
        
        // Track semifinal winners
        if (match.round === 'semifinals' && (match.status === 'completed' || match.status === 'bye')) {
            if (match.id === 'semifinals_1') {
                semifinalWinners['1'] = {
                    id: match.winnerId || (match.winner && match.winner.playerId),
                    data: match.winner || (match.winnerId === match.player1.playerId ? match.player1 : match.player2)
                };
            } else if (match.id === 'semifinals_2') {
                semifinalWinners['2'] = {
                    id: match.winnerId || (match.winner && match.winner.playerId),
                    data: match.winner || (match.winnerId === match.player1.playerId ? match.player1 : match.player2)
                };
            }
        }
    }
    
    print('');
    print('Semifinal winners:');
    print('  Semifinal 1: ' + (semifinalWinners['1'] ? semifinalWinners['1'].data.name + ' (' + semifinalWinners['1'].id + ')' : 'not completed'));
    print('  Semifinal 2: ' + (semifinalWinners['2'] ? semifinalWinners['2'].data.name + ' (' + semifinalWinners['2'].id + ')' : 'not completed'));
    
    // Check if both semifinals are done
    if (semifinalWinners['1'] && semifinalWinners['2']) {
        print('');
        print('Both semifinals complete! Setting up finals...');
        
        // Check if finals match exists
        var finalsMatch = null;
        for (var k = 0; k < season3Bracket.matches.length; k++) {
            if (season3Bracket.matches[k].id === 'finals_1' || season3Bracket.matches[k].round === 'finals') {
                finalsMatch = season3Bracket.matches[k];
                break;
            }
        }
        
        if (!finalsMatch) {
            print('Creating finals match...');
            finalsMatch = {
                id: 'finals_1',
                round: 'finals',
                roundNumber: 2,
                matchNumber: 1,
                player1: semifinalWinners['1'].data,
                player2: semifinalWinners['2'].data,
                status: 'pending',
                winner: null,
                loser: null,
                score: null,
                resolution: null,
                createdAt: Date.now(),
                softDeadline: Date.now() + (7 * 24 * 60 * 60 * 1000),
                hardDeadline: Date.now() + (14 * 24 * 60 * 60 * 1000)
            };
            season3Bracket.matches.push(finalsMatch);
        } else {
            print('Finals match already exists, updating players...');
            finalsMatch.player1 = semifinalWinners['1'].data;
            finalsMatch.player2 = semifinalWinners['2'].data;
            finalsMatch.status = 'pending';
        }
        
        season3Bracket.currentRound = 'finals';
        
        print('Finals match:');
        print('  Player 1: ' + finalsMatch.player1.name + ' (' + finalsMatch.player1.playerId + ')');
        print('  Player 2: ' + finalsMatch.player2.name + ' (' + finalsMatch.player2.playerId + ')');
    }
    
    // Save changes
    var wf = new File(dataPath);
    if (!wf.open('w')) {
        print('Cannot open file for writing');
        return;
    }
    wf.write(JSON.stringify(data, null, '\t'));
    wf.close();
    
    print('');
    print('Changes saved successfully!');
    print('');
    print('Current bracket state:');
    print('  Status: ' + season3Bracket.status);
    print('  Current round: ' + season3Bracket.currentRound);
    print('  Number of matches: ' + season3Bracket.matches.length);
})();
