#!/sbbs/exec/jsexec

// Reproduce the user's bug: nemesis children still counted in total

this.LORB = { Util: {}, Core: {}, Data: {}, Engines: {}, View: {} };
this.debugLog = function() {};
this.bbs = { node_num: 999 };

load("/sbbs/xtrn/nba_jam/lib/lorb/data/baby-ballers.js");

var BabyBallers = LORB.Data.BabyBallers;

// User's scenario: 3 babies, 2 are nemesis (one paid off), seeing $7000 total
var babies = [
    {
        nickname: "loser",
        motherId: "mama1",
        isNemesis: false,
        childSupport: {
            balance: 7000,  // Only one owing
            isPaidOff: false,
            isAbandoned: false
        }
    },
    {
        nickname: "chonk",
        motherId: "mama1",
        isNemesis: true,  // NEMESIS
        childSupport: {
            balance: 0,  // Paid off
            isPaidOff: true,
            isAbandoned: true,
            abandonedAmount: 3200
        }
    },
    {
        nickname: "goner",
        motherId: "mama1",
        isNemesis: true,  // NEMESIS
        childSupport: {
            balance: 3800,  // BUG: Still has balance but is nemesis!
            isPaidOff: false,
            isAbandoned: true,
            abandonedAmount: 3800
        }
    }
];

writeln("\n=== Reproducing User's Bug ===\n");
writeln("3 babies: loser ($7000), chonk (paid nemesis), goner (nemesis with $3800 balance)");
writeln("");

// Test updateParentingStats
var ctx = { babyBallers: babies, parentingStats: {} };
BabyBallers.updateParentingStats(ctx);

writeln("updateParentingStats result:");
writeln("  totalSupportOwed: $" + ctx.parentingStats.totalSupportOwed);
writeln("  Expected: $7000 (only loser)");
writeln("  Bug if: $10800 (includes goner's $3800)");
writeln("");

// Test display calculation (crib.js pattern)
var totalOwed = 0;
for (var i = 0; i < babies.length; i++) {
    var baby = babies[i];
    var cs = baby.childSupport;
    
    if (cs && cs.isAbandoned) {
        writeln("Baby '" + baby.nickname + "': SKIPPED (abandoned)");
        continue;
    }
    
    if (cs && !cs.isPaidOff) {
        writeln("Baby '" + baby.nickname + "': ADDING $" + cs.balance);
        totalOwed += cs.balance;
    } else {
        writeln("Baby '" + baby.nickname + "': SKIPPED (paid off)");
    }
}

writeln("");
writeln("Display calculation result: $" + totalOwed);
writeln("Expected: $7000");
writeln("Bug if: $10800");

if (ctx.parentingStats.totalSupportOwed === 7000 && totalOwed === 7000) {
    writeln("\n✓ CORRECT - Bug NOT reproduced");
    exit(0);
} else {
    writeln("\n✗ BUG REPRODUCED!");
    exit(1);
}
