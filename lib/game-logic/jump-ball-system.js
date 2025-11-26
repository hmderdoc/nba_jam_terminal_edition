/**
 * Jump Ball System (Wave 24)
 *
 * Responsibilities:
 * - Non-blocking opening tipoff phase driven by runGameFrame
 * - Interactive human jump timing with CPU reaction windows
 * - Countdown + ball arc animation + visible tip toward a teammate
 * - Deterministic resolution (attributes + turbo + reaction + seed)
 */

function createJumpBallSystem(deps) {
    if (!deps || !deps.state || !deps.helpers || !deps.constants) {
        throw new Error("createJumpBallSystem requires state, helpers, and constants");
    }

    var stateManager = deps.state;
    var helpers = deps.helpers;
    var constants = deps.constants;
    var nowProvider = typeof deps.now === "function" ? deps.now : function () { return Date.now(); };

    var layoutConfig = constants.layout || {};
    var rulesConfig = constants.rules || {};
    var countdownStepMs = (typeof constants.countdownMs === "number") ? constants.countdownMs : 800;
    var frameIntervalMs = (typeof constants.frameIntervalMs === "number") ? constants.frameIntervalMs : 50;
    var dropFrames = (typeof constants.dropDurationFrames === "number") ? constants.dropDurationFrames : 24;
    var contestWindowFrames = (typeof constants.contestWindowFrames === "number") ? constants.contestWindowFrames : 6;

    var arcMinDurationMs = (typeof constants.arcMinDurationMs === "number") ? constants.arcMinDurationMs : 400;
    var ballArcDurationMs = dropFrames * frameIntervalMs;
    if (!ballArcDurationMs || ballArcDurationMs < arcMinDurationMs) {
        ballArcDurationMs = arcMinDurationMs;
    }
    var contestWindowMs = Math.max(frameIntervalMs, contestWindowFrames * frameIntervalMs);
    if (contestWindowMs <= 0) {
        contestWindowMs = frameIntervalMs > 0 ? frameIntervalMs : Math.max(arcMinDurationMs / 4, 100);
    }
    var ballArcHeight = (typeof layoutConfig.arcHeight === "number") ? layoutConfig.arcHeight : 6;
    var jumperLift = (typeof layoutConfig.jumperLift === "number") ? layoutConfig.jumperLift : 4;
    var handoffDurationMs = (typeof constants.handoffDurationMs === "number") ? constants.handoffDurationMs : 400;
    var cpuOffsetMaxRatio = (typeof constants.cpuOffsetMaxRatio === "number") ? constants.cpuOffsetMaxRatio : 0.6;
    var cpuOffsetEarlyRatio = (typeof constants.cpuOffsetEarlyRatio === "number") ? constants.cpuOffsetEarlyRatio : 0.3;
    var jumpAnimRatio = (typeof constants.jumpAnimationDurationRatio === "number") ? constants.jumpAnimationDurationRatio : 0.6;
    var jumpAnimMinMs = (typeof constants.jumpAnimationMinMs === "number") ? constants.jumpAnimationMinMs : 350;
    var jumpAnimMaxMs = (typeof constants.jumpAnimationMaxMs === "number") ? constants.jumpAnimationMaxMs : 700;

    var attrWeight = (typeof rulesConfig.attributeWeight === "number") ? rulesConfig.attributeWeight : 0.6;
    var turboWeight = (typeof rulesConfig.turboWeight === "number") ? rulesConfig.turboWeight : 0.3;
    var randomWeight = (typeof rulesConfig.randomWeight === "number") ? rulesConfig.randomWeight : 0.1;
    var reactionWeight = Math.max(0, 1 - (attrWeight + turboWeight + randomWeight));

    var runtime = {
        active: false,
        stage: "idle",
        stageStart: 0,
        jumpers: { teamA: null, teamB: null },
        wings: { teamA: [], teamB: [] },
        alignments: [],
        countdownIndex: -1,
        ball: {
            startTime: 0,
            duration: ballArcDurationMs,
            centerX: 0,
            centerY: 0,
            height: ballArcHeight,
            tipTargetX: 0,
            tipTargetY: 0
        },
        idealHitTime: 0,
        contestDeadline: 0,
        humanJumpAt: null,
        cpuJumpAt: null,
        cpuScheduledJump: null,
        winner: null,
        loser: null,
        seed: 0,
        handoffStart: 0,
        systems: null
    };

    function resolveGlobalHelper(name) {
        if (helpers[name]) return helpers[name];
        if (typeof globalThis !== "undefined" && typeof globalThis[name] === "function") return globalThis[name];
        if (typeof this !== "undefined" && typeof this[name] === "function") return this[name];
        return null;
    }

    var announceFn = resolveGlobalHelper("announce");
    var announceEventFn = resolveGlobalHelper("announceEvent");
    var ensureBallFrameFn = resolveGlobalHelper("ensureBallFrame");
    var moveBallFrameFn = resolveGlobalHelper("moveBallFrameTo");
    var drawCourtFn = resolveGlobalHelper("drawCourt");
    var drawScoreFn = resolveGlobalHelper("drawScore");
    var setPhaseFn = helpers.setPhase || (typeof setPhase === "function" ? setPhase : null);

    function getRoster() {
        if (typeof helpers.getPlayers === "function") return helpers.getPlayers();
        return null;
    }

    function getTeamSprites(teamKey) {
        var roster = getRoster();
        if (!roster) return [];
        if (teamKey === "teamA") {
            return [roster.teamAPlayer1, roster.teamAPlayer2].filter(Boolean);
        }
        if (teamKey === "teamB") {
            return [roster.teamBPlayer1, roster.teamBPlayer2].filter(Boolean);
        }
        return [];
    }

    function normalizeAttribute(value) {
        var attr = (typeof value === "number") ? value : 5;
        if (attr < 0) attr = 0;
        if (attr > 10) attr = 10;
        return attr / 10;
    }

    function normalizeTurbo(value) {
        var turbo = (typeof value === "number") ? value : MAX_TURBO;
        if (turbo < 0) turbo = 0;
        if (turbo > MAX_TURBO) turbo = MAX_TURBO;
        return turbo / MAX_TURBO;
    }

    function createSeedState(seed) {
        var initial = (typeof seed === "number" && seed > 0) ? seed : 1;
        return { value: initial };
    }

    function advanceSeed(seedState) {
        var current = seedState.value;
        if (current <= 0) current = 1;
        var next = (current * 48271) % 2147483647;
        seedState.value = next;
        return next;
    }

    function selectPrimaryJumper(teamKey) {
        var sprites = getTeamSprites(teamKey);
        if (!sprites.length) return null;
        var best = null;
        var bestScore = -1;
        var attrIndex = (typeof rulesConfig.attributeIndex === "number") ? rulesConfig.attributeIndex : 5;

        for (var i = 0; i < sprites.length; i++) {
            var sprite = sprites[i];
            if (!sprite || !sprite.playerData) continue;
            var playerData = sprite.playerData;
            var attrNorm = normalizeAttribute((playerData.attributes || [])[attrIndex]);
            var turboNorm = normalizeTurbo(playerData.turbo);
            var composite = (attrNorm * attrWeight) + (turboNorm * turboWeight);
            if (composite > bestScore) {
                bestScore = composite;
                best = {
                    sprite: sprite,
                    team: teamKey,
                    attrNorm: attrNorm,
                    turboNorm: turboNorm,
                    baseX: sprite.x,
                    baseY: sprite.y,
                    jumpAt: null
                };
            }
        }
        return best;
    }

    function captureWingSprites() {
        runtime.wings.teamA = [];
        runtime.wings.teamB = [];
        var teamASprites = getTeamSprites("teamA");
        var teamBSprites = getTeamSprites("teamB");

        for (var i = 0; i < teamASprites.length; i++) {
            if (runtime.jumpers.teamA && teamASprites[i] === runtime.jumpers.teamA.sprite) continue;
            if (teamASprites[i]) runtime.wings.teamA.push(teamASprites[i]);
        }
        for (var j = 0; j < teamBSprites.length; j++) {
            if (runtime.jumpers.teamB && teamBSprites[j] === runtime.jumpers.teamB.sprite) continue;
            if (teamBSprites[j]) runtime.wings.teamB.push(teamBSprites[j]);
        }
    }

    function setSpritePosition(sprite, x, y, facing) {
        if (!sprite || typeof sprite.moveTo !== "function") return;
        sprite.forcePos = true;
        sprite.moveTo(Math.round(x), Math.round(y));
        sprite.forcePos = false;
        if (facing && typeof sprite.turnTo === "function") {
            sprite.turnTo(facing);
        }
    }

    function alignSprites() {
        var centerX = (typeof layoutConfig.centerX === "number") ? layoutConfig.centerX : COURT_MID_X;
        var centerY = (typeof layoutConfig.centerY === "number") ? layoutConfig.centerY : BASKET_LEFT_Y;
        var offsetX = (typeof layoutConfig.playerOffsetX === "number") ? layoutConfig.playerOffsetX : 3;
        var offsetY = (typeof layoutConfig.playerOffsetY === "number") ? layoutConfig.playerOffsetY : 0;
        var wingOffsetX = (typeof layoutConfig.wingOffsetX === "number") ? layoutConfig.wingOffsetX : 9;
        var wingOffsetY = (typeof layoutConfig.wingOffsetY === "number") ? layoutConfig.wingOffsetY : 4;

        runtime.alignments = [];

        if (runtime.jumpers.teamA && runtime.jumpers.teamA.sprite) {
            runtime.jumpers.teamA.baseX = centerX - offsetX;
            runtime.jumpers.teamA.baseY = centerY + offsetY;
            runtime.jumpers.teamA.jumpAt = null;
            runtime.alignments.push({ sprite: runtime.jumpers.teamA.sprite, baseX: runtime.jumpers.teamA.baseX, baseY: runtime.jumpers.teamA.baseY });
            setSpritePosition(runtime.jumpers.teamA.sprite, runtime.jumpers.teamA.baseX, runtime.jumpers.teamA.baseY, "e");
        }
        if (runtime.jumpers.teamB && runtime.jumpers.teamB.sprite) {
            runtime.jumpers.teamB.baseX = centerX + offsetX;
            runtime.jumpers.teamB.baseY = centerY + offsetY;
            runtime.jumpers.teamB.jumpAt = null;
            runtime.alignments.push({ sprite: runtime.jumpers.teamB.sprite, baseX: runtime.jumpers.teamB.baseX, baseY: runtime.jumpers.teamB.baseY });
            setSpritePosition(runtime.jumpers.teamB.sprite, runtime.jumpers.teamB.baseX, runtime.jumpers.teamB.baseY, "w");
        }

        captureWingSprites();

        for (var i = 0; i < runtime.wings.teamA.length; i++) {
            var wing = runtime.wings.teamA[i];
            if (!wing) continue;
            var yOffset = (i === 0) ? -wingOffsetY : wingOffsetY;
            runtime.alignments.push({ sprite: wing, baseX: centerX - wingOffsetX, baseY: centerY + yOffset });
            setSpritePosition(wing, centerX - wingOffsetX, centerY + yOffset, "e");
        }
        for (var j = 0; j < runtime.wings.teamB.length; j++) {
            var wingB = runtime.wings.teamB[j];
            if (!wingB) continue;
            var yOffsetB = (j === 0) ? -wingOffsetY : wingOffsetY;
            runtime.alignments.push({ sprite: wingB, baseX: centerX + wingOffsetX, baseY: centerY + yOffsetB });
            setSpritePosition(wingB, centerX + wingOffsetX, centerY + yOffsetB, "w");
        }

        stateManager.set("ballCarrier", null, "jump_ball_align");
        stateManager.set("currentTeam", null, "jump_ball_align");
        stateManager.set("inbounding", false, "jump_ball_align");
        stateManager.set("courtNeedsRedraw", true, "jump_ball_align");
        if (drawCourtFn) drawCourtFn(runtime.systems || null);
        if (drawScoreFn) drawScoreFn(runtime.systems || null);

        runtime.ball.centerX = centerX;
        runtime.ball.centerY = centerY;
    }

    function updateJumpBallPhaseState(status) {
        var phaseState = stateManager.get("jumpBallPhase") || {};
        phaseState.status = status;
        phaseState.startTime = runtime.stageStart;
        phaseState.countdownIndex = runtime.countdownIndex;
        phaseState.humanJumpAt = runtime.humanJumpAt;
        phaseState.cpuJumpAt = runtime.cpuJumpAt;
        phaseState.winnerTeam = runtime.winner ? runtime.winner.team : null;
        stateManager.set("jumpBallPhase", phaseState, "jump_ball_update");
    }

    function ensureBallFrameAt(x, y) {
        var fn = helpers.ensureBallFrame || ensureBallFrameFn;
        if (fn) fn(Math.round(x), Math.round(y));
    }

    function moveBallFrameTo(x, y) {
        var fn = helpers.moveBallFrameTo || moveBallFrameFn;
        if (fn) fn(Math.round(x), Math.round(y));
    }

    function emitCountdown(now, systems) {
        var elapsed = now - runtime.stageStart;
        var index = Math.floor(elapsed / countdownStepMs);
        if (index === runtime.countdownIndex) return;
        runtime.countdownIndex = index;

        var message;
        if (index === 0) message = "Jump Ball in 3...";
        else if (index === 1) message = "Jump Ball in 2...";
        else if (index === 2) message = "Jump Ball in 1...";
        else if (index >= 3) message = "JUMP!";

        if (message && announceFn) {
            announceFn(message, index >= 3 ? WHITE : YELLOW, systems);
        }

        if (index >= 3) {
            transitionToStage("ball_toss", now, systems);
        }
    }

    function scheduleCpuJump(now) {
        var baseTime = runtime.ball.startTime + runtime.ball.duration / 2;
        var cpuSprite = runtime.jumpers.teamB ? runtime.jumpers.teamB.sprite : null;
        var cpuAttr = runtime.jumpers.teamB ? runtime.jumpers.teamB.attrNorm : 0.5;
        var cpuTurbo = runtime.jumpers.teamB ? runtime.jumpers.teamB.turboNorm : 0.5;
        var totalSkillWeight = attrWeight + turboWeight;
        var attrShare = totalSkillWeight > 0 ? (attrWeight / totalSkillWeight) : 0.5;
        var turboShare = totalSkillWeight > 0 ? (turboWeight / totalSkillWeight) : 0.5;
        var reactionSkill = (cpuAttr * attrShare) + (cpuTurbo * turboShare);
        var maxOffset = contestWindowMs * cpuOffsetMaxRatio;
        if (maxOffset < 0) maxOffset = 0;
        var advantage = (1 - reactionSkill) * maxOffset;
        var earlyWindow = contestWindowMs * cpuOffsetEarlyRatio;
        var minOffset = -Math.min(maxOffset * reactionSkill, earlyWindow);
        var seedState = createSeedState(runtime.seed + 99);
        var roll = advanceSeed(seedState) / 2147483647;
        var offset = minOffset + (advantage - minOffset) * roll;
        runtime.cpuScheduledJump = baseTime + offset;
        if (cpuSprite && cpuSprite.playerData) {
            cpuSprite.playerData.jumpBallScheduled = runtime.cpuScheduledJump;
        }
    }

    function animateJump(spriteData, now) {
        if (!spriteData || !spriteData.sprite) return;
        if (!spriteData.jumpAt) return;
        var elapsed = now - spriteData.jumpAt;
        if (elapsed < 0) elapsed = 0;
        var total = Math.max(jumpAnimMinMs, Math.min(jumpAnimMaxMs, runtime.ball.duration * jumpAnimRatio));
        if (elapsed >= total) {
            spriteData.sprite.moveTo(spriteData.baseX, spriteData.baseY);
            spriteData.jumpAt = null;
            return;
        }
        var phase = Math.sin((elapsed / total) * Math.PI);
        var lift = Math.round(phase * jumperLift);
        spriteData.sprite.moveTo(spriteData.baseX, spriteData.baseY - lift);
    }

    function updateBallArc(now) {
        var elapsed = now - runtime.ball.startTime;
        if (elapsed < 0) elapsed = 0;
        if (elapsed > runtime.ball.duration) elapsed = runtime.ball.duration;
        var progress = elapsed / runtime.ball.duration;
        var height = Math.sin(progress * Math.PI) * runtime.ball.height;
        var y = runtime.ball.centerY - height;
        ensureBallFrameAt(runtime.ball.centerX, y);
        moveBallFrameTo(runtime.ball.centerX, y);
        stateManager.set("ballX", runtime.ball.centerX, "jump_ball_arc");
        stateManager.set("ballY", Math.round(y), "jump_ball_arc");
    }

    function computeReactionScore(reactionTime, idealTime) {
        if (reactionTime === null) return 0;
        var delta = Math.abs(reactionTime - idealTime);
        if (delta >= contestWindowMs) return 0;
        return Math.max(0, (contestWindowMs - delta) / contestWindowMs);
    }

    function calculateContestScore(spriteWrapper, reactionTime, seedState) {
        if (!spriteWrapper || !spriteWrapper.sprite || !spriteWrapper.sprite.playerData) {
            return {
                total: 0,
                attr: 0,
                turbo: 0,
                random: 0,
                reaction: 0
            };
        }

        var sprite = spriteWrapper.sprite;
        var playerData = sprite.playerData;
        var attrIndex = (typeof rulesConfig.attributeIndex === "number") ? rulesConfig.attributeIndex : 5;
        var attrNorm = normalizeAttribute((playerData.attributes || [])[attrIndex]);
        var turboNorm = normalizeTurbo(playerData.turbo);
        var randomMin = (typeof rulesConfig.randomMin === "number") ? rulesConfig.randomMin : 0.1;
        var randomMax = (typeof rulesConfig.randomMax === "number") ? rulesConfig.randomMax : 1.0;
        var randomUnit = advanceSeed(seedState) / 2147483647;
        var randomValue = randomMin + (randomMax - randomMin) * randomUnit;
        var reactionScore = computeReactionScore(reactionTime, runtime.idealHitTime);
        var total = (attrNorm * attrWeight) + (turboNorm * turboWeight) + (randomValue * randomWeight) + (reactionScore * reactionWeight);
        return {
            total: total,
            attr: attrNorm,
            turbo: turboNorm,
            random: randomValue,
            reaction: reactionScore
        };
    }

    function resolveContest(now) {
        var baseSeed = runtime.seed;
        var seedState = createSeedState(baseSeed || 1);
        var humanReaction = runtime.humanJumpAt !== null ? runtime.humanJumpAt : runtime.ball.startTime + runtime.ball.duration + contestWindowMs;
        var cpuReaction = runtime.cpuJumpAt !== null ? runtime.cpuJumpAt : runtime.ball.startTime + runtime.ball.duration + contestWindowMs;

        var teamAScore = calculateContestScore(runtime.jumpers.teamA, humanReaction, seedState);
        var teamBScore = calculateContestScore(runtime.jumpers.teamB, cpuReaction, seedState);

        var winner = runtime.jumpers.teamA;
        var loser = runtime.jumpers.teamB;
        if (teamBScore.total > teamAScore.total) {
            winner = runtime.jumpers.teamB;
            loser = runtime.jumpers.teamA;
        } else if (Math.abs(teamAScore.total - teamBScore.total) < 0.0001) {
            var increment = (typeof rulesConfig.tiebreakerIncrement === "number") ? rulesConfig.tiebreakerIncrement : 1;
            var nextSeed = (seedState.value + increment) % 2147483647;
            seedState.value = nextSeed > 0 ? nextSeed : 1;
            var tieRoll = advanceSeed(seedState) / 2147483647;
            if (tieRoll >= 0.5) {
                winner = runtime.jumpers.teamB;
                loser = runtime.jumpers.teamA;
            }
        }

        runtime.winner = winner;
        runtime.loser = loser;
        runtime.seed = seedState.value;

        var wings = winner && runtime.wings[winner.team] ? runtime.wings[winner.team] : [];
        var tipTarget = wings.length ? wings[0] : (winner ? winner.sprite : null);
        if (tipTarget) {
            runtime.ball.tipTargetX = tipTarget.x;
            runtime.ball.tipTargetY = tipTarget.y;
        } else {
            runtime.ball.tipTargetX = runtime.ball.centerX;
            runtime.ball.tipTargetY = runtime.ball.centerY;
        }

        runtime.handoffStart = now;
        transitionToStage("handoff", now, runtime.systems || null);
    }

    function animateHandoff(now) {
        var elapsed = now - runtime.handoffStart;
        if (elapsed < 0) elapsed = 0;
        var duration = handoffDurationMs;
        if (elapsed > duration) elapsed = duration;
        var t = elapsed / duration;
        var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        var x = runtime.ball.centerX + (runtime.ball.tipTargetX - runtime.ball.centerX) * ease;
        var y = runtime.ball.centerY + (runtime.ball.tipTargetY - runtime.ball.centerY) * ease;
        ensureBallFrameAt(x, y);
        moveBallFrameTo(x, y);
        stateManager.set("ballX", Math.round(x), "jump_ball_tip");
        stateManager.set("ballY", Math.round(y), "jump_ball_tip");

        if (elapsed >= duration) {
            finalizeResult(now);
        }
    }

    function finalizeResult(now) {
        var winner = runtime.winner;
        if (!winner || !winner.sprite) {
            runtime.active = false;
            return;
        }

        var winnerTeam = winner.team;
        var opposingTeam = winnerTeam === "teamA" ? "teamB" : "teamA";
        var targetSprite = runtime.ball.tipTargetX === winner.sprite.x && runtime.ball.tipTargetY === winner.sprite.y ? winner.sprite : (runtime.wings[winnerTeam][0] || winner.sprite);

        var ballX = Math.round(targetSprite.x);
        var ballY = Math.round(targetSprite.y);

        ensureBallFrameAt(ballX, ballY);
        moveBallFrameTo(ballX, ballY);

        stateManager.set("firstHalfStartTeam", winnerTeam, "jump_ball_result");
        stateManager.set("currentTeam", winnerTeam, "jump_ball_result");
        stateManager.set("jumpBallTiebreakerSeed", runtime.seed, "jump_ball_seed_update");
        stateManager.set("ballCarrier", targetSprite, "jump_ball_result");
        stateManager.set("ballX", ballX, "jump_ball_result");
        stateManager.set("ballY", ballY, "jump_ball_result");
        stateManager.set("ballHandlerLastX", ballX, "jump_ball_result");
        stateManager.set("ballHandlerLastY", ballY, "jump_ball_result");
        stateManager.set("ballHandlerFrontcourtStartX", ballX, "jump_ball_result");
        stateManager.set("ballHandlerProgressOwner", targetSprite, "jump_ball_result");
        if (targetSprite.playerData) {
            targetSprite.playerData.hasDribble = true;
        }

        if (announceEventFn && winner.sprite.playerData) {
            announceEventFn("tipoff", {
                playerName: winner.sprite.playerData.name,
                player: winner.sprite,
                team: winnerTeam
            }, runtime.systems || null);
        }

        if (helpers.statTrailSystem && typeof helpers.statTrailSystem.queueStatTrail === "function") {
            helpers.statTrailSystem.queueStatTrail({
                text: "TIP",
                player: winner.sprite,
                teamKey: winnerTeam,
                statType: "tipoff"
            });
        }

        if (helpers.broadcastMultiplayerEvent) {
            helpers.broadcastMultiplayerEvent("jump_ball_result", {
                winnerTeam: winnerTeam,
                loserTeam: opposingTeam,
                seed: runtime.seed
            });
        }

        if (setPhaseFn) {
            setPhaseFn(PHASE_NORMAL, {}, 0, null, runtime.systems || null);
        } else {
            stateManager.set("phase", {
                current: PHASE_NORMAL,
                data: {},
                frameCounter: 0,
                targetFrames: 0
            }, "jump_ball_phase_reset");
        }

        stateManager.set("courtNeedsRedraw", true, "jump_ball_result");
        if (drawCourtFn) drawCourtFn(runtime.systems || null);
        if (drawScoreFn) drawScoreFn(runtime.systems || null);

        runtime.active = false;
        runtime.stage = "complete";
        updateJumpBallPhaseState("complete");
    }

    function transitionToStage(stage, now, systems) {
        runtime.stage = stage;
        runtime.stageStart = now;
        updateJumpBallPhaseState(stage);

        if (stage === "countdown") {
            if (setPhaseFn) {
                setPhaseFn(PHASE_JUMP_BALL, { reason: "opening_tip" }, 0, null, systems || runtime.systems || null);
            } else {
                stateManager.set("phase", {
                    current: PHASE_JUMP_BALL,
                    data: { reason: "opening_tip" },
                    frameCounter: 0,
                    targetFrames: 0
                }, "jump_ball_phase_start");
            }
            if (announceFn) {
                announceFn("Jump Ball in 3...", YELLOW, systems);
            }
            runtime.countdownIndex = 0;
        }

        if (stage === "ball_toss") {
            runtime.ball.startTime = now;
            runtime.humanJumpAt = null;
            runtime.cpuJumpAt = null;
            runtime.cpuScheduledJump = null;
            runtime.idealHitTime = now + (runtime.ball.duration / 2);
            runtime.contestDeadline = runtime.idealHitTime + contestWindowMs;
            ensureBallFrameAt(runtime.ball.centerX, runtime.ball.centerY);
            scheduleCpuJump(now);
        }

        if (stage === "handoff") {
            runtime.handoffStart = now;
        }
    }

    function startOpeningTipoff(systems) {
        runtime.active = true;
        runtime.systems = systems || null;
        runtime.stage = "align";
        runtime.stageStart = nowProvider();
        runtime.countdownIndex = -1;
        runtime.humanJumpAt = null;
        runtime.cpuJumpAt = null;
        runtime.cpuScheduledJump = null;
        runtime.winner = null;
        runtime.loser = null;
        runtime.seed = stateManager.get("jumpBallTiebreakerSeed") || 1;

        runtime.jumpers.teamA = selectPrimaryJumper("teamA");
        runtime.jumpers.teamB = selectPrimaryJumper("teamB");

        alignSprites();
        updateJumpBallPhaseState("align");
        transitionToStage("countdown", runtime.stageStart, systems);
    }

    function markJump(spriteData, timestamp) {
        if (!spriteData) return;
        if (spriteData.jumpAt !== null) return;
        spriteData.jumpAt = timestamp;
    }

    function handleUserInput(now, systems) {
        if (!runtime.active || runtime.stage !== "ball_toss") return false;
        if (!runtime.jumpers.teamA) return false;
        if (runtime.humanJumpAt !== null) return false;

        runtime.humanJumpAt = now;
        markJump(runtime.jumpers.teamA, now);
        return true;
    }

    function tick(now, systems) {
        if (!runtime.active) return;

        if (runtime.stage === "countdown") {
            emitCountdown(now, systems);
            return;
        }

        if (runtime.stage === "ball_toss") {
            if (runtime.cpuScheduledJump && runtime.cpuJumpAt === null && now >= runtime.cpuScheduledJump) {
                runtime.cpuJumpAt = runtime.cpuScheduledJump;
                markJump(runtime.jumpers.teamB, runtime.cpuScheduledJump);
            }

            updateBallArc(now);
            animateJump(runtime.jumpers.teamA, now);
            animateJump(runtime.jumpers.teamB, now);

            if (now >= runtime.contestDeadline) {
                if (runtime.humanJumpAt === null) runtime.humanJumpAt = runtime.contestDeadline;
                if (runtime.cpuJumpAt === null) runtime.cpuJumpAt = runtime.contestDeadline;
                resolveContest(now);
            }
            return;
        }

        if (runtime.stage === "handoff") {
            animateJump(runtime.jumpers.teamA, now);
            animateJump(runtime.jumpers.teamB, now);
            animateHandoff(now);
            return;
        }
    }

    function isActive() {
        return runtime.active;
    }

    function isAwaitingUserJump() {
        return runtime.active && runtime.stage === "ball_toss" && runtime.humanJumpAt === null;
    }

    function getDebugState() {
        return JSON.parse(JSON.stringify({
            runtime: {
                stage: runtime.stage,
                active: runtime.active,
                countdownIndex: runtime.countdownIndex,
                humanJumpAt: runtime.humanJumpAt,
                cpuJumpAt: runtime.cpuJumpAt,
                winnerTeam: runtime.winner ? runtime.winner.team : null,
                seed: runtime.seed
            }
        }));
    }

    return {
        startOpeningTipoff: startOpeningTipoff,
        update: tick,
        handleUserInput: handleUserInput,
        isActive: isActive,
        isAwaitingUserJump: isAwaitingUserJump,
        _getDebugState: getDebugState
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        createJumpBallSystem: createJumpBallSystem
    };
}
