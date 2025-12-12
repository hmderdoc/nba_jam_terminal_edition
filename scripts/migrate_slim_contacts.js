#!/sbbs/exec/jsexec
/**
 * migrate_slim_contacts.js - Data Migration Script
 * 
 * Converts existing lorb.json contacts from full storage to minimal storage format.
 * 
 * Before: { id, type, name, team, status, signCost, cutPercent, tier, stats, skin, jersey, shortNick, dateAcquired, rivals }
 * After:  { id, type, status, dateAcquired } (for NBA players only)
 * 
 * Legends (isStarter: true) are preserved as-is since they're not in rosters.ini.
 * 
 * Usage:
 *   /sbbs/exec/jsexec scripts/migrate_slim_contacts.js
 *   /sbbs/exec/jsexec scripts/migrate_slim_contacts.js --dry-run
 */

var DRY_RUN = argv.indexOf("--dry-run") !== -1;

// Get the base directory (parent of scripts/)
var BASE_DIR = js.exec_dir.replace(/scripts\/?$/, "");
var LORB_JSON_PATH = BASE_DIR + "data/lorb.json";
var BACKUP_PATH = BASE_DIR + "data/lorb.json.backup-slim-contacts-" + Date.now();

print("");
print("=== LORB Contact Slim Migration ===");
print("");
if (DRY_RUN) print("*** DRY RUN MODE - No changes will be saved ***\n");

// Read lorb.json
var file = new File(LORB_JSON_PATH);
if (!file.open("r")) {
    print("ERROR: Could not open " + LORB_JSON_PATH);
    exit(1);
}
var contents = file.read();
file.close();

var data;
try {
    data = JSON.parse(contents);
} catch (e) {
    print("ERROR: Could not parse lorb.json: " + e);
    exit(1);
}

if (!data.players) {
    print("ERROR: No players section found in lorb.json");
    exit(1);
}

// Stats tracking
var totalPlayers = 0;
var totalContacts = 0;
var migratedContacts = 0;
var legendsPreserved = 0;
var bytesSaved = 0;

// Process each player
for (var playerId in data.players) {
    if (!data.players.hasOwnProperty(playerId)) continue;
    var player = data.players[playerId];
    totalPlayers++;
    
    if (!player.contacts || player.contacts.length === 0) continue;
    
    var newContacts = [];
    
    for (var i = 0; i < player.contacts.length; i++) {
        var contact = player.contacts[i];
        totalContacts++;
        
        var originalSize = JSON.stringify(contact).length;
        
        // Preserve legends (starter companions) - they need full data
        if (contact.isStarter || contact.type === "legend") {
            newContacts.push(contact);
            legendsPreserved++;
            continue;
        }
        
        // Slim down NBA contacts to minimal format
        var slimContact = {
            id: contact.id,
            type: contact.type || "nba",
            status: contact.status || "contact",
            dateAcquired: contact.dateAcquired || Date.now()
        };
        
        var newSize = JSON.stringify(slimContact).length;
        bytesSaved += (originalSize - newSize);
        
        newContacts.push(slimContact);
        migratedContacts++;
        
        if (DRY_RUN) {
            print("  [" + playerId + "] Would slim: " + contact.name + " (" + contact.id + ")");
            print("       " + originalSize + " bytes -> " + newSize + " bytes (saved " + (originalSize - newSize) + ")");
        }
    }
    
    player.contacts = newContacts;
}

print("");
print("Summary:");
print("  Total players scanned:  " + totalPlayers);
print("  Total contacts:         " + totalContacts);
print("  Contacts migrated:      " + migratedContacts);
print("  Legends preserved:      " + legendsPreserved);
print("  Bytes saved:            " + bytesSaved + " (~" + Math.round(bytesSaved / 1024) + " KB)");
print("");

if (DRY_RUN) {
    print("*** DRY RUN - No changes saved ***");
    print("Run without --dry-run to apply migration.");
} else {
    // Create backup
    var backupFile = new File(BACKUP_PATH);
    if (backupFile.open("w")) {
        backupFile.write(contents);
        backupFile.close();
        print("Backup saved to: " + BACKUP_PATH);
    } else {
        print("WARNING: Could not create backup file");
    }
    
    // Write updated data
    var outFile = new File(LORB_JSON_PATH);
    if (outFile.open("w")) {
        outFile.write(JSON.stringify(data, null, "\t"));
        outFile.close();
        print("Migration complete! lorb.json updated.");
    } else {
        print("ERROR: Could not write to lorb.json");
        exit(1);
    }
}

print("");
