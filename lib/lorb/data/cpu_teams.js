// xtrn/lorb/data/cpu_teams.js
(function () {
    LORB.Data = LORB.Data || {};
    LORB.Data.CPU_TEAMS = {
        CPU_HUSTLER: {
            team: "Alley Kings",
            players: [
                { player_id: "hk_ace", player_name: "Ace", player_team: "Alley Kings", position: "G", speed: 7, "3point": 6, power: 6, steal: 6, block: 3, dunk: 7 }
            ]
        },
        DREAM_GUARDS: {
            team: "Specters",
            players: [
                { player_id: "sp_ghost1", player_name: "Ghost 1", player_team: "Specters", position: "G", speed: 8, "3point": 7, power: 5, steal: 7, block: 4, dunk: 7 },
                { player_id: "sp_ghost2", player_name: "Ghost 2", player_team: "Specters", position: "G", speed: 8, "3point": 8, power: 4, steal: 6, block: 3, dunk: 6 }
            ]
        }
    };

    // expose a couple of handy references used by events parser
    LORB.Data.CPU_NETTOWN = {
        team: "NETTOWN",
        players: [
            { player_id: "nt_flash", player_name: "Flash", player_team: "NETTOWN", position: "G", speed: 9, "3point": 8, power: 4, steal: 7, block: 3, dunk: 7 },
            { player_id: "nt_brick", player_name: "Brick", player_team: "NETTOWN", position: "F", speed: 5, "3point": 3, power: 9, steal: 3, block: 9, dunk: 7 }
        ]
    };
    LORB.Data.USER_ROSTER = {
        team: "RIM CITY",
        players: [
            { player_id: "rc_blaze", player_name: "Blaze", player_team: "RIM CITY", position: "G", speed: 8, "3point": 7, power: 5, steal: 6, block: 4, dunk: 9 },
            { player_id: "rc_tower", player_name: "Tower", player_team: "RIM CITY", position: "F", speed: 6, "3point": 4, power: 9, steal: 4, block: 8, dunk: 8 }
        ]
    };
})();