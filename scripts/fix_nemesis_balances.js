#!/sbbs/exec/jsexec

// Fix nemesis/abandoned children child support balances
load("json-db.js");

var DB_FILE = "/sbbs/xtrn/nba_jam/data/lorb.json";
var DB_SCOPE = "lorb";

print("=== Fixing Nemesis/Abandoned Child Support Balances ===\n");

// Load database
var db = new JSONdb(DB_FILE, DB_SCOPE);
db.load();

if (!db.masterData || !db.masterData.data || !db.masterData.data.players) {
    print("ERROR: No player data found\n");
    exit(1);
}

var players = db.masterData.data.players;
var totalFixed = 0;
var playersAffected = 0;

// Iterate through all players
for (var playerId in players) {
    if (!players.hasOwnProperty(playerId)) continue;
    
    var player = players[playerId];
    if (!player.babyBallers || player.babyBallers.length === 0) continue;
    
    var playerFixCount = 0;
    
    // Fix each baby
    for (var i = 0; i < player.babyBallers.length; i++) {
        var baby = player.babyBallers[i];
        
        // Check if nemesis or abandoned
        if (baby.isNemesis || baby.parentingMode === "abandon") {
            // Check if has non-zero balance
            if (baby.childSupport && baby.childSupport.balance > 0) {
                print("  Fixing: " + baby.name + " (nemesis=" + (baby.isNemesis ? "Y" : "N") + 
                      ", mode=" + (baby.parentingMode || "nurture") + 
                      ", balance=$" + baby.childSupport.balance + ")\n");
                
                // Mark as abandoned
                baby.childSupport.isAbandoned = true;
                baby.childSupport.abandonedAmount = baby.childSupport.totalOwed;
                baby.childSupport.balance = 0;
                baby.childSupport.isPaidOff = false;
                
                playerFixCount++;
                totalFixed++;
            }
        }
    }
    
    // Recalculate baby mama balances and parenting stats for this player
    if (playerFixCount > 0) {
        playersAffected++;
        print("Player: " + (player.name || player.nickname || playerId) + " - Fixed " + playerFixCount + " children\n");
        
        if (player.babyMamas) {
            for (var j = 0; j < player.babyMamas.length; j++) {
                var mama = player.babyMamas[j];
                var newBalance = 0;
                
                // Recalculate balance from non-abandoned children only
                for (var k = 0; k < player.babyBallers.length; k++) {
                    var b = player.babyBallers[k];
                    if ((b.motherId === mama.id || b.motherName === mama.name) && 
                        (!b.childSupport.isAbandoned)) {
                        newBalance += b.childSupport.balance || 0;
                    }
                }
                
                if (mama.childSupport) {
                    var oldBalance = mama.childSupport.balance;
                    mama.childSupport.balance = newBalance;
                    if (oldBalance !== newBalance) {
                        print("    Updated " + mama.name + " balance: $" + oldBalance + " -> $" + newBalance + "\n");
                    }
                }
            }
        }
        
        // Recalculate player's total support owed (excludes abandoned children)
        if (player.parentingStats) {
            var oldTotalOwed = player.parentingStats.totalSupportOwed || 0;
            var newTotalOwed = 0;
            
            for (var m = 0; m < player.babyBallers.length; m++) {
                var baby = player.babyBallers[m];
                if (!baby.childSupport.isAbandoned) {
                    newTotalOwed += baby.childSupport.balance || 0;
                }
            }
            
            player.parentingStats.totalSupportOwed = newTotalOwed;
            if (oldTotalOwed !== newTotalOwed) {
                print("    Updated total support owed: $" + oldTotalOwed + " -> $" + newTotalOwed + "\n");
            }
        }
        
        print("\n");
    }
}

// Save changes
if (totalFixed > 0) {
    db.settings.UPDATES = true;
    db.save();
    print("=== COMPLETE ===");
    print("Fixed " + totalFixed + " children across " + playersAffected + " players\n");
    print("Database saved: " + DB_FILE + "\n");
} else {
    print("No fixes needed - all nemesis/abandoned children already have $0 balance\n");
}

exit(0);
