/*  NBA Jam mock engine for LoRB -- deterministic, SpiderMonkey-safe
    Exposes: NBAJam.runLorbBattle(rosters, opts)
    Returns: { winnerTeam, loserTeam, score:{home,away}, endedInOT, mvpPlayerId, boxScore:[...], flags:{}, meta:{} }
*/
var NBAJam = (function () {

    function runLorbBattle(rosters, opts) {
        var rng = makeRng(opts && opts.seed);
        var state = initGameState(rosters, opts, rng);

        var max = Math.max(1, (opts && opts.possessions) || 40);
        var p;
        for (p = 0; p < max; p++) simulatePossession(state, rng);

        finalize(state);

        return {
            winnerTeam: state.score.home > state.score.away ? state.home.team : state.away.team,
            loserTeam: state.score.home > state.score.away ? state.away.team : state.home.team,
            score: { home: state.score.home, away: state.score.away },
            endedInOT: state.endedInOT === true,
            mvpPlayerId: state.mvpId,
            boxScore: state.boxScore,
            flags: state.flags,
            meta: { seed: rng.seed, pace: state.pace, possessions: p }
        };
    }

    // ---------------- helpers ----------------
    function makeRng(seed) {
        var s = (typeof seed === 'number' ? seed : (Date.now ? Date.now() : 123456789)) & 0x7fffffff;
        function next() { s = (1103515245 * s + 12345) & 0x7fffffff; return s / 0x7fffffff; }
        return { next: next, seed: s };
    }

    function rating(player) {
        return (player.speed + player["3point"] + player.power + player.steal + player.block + player.dunk) / 6;
    }

    function teamOverall(players) {
        var i, sum = 0;
        for (i = 0; i < players.length; i++) sum += rating(players[i]);
        return sum / Math.max(1, players.length);
    }

    function pickShooter(side, rng) {
        var i, total = 0, acc = 0;
        for (i = 0; i < side.players.length; i++) total += rating(side.players[i]);
        var r = rng.next() * total;
        for (i = 0; i < side.players.length; i++) {
            acc += rating(side.players[i]);
            if (r <= acc) return side.players[i];
        }
        return side.players[0];
    }

    function shotAttempt(shooter, rng) {
        var takeThree = (rng.next() < (0.25 + (shooter["3point"] - 5) * 0.04));
        var acc = (takeThree ? shooter["3point"] : shooter.dunk + shooter.speed / 2);
        var base = 0.45 + (acc - 5) * 0.03;
        if (takeThree) base -= 0.10;
        if (base < 0.05) base = 0.05;
        if (base > 0.85) base = 0.85;
        var made = rng.next() < base;
        return { three: takeThree, made: made, wasDunk: (!takeThree && rng.next() < (shooter.dunk * 0.06)) };
    }

    function reboundSide(defTeamOverall, offTeamOverall, rng) {
        var pOff = 0.25 + (offTeamOverall - defTeamOverall) * 0.02;
        if (pOff < 0.1) pOff = 0.1;
        if (pOff > 0.5) pOff = 0.5;
        return rng.next() < pOff ? "OFF" : "DEF";
    }

    function ensureBox(box, pid, team) {
        if (!box[pid]) box[pid] = { playerId: pid, team: team, mins: 0, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, dunks: 0 };
        return box[pid];
    }

    function initGameState(rosters, opts, rng) {
        var home = rosters.home, away = rosters.away;
        return {
            home: home, away: away,
            score: { home: 0, away: 0 },
            pace: (opts && opts.pace) || 1.0,
            endedInOT: false,
            flags: {},
            boxMap: {},
            boxScore: [],
            mvpId: null,
            rng: rng
        };
    }

    function addScore(state, side, shooter, outcome) {
        var pts = outcome.made ? (outcome.three ? 3 : 2) : 0;
        if (side === "home") state.score.home += pts; else state.score.away += pts;
        var b = ensureBox(state.boxMap, shooter.player_id, shooter.player_team);
        b.fga += 1;
        if (outcome.three) b.tpa += 1;
        if (outcome.made) {
            b.fgm += 1; b.pts += pts;
            if (outcome.wasDunk) b.dunks += 1;
        }
    }

    function creditRebound(state, team, rng) {
        var p = team.players[(rng.next() * team.players.length) | 0];
        ensureBox(state.boxMap, p.player_id, p.player_team).reb += 1;
    }

    function simulatePossession(state, rng) {
        var offense = (rng.next() < 0.5) ? "home" : "away";
        var offTeam = offense === "home" ? state.home : state.away;
        var defTeam = offense === "home" ? state.away : state.home;

        var shooter = pickShooter(offTeam, rng);
        var outcome = shotAttempt(shooter, rng);
        addScore(state, offense, shooter, outcome);

        if (!outcome.made) {
            var who = reboundSide(teamOverall(offTeam.players), teamOverall(defTeam.players), rng);
            creditRebound(state, who === "OFF" ? offTeam : defTeam, rng);
        }

        // token peripheral stats
        if (rng.next() < 0.07) ensureBox(state.boxMap, shooter.player_id, shooter.player_team).tov += 1;
        if (rng.next() < 0.10) ensureBox(state.boxMap, shooter.player_id, shooter.player_team).pf += 1;
        if (rng.next() < 0.04) ensureBox(state.boxMap, shooter.player_id, shooter.player_team).ast += 1;
        if (rng.next() < 0.03) ensureBox(state.boxMap, shooter.player_id, shooter.player_team).stl += 1;
        if (rng.next() < 0.03) ensureBox(state.boxMap, shooter.player_id, shooter.player_team).blk += 1;
    }

    function finalize(state) {
        var k;
        for (k in state.boxMap) if (state.boxMap.hasOwnProperty(k)) state.boxScore.push(state.boxMap[k]);
        // MVP heuristic
        var i, s, best = null, bestScore = -1;
        for (i = 0; i < state.boxScore.length; i++) {
            s = state.boxScore[i];
            var val = s.pts + 0.5 * s.reb + 0.7 * s.ast + 0.8 * s.stl + 0.8 * s.blk - 0.5 * s.tov;
            if (val > bestScore) { bestScore = val; best = s; }
        }
        state.mvpId = best ? best.playerId : null;
    }

    return { runLorbBattle: runLorbBattle };
}());