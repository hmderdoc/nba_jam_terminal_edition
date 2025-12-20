/**
 * baby-events.js - Random Events for Baby Mamas and Baby Ballers
 * 
 * Handles:
 * - Baby mama random events (money demands, relationship sabotage)
 * - Baby baller random events (play requests, bonding moments)
 * - Adoption events (kids getting "new dads" when neglected)
 * - Nemesis reveals ("Michael Jordan is my dad now!")
 * 
 * Events are unskippable and trigger based on probability when entering hub.
 * Rate-limited to MAX_RANDOM_EVENTS_PER_DAY per player.
 */
(function() {
    // NOTE: Do not use "use strict" - Synchronet color codes use octal-like \1 escapes
    
    // ========== CONFIG / DATA HELPERS ==========
    
    function getConfig(key, defaultValue) {
        if (typeof LORB !== "undefined" && LORB.Config && LORB.Config.BABY_BALLERS) {
            var value = LORB.Config.BABY_BALLERS[key];
            if (value !== undefined) {
                return value;
            }
        }
        return defaultValue;
    }
    
    // Character assets + rosters for dynamic guest/baller picks
    var CHARACTERS_DIR = "/sbbs/xtrn/nba_jam/assets/characters/";
    var ROSTERS_INI = "/sbbs/xtrn/nba_jam/lib/config/rosters.ini";
    var PLAYER_CACHE = null;
    
    function ensurePlayerCache() {
        if (PLAYER_CACHE) return PLAYER_CACHE;
        PLAYER_CACHE = {};
        if (!file_exists(ROSTERS_INI)) return PLAYER_CACHE;
        var f = new File(ROSTERS_INI);
        if (!f.open("r")) return PLAYER_CACHE;
        var currentSection = null;
        var currentData = {};
        while (!f.eof) {
            var line = f.readln();
            if (!line) continue;
            line = line.trim();
            if (!line || line.charAt(0) === ";") continue;
            if (line.charAt(0) === "[" && line.charAt(line.length - 1) === "]") {
                if (currentSection && currentSection.indexOf(".") > 0) {
                    PLAYER_CACHE[currentSection] = currentData;
                }
                currentSection = line.substring(1, line.length - 1).toLowerCase();
                currentData = {};
                continue;
            }
            var eq = line.indexOf("=");
            if (eq > 0) {
                var key = line.substring(0, eq).trim();
                var val = line.substring(eq + 1).trim();
                currentData[key] = val;
            }
        }
        if (currentSection && currentSection.indexOf(".") > 0) {
            PLAYER_CACHE[currentSection] = currentData;
        }
        f.close();
        return PLAYER_CACHE;
    }
    
    function getPlayerDataBySlug(slug) {
        var cache = ensurePlayerCache();
        for (var key in cache) {
            if (!cache.hasOwnProperty(key)) continue;
            var parts = key.split(".");
            if (parts.length === 2 && parts[1] === slug) {
                var data = cache[key];
                data.teamKey = parts[0];
                data.slug = slug;
                return data;
            }
        }
        return null;
    }
    
    function getPlayerNick(data) {
        if (!data) return null;
        var nick = data.player_nick || data.nick;
        if (nick && nick.length > 0) return nick;
        var last = (data.player_last || "").trim();
        var first = (data.player_first || "").trim();
        if (last && first) return first.charAt(0).toUpperCase() + ". " + last;
        if (last) return last;
        return null;
    }
    
    function getRandomCharacterWithData() {
        var files;
        try {
            files = directory(CHARACTERS_DIR + "*.bin");
        } catch (e) {
            return null;
        }
        if (!files || files.length === 0) return null;
        
        var file = files[Math.floor(Math.random() * files.length)];
        var basename = file_getname(file).replace(/\.bin$/i, "");
        var name = basename.split("_").map(function(word) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(" ");
        
        var player = { name: name, path: file, slug: basename };
        var data = getPlayerDataBySlug(basename);
        if (data) {
            player.data = data;
            player.nick = getPlayerNick(data);
            player.team = data.player_team || data.teamKey || "Unknown";
        }
        return player;
    }
    
    // ========== EVENT TYPES ==========
    
    /**
     * Baby Mama event types with weights, effects, and dialogue
     */
    var BABY_MAMA_EVENTS = {
        // Money demands - baby mama wants something
        money_demand: {
            weight: 30,
            minRelationship: -75,  // Can happen unless at absolute bottom
            dialogue: [
                "{name} corners you. \"I need $${amount} for {child}'s {reason}. You gonna help or not?\"",
                "\"Hey! {child} needs new gear. I'm gonna need $${amount} from you.\"",
                "{name} texts you: \"Car broke down. Need $${amount} to get {child} to practice.\""
            ],
            reasons: ["shoes", "equipment", "school fees", "braces", "summer camp", "birthday party"],
            amountRange: [100, 500],
            choices: [
                { key: "P", text: "Pay up", effect: "pay", alignBonus: 2, relationshipBonus: 5 },
                { key: "H", text: "Pay half", effect: "half", alignBonus: 0, relationshipBonus: -5 },
                { key: "R", text: "Refuse", effect: "refuse", alignBonus: -5, relationshipBonus: -15 }
            ]
        },
        
        // Gossip threat - baby mama threatens to badmouth you
        gossip_threat: {
            weight: 20,
            minRelationship: -50,
            maxRelationship: 50,  // Only happens with strained relationships
            dialogue: [
                "{name} pulls you aside. \"You better start showing up more, or I'm telling {child} what kind of father you really are.\"",
                "\"Everyone's gonna know you're a deadbeat if you don't shape up,\" {name} warns.",
                "{name} glares at you. \"My friends all ask where {child}'s dad is. What should I tell them?\""
            ],
            choices: [
                { key: "A", text: "Apologize and promise to do better", effect: "apologize", alignBonus: 3, relationshipBonus: 10 },
                { key: "I", text: "Ignore her", effect: "ignore", alignBonus: -3, relationshipBonus: -10 },
                { key: "D", text: "Deflect blame", effect: "deflect", alignBonus: -2, relationshipBonus: -20 }
            ]
        },
        
        // Good news - baby is doing well (positive event)
        good_news: {
            weight: 15,
            minRelationship: 25,  // Only for decent relationships
            dialogue: [
                "{name} smiles. \"{child} scored 20 points last game! Thought you'd want to know.\"",
                "\"Just wanted to say thanks for being there for {child}. It means a lot.\"",
                "{name} sends a photo: {child} holding a trophy. \"Made the All-Star team!\""
            ],
            choices: [
                { key: "C", text: "Express pride", effect: "proud", alignBonus: 2, relationshipBonus: 5 },
                { key: "G", text: "Send a gift ($200)", effect: "gift", alignBonus: 5, relationshipBonus: 15 }
            ]
        },
        
        // Drama - baby mama is causing problems
        drama: {
            weight: 25,
            minRelationship: -100,
            maxRelationship: 25,
            dialogue: [
                "{name} shows up at the court mid-game. \"Why aren't you answering my calls?!\"",
                "You see {name} talking to the other players. They all turn to look at you...",
                "{name} posts on social media about 'deadbeat dads'. Your rep takes a hit."
            ],
            choices: [
                { key: "C", text: "Calm her down ($100)", effect: "calm", alignBonus: 1, relationshipBonus: 5, cost: 100 },
                { key: "W", text: "Walk away", effect: "walk", alignBonus: -2, relationshipBonus: -10, repPenalty: 5 },
                { key: "A", text: "Argue back", effect: "argue", alignBonus: -5, relationshipBonus: -25, repPenalty: 10 }
            ]
        },
        
        // Ultimatum - pay up or face consequences
        ultimatum: {
            weight: 10,
            minRelationship: -75,
            maxRelationship: -25,
            dialogue: [
                "{name} is FURIOUS. \"Pay off what you owe or {child} is getting a new daddy!\"",
                "\"This is your last chance. $${amount} or I'm finding someone who will provide.\"",
                "{name} slaps court papers in your hand. \"Child support hearing is next week unless you pay $${amount} NOW.\""
            ],
            amountRange: [500, 2000],
            choices: [
                { key: "P", text: "Pay the full amount", effect: "pay_full", alignBonus: 10, relationshipBonus: 25 },
                { key: "N", text: "Negotiate payment plan", effect: "negotiate", alignBonus: 2, relationshipBonus: 5 },
                { key: "R", text: "Refuse", effect: "refuse", alignBonus: -15, relationshipBonus: -50 }
            ]
        }
    };
    
    /**
     * Spouse Retaliation Events - when player cheats on spouse with other baby mamas
     * Triggers when: married player has children with someone other than spouse
     */
    var SPOUSE_RETALIATION_EVENTS = {
        // Spouse confronts player about infidelity
        confrontation: {
            weight: 35,
            dialogue: [
                "{spouse} found out about {babyMama}. \"You think I wouldn't find out?! {child} was supposed to be OURS!\"",
                "\"How could you do this to me?\" {spouse} throws your clothes out of the crib. \"With {babyMama} of all people!\"",
                "{spouse} shows you the court documents. \"I'm taking half of everything. You cheated on me with {babyMama}!\""
            ],
            effects: {
                repLoss: [50, 100],
                cashLoss: [500, 2000],
                relationshipDamage: 50
            },
            choices: [
                { key: "A", text: "Apologize profusely", effect: "apologize", repPenalty: 25, cashPenalty: 500, relationshipBonus: -25 },
                { key: "D", text: "Deny everything", effect: "deny", repPenalty: 50, relationshipBonus: -75 },
                { key: "P", text: "Pay for their forgiveness ($$$)", effect: "bribe", cashPenalty: 2000, relationshipBonus: -10 }
            ]
        },
        
        // Spouse helps your opponent (sabotage)
        sabotage: {
            weight: 25,
            dialogue: [
                "{spouse} sits courtside with {rival}. She hands him a folder. \"That's his playbook. Every weakness, every tell. Destroy him.\"",
                "You spot {spouse} and {rival} laughing over coffee. \"She's been VERY helpful,\" he smirks as you walk by.",
                "{rival} approaches with a confident grin. \"{spouse} just gave me everything I need. Said you never appreciated her intel anyway.\""
            ],
            effects: {
                repLoss: [25, 50],
                nextMatchDebuff: true
            },
            choices: [
                { key: "C", text: "Confront them", effect: "confront", repPenalty: 10, relationshipBonus: -15 },
                { key: "I", text: "Ignore it", effect: "ignore", relationshipBonus: -25 },
                { key: "W", text: "Win them back with gifts", effect: "gift", cashPenalty: 1000, relationshipBonus: 5 }
            ]
        },
        
        // Spouse's revenge baby (has child with another player/NPC)
        revenge_baby: {
            weight: 15,  // Rare but devastating
            dialogue: [
                "{spouse} walks in with a baby. \"Meet {rivalBaby}. {rival} is the father. How does it feel?\"",
                "\"You're not the only one who can play games,\" {spouse} says, holding {rival}'s baby.",
                "{spouse} announces on social media: \"Welcome {rivalBaby}! Proud to say {rival} stepped up where others didn't.\""
            ],
            rivals: ["Michael Jordan", "LeBron James", "Kobe Bryant", "Dennis Rodman", "Charles Barkley"],
            effects: {
                repLoss: [75, 150],
                alignmentHit: -20
            },
            choices: [
                { key: "R", text: "Rage quit the marriage", effect: "divorce", repPenalty: 50, relationshipBonus: -100 },
                { key: "A", text: "Accept defeat, try to reconcile", effect: "accept", repPenalty: 25, relationshipBonus: -50, alignBonus: -5 },
                { key: "F", text: "Fight the rival", effect: "fight", repPenalty: 0, triggerMatch: true }
            ]
        },
        
        // Hidden child support (spouse makes you pay for rival's kid)
        hidden_support: {
            weight: 20,
            dialogue: [
                "The doctor hands you a bill. \"For the baby.\" {spouse} smirks. \"I told them you'd pay.\"",
                "\"Consider this the cost of your mistakes,\" {spouse} says as you're served child support papers for a kid that isn't yours.",
                "You're billed $${amount} for \"your\" child. {spouse} knew. She planned this."
            ],
            amountRange: [1000, 3000],
            choices: [
                { key: "P", text: "Pay it (avoid scandal)", effect: "pay", alignBonus: -10, relationshipBonus: -25 },
                { key: "C", text: "Contest in court ($500)", effect: "contest", cashPenalty: 500, relationshipBonus: -50 },
                { key: "R", text: "Refuse (public scandal)", effect: "refuse", repPenalty: 100, relationshipBonus: -75 }
            ]
        }
    };
    
    /**
     * Baby Baller event types
     */
    var BABY_BALLER_EVENTS = {
        // Child wants to play with parent
        play_request: {
            weight: 35,
            minRelationship: 0,
            maxRelationship: 100,
            notNemesis: true,
            dialogue: [
                "{name} tugs at your jersey. \"Dad, can we play a game together?\"",
                "You spot {name} shooting hoops alone. They wave you over.",
                "{name} texts: \"Coach says I need work on my handles. Help me out?\""
            ],
            choices: [
                { key: "Y", text: "Sure, let's play!", effect: "play", alignBonus: 5, relationshipBonus: 10 },
                { key: "L", text: "Later kid, I'm busy", effect: "later", alignBonus: -3, relationshipBonus: -10 },
                { key: "G", text: "Here's $50, go to the arcade", effect: "bribe", alignBonus: -2, relationshipBonus: -5, cost: 50 }
            ]
        },
        
        // Child asks for advice
        advice: {
            weight: 25,
            minRelationship: 10,
            maxRelationship: 100,
            notNemesis: true,
            dialogue: [
                "{name} looks troubled. \"Dad, some kid at school called me trash. What do I do?\"",
                "\"How do I get better at three-pointers? I keep missing.\"",
                "{name} asks, \"Did you ever lose? How did you handle it?\""
            ],
            choices: [
                { key: "E", text: "Encourage them (+XP)", effect: "encourage", alignBonus: 3, relationshipBonus: 10, xpBonus: 50 },
                { key: "T", text: "Tough love", effect: "tough", alignBonus: 0, relationshipBonus: 0 },
                { key: "D", text: "Dismiss them", effect: "dismiss", alignBonus: -5, relationshipBonus: -15 }
            ]
        },
        
        // Child shows progress (happy event)
        progress: {
            weight: 20,
            minRelationship: 25,
            notNemesis: true,
            dialogue: [
                "{name} runs up excitedly. \"Dad! I leveled up! Check out my new stats!\"",
                "You see {name}'s name on the court rankings. They're moving up!",
                "{name} shows you a highlight reel. \"That's all you, kid,\" you think."
            ],
            choices: [
                { key: "C", text: "Congratulate them", effect: "congratulate", alignBonus: 2, relationshipBonus: 5 },
                { key: "R", text: "Reward with cash ($100)", effect: "reward", alignBonus: 5, relationshipBonus: 15, cost: 100 }
            ]
        },
        
        // Nemesis confrontation
        nemesis_confrontation: {
            weight: 40,
            requiresNemesis: true,
            dialogue: [
                "{name} blocks your path. \"Thought you could just abandon me? Let's settle this on the court.\"",
                "You spot {name} with {adopter}. \"This is my REAL dad now. You're nothing to me.\"",
                "{name} sneers. \"I've been training to beat you. Today's the day.\""
            ],
            adopters: ["Michael Jordan", "LeBron James", "Kobe Bryant", "Shaq", "Kevin Durant"],
            choices: [
                { key: "F", text: "Face them (Start Match)", effect: "fight", alignBonus: 0, relationshipBonus: 0 },
                { key: "A", text: "Try to apologize", effect: "apologize", alignBonus: 5, relationshipBonus: 10 },
                { key: "W", text: "Walk away (coward)", effect: "flee", alignBonus: -10, relationshipBonus: -25, repPenalty: 15 }
            ]
        },
        
        // Adoption reveal - child has a new father figure
        adoption_reveal: {
            weight: 15,
            minRelationship: -100,
            maxRelationship: -50,
            requiresOverdue: true,
            dialogue: [
                "{name} walks up with {adopter}. \"{adopter} taught me everything I know now. Thanks for nothing.\"",
                "You see {name} wearing {adopter}'s jersey. \"He's my dad now,\" they say coldly.",
                "{adopter} puts an arm around {name}. \"I'll take care of them since you couldn't.\""
            ],
            adopters: ["Michael Jordan", "LeBron James", "Kobe Bryant", "Shaquille O'Neal", "Magic Johnson", "Larry Bird"],
            choices: [
                { key: "F", text: "Fight for custody (challenge)", effect: "challenge", alignBonus: 5, relationshipBonus: 0 },
                { key: "A", text: "Accept it", effect: "accept", alignBonus: -10, relationshipBonus: -50 },
                { key: "P", text: "Pay off all support now", effect: "payoff", alignBonus: 15, relationshipBonus: 25 }
            ]
        }
    };
    
    // ========== HELPER FUNCTIONS ==========
    
    /**
     * Pick a random item from an array
     */
    function pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    
    /**
     * Pick a random number in range
     */
    function randomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    /**
     * Format dialogue with variables
     */
    function formatDialogue(template, vars) {
        var result = template;
        for (var key in vars) {
            if (vars.hasOwnProperty(key)) {
                result = result.replace(new RegExp("{" + key + "}", "g"), vars[key]);
            }
        }
        return result;
    }
    
    /**
     * Select an event type based on weights
     */
    function selectWeightedEvent(events, filter) {
        var candidates = [];
        var totalWeight = 0;
        
        for (var key in events) {
            if (events.hasOwnProperty(key)) {
                var event = events[key];
                if (filter(event)) {
                    candidates.push({ key: key, event: event, weight: event.weight });
                    totalWeight += event.weight;
                }
            }
        }
        
        if (candidates.length === 0) return null;
        
        var roll = Math.random() * totalWeight;
        var cumulative = 0;
        
        for (var i = 0; i < candidates.length; i++) {
            cumulative += candidates[i].weight;
            if (roll < cumulative) {
                return { key: candidates[i].key, event: candidates[i].event };
            }
        }
        
        return candidates[candidates.length - 1];
    }
    
    // ========== EVENT CHECK FUNCTIONS ==========
    
    /**
     * Check if a baby mama event should trigger
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object|null} - Event data or null
     */
    function checkBabyMamaEvent(ctx, gameDay) {
        if (!ctx.babyMamas || Object.keys(ctx.babyMamas).length === 0) {
            return null;
        }
        
        // Check for force flags (testing mode)
        var forceEvents = !!getConfig("FORCE_EVENTS", false);
        var forceBabyMama = !!getConfig("FORCE_BABY_MAMA_EVENT", false);
        var forceThis = forceEvents || forceBabyMama;
        
        // Check daily event limit (skip if forcing)
        if (!forceThis) {
            if (!ctx.dailyBabyEvents) {
                ctx.dailyBabyEvents = { day: gameDay, count: 0 };
            }
            if (ctx.dailyBabyEvents.day !== gameDay) {
                ctx.dailyBabyEvents = { day: gameDay, count: 0 };
            }
            
            var maxEvents = getConfig("MAX_RANDOM_EVENTS_PER_DAY", 1);
            if (ctx.dailyBabyEvents.count >= maxEvents) {
                return null;
            }
        }
        
        var eventChance = forceThis ? 1.0 : getConfig("BABY_MAMA_EVENT_CHANCE", 0.20);
        
        // Check each baby mama for event trigger
        var babyMamaIds = Object.keys(ctx.babyMamas);
        for (var i = 0; i < babyMamaIds.length; i++) {
            var mamaId = babyMamaIds[i];
            var mama = ctx.babyMamas[mamaId];
            
            // Rate limit per baby mama (skip if forcing)
            if (!forceThis && mama.lastEventDay && mama.lastEventDay === gameDay) {
                continue;
            }
            
            // Roll for event
            if (Math.random() > eventChance) {
                continue;
            }
            
            // Find an applicable event based on relationship
            var relationship = mama.relationship || 0;
            var selected = selectWeightedEvent(BABY_MAMA_EVENTS, function(evt) {
                if (evt.minRelationship !== undefined && relationship < evt.minRelationship) return false;
                if (evt.maxRelationship !== undefined && relationship > evt.maxRelationship) return false;
                return true;
            });
            
            if (selected) {
                // Get a child for this mama
                var childName = "your child";
                if (mama.childrenIds && mama.childrenIds.length > 0 && ctx.babyBallers) {
                    var childId = mama.childrenIds[0];
                    for (var j = 0; j < ctx.babyBallers.length; j++) {
                        if (ctx.babyBallers[j].id === childId) {
                            childName = ctx.babyBallers[j].name || ctx.babyBallers[j].nickname || "your child";
                            break;
                        }
                    }
                }
                
                // Calculate amount if needed
                var amount = 0;
                if (selected.event.amountRange) {
                    amount = randomInRange(selected.event.amountRange[0], selected.event.amountRange[1]);
                }
                
                // Pick reason if needed
                var reason = "";
                if (selected.event.reasons) {
                    reason = pickRandom(selected.event.reasons);
                }
                
                // Format dialogue
                var dialogue = formatDialogue(pickRandom(selected.event.dialogue), {
                    name: mama.name || "Baby Mama",
                    child: childName,
                    amount: amount,
                    reason: reason
                });
                
                return {
                    type: "baby_mama",
                    eventKey: selected.key,
                    event: selected.event,
                    mamaId: mamaId,
                    mama: mama,
                    childName: childName,
                    amount: amount,
                    reason: reason,
                    dialogue: dialogue
                };
            }
        }
        
        return null;
    }
    
    /**
     * Check if a baby baller event should trigger
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object|null} - Event data or null
     */
    function checkBabyBallerEvent(ctx, gameDay) {
        if (!ctx.babyBallers || ctx.babyBallers.length === 0) {
            return null;
        }
        
        // Check for force flags (testing mode)
        var forceEvents = !!getConfig("FORCE_EVENTS", false);
        var forceBabyBaller = !!getConfig("FORCE_BABY_BALLER_EVENT", false);
        var forceThis = forceEvents || forceBabyBaller;
        
        // Check daily event limit (skip if forcing)
        if (!forceThis) {
            if (!ctx.dailyBabyEvents) {
                ctx.dailyBabyEvents = { day: gameDay, count: 0 };
            }
            if (ctx.dailyBabyEvents.day !== gameDay) {
                ctx.dailyBabyEvents = { day: gameDay, count: 0 };
            }
            
            var maxEvents = getConfig("MAX_RANDOM_EVENTS_PER_DAY", 1);
            if (ctx.dailyBabyEvents.count >= maxEvents) {
                return null;
            }
        }
        
        var eventChance = forceThis ? 1.0 : getConfig("CHILD_CHALLENGE_CHANCE", 0.15);
        
        // Check each child for event trigger
        for (var i = 0; i < ctx.babyBallers.length; i++) {
            var child = ctx.babyBallers[i];
            
            // Rate limit per child (skip if forcing)
            if (!forceThis && child.lastEventDay && child.lastEventDay === gameDay) {
                continue;
            }
            
            // Roll for event
            if (Math.random() > eventChance) {
                continue;
            }
            
            var relationship = child.relationship || 50;
            var isNemesis = child.isNemesis || false;
            var isOverdue = child.childSupport && child.childSupport.isOverdue;
            
            // Find an applicable event
            var selected = selectWeightedEvent(BABY_BALLER_EVENTS, function(evt) {
                if (evt.minRelationship !== undefined && relationship < evt.minRelationship) return false;
                if (evt.maxRelationship !== undefined && relationship > evt.maxRelationship) return false;
                if (evt.notNemesis && isNemesis) return false;
                if (evt.requiresNemesis && !isNemesis) return false;
                if (evt.requiresOverdue && !isOverdue) return false;
                return true;
            });
            
            if (selected) {
                // Pick adopter if needed
                var adopter = "";
                if (selected.event.adopters) {
                    adopter = pickRandom(selected.event.adopters);
                }
                
                // Format dialogue
                var dialogue = formatDialogue(pickRandom(selected.event.dialogue), {
                    name: child.name || child.nickname || "Your Kid",
                    adopter: adopter
                });
                
                return {
                    type: "baby_baller",
                    eventKey: selected.key,
                    event: selected.event,
                    childId: child.id,
                    child: child,
                    adopter: adopter,
                    dialogue: dialogue
                };
            }
        }
        
        return null;
    }
    
    /**
     * Check for spouse retaliation event
     * Triggers when: married player has children with someone who is NOT their spouse
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object|null} - Event data or null
     */
    function checkSpouseRetaliationEvent(ctx, gameDay) {
        // Check for force flags (testing mode)
        var forceEvents = !!getConfig("FORCE_EVENTS", false);
        var forceRetaliation = !!getConfig("FORCE_SPOUSE_RETALIATION", false);
        var forceThis = forceEvents || forceRetaliation;
        
        // Must be married
        if (!ctx.romance || !ctx.romance.spouseName) {
            return null;
        }
        
        // Check if player has baby mamas who are NOT the spouse
        var babyMamas = ctx.babyMamas || [];
        var nonSpouseBabyMamas = [];
        for (var i = 0; i < babyMamas.length; i++) {
            if (babyMamas[i].name !== ctx.romance.spouseName) {
                nonSpouseBabyMamas.push(babyMamas[i]);
            }
        }
        
        // No cheating detected = no retaliation
        if (nonSpouseBabyMamas.length === 0) {
            return null;
        }
        
        // Check daily event limit (skip if forcing)
        if (!forceThis) {
            if (!ctx.dailyBabyEvents) {
                ctx.dailyBabyEvents = { day: gameDay, count: 0 };
            }
            if (ctx.dailyBabyEvents.day !== gameDay) {
                ctx.dailyBabyEvents = { day: gameDay, count: 0 };
            }
            
            var maxEvents = getConfig("MAX_RANDOM_EVENTS_PER_DAY", 1);
            if (ctx.dailyBabyEvents.count >= maxEvents) {
                return null;
            }
        }
        
        // Rate limit: check last spouse event (skip if forcing)
        if (!forceThis && ctx.lastSpouseRetaliationDay && gameDay - ctx.lastSpouseRetaliationDay < 5) {
            return null;  // At least 5 days between spouse events
        }
        
        // Chance of spouse retaliation event (100% if forcing)
        var retaliationChance = forceThis ? 1.0 : getConfig("SPOUSE_RETALIATION_CHANCE", 0.20);
        if (!forceThis && Math.random() > retaliationChance) {
            return null;
        }
        
        // Pick a random non-spouse baby mama that caused this
        var offendingMama = pickRandom(nonSpouseBabyMamas);
        var offendingChild = null;
        if (offendingMama.childrenIds && offendingMama.childrenIds.length > 0 && ctx.babyBallers) {
            for (var j = 0; j < ctx.babyBallers.length; j++) {
                if (offendingMama.childrenIds.indexOf(ctx.babyBallers[j].id) !== -1) {
                    offendingChild = ctx.babyBallers[j];
                    break;
                }
            }
        }
        
        // Select a retaliation event
        var selected = selectWeightedEvent(SPOUSE_RETALIATION_EVENTS, function(evt) {
            return true;  // All events are eligible when cheating is detected
        });
        
        if (!selected) {
            return null;
        }
        
        // Generate event-specific data
        var rival = "";
        var rivalBaby = "";
        var amount = 0;
        var rivalArt = null;
        
        if (selected.event.rivals) {
            var rivalPlayer = getRandomCharacterWithData();
            if (rivalPlayer) {
                rival = rivalPlayer.name;
                rivalArt = rivalPlayer.path;
                rivalBaby = "Baby " + (rivalPlayer.nick || rivalPlayer.name.split(" ").slice(-1)[0]);
            } else {
                rival = pickRandom(selected.event.rivals);
                rivalBaby = "Baby " + rival.split(" ")[1];
            }
        }
        
        if (selected.event.amountRange) {
            amount = randomInRange(selected.event.amountRange[0], selected.event.amountRange[1]);
        }
        
        // Format dialogue
        var dialogue = formatDialogue(pickRandom(selected.event.dialogue), {
            spouse: ctx.romance.spouseName,
            babyMama: offendingMama.name,
            child: offendingChild ? (offendingChild.name || offendingChild.nickname) : "your secret kid",
            rival: rival,
            rivalBaby: rivalBaby,
            amount: amount
        });
        
        if (!forceRetaliation) {
            ctx.lastSpouseRetaliationDay = gameDay;
        }
        
        return {
            type: "spouse_retaliation",
            eventKey: selected.key,
            event: selected.event,
            spouse: ctx.romance.spouseName,
            offendingMama: offendingMama,
            offendingChild: offendingChild,
            rival: rival,
            rivalBaby: rivalBaby,
            amount: amount,
            rivalArt: rivalArt,
            dialogue: dialogue
        };
    }
    
    /**
     * Check for any random baby-related event
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object|null} - Event data or null
     */
    function checkForRandomEvent(ctx, gameDay) {
        // Check for specific force flags - these take priority over spouse
        var forceBabyMama = !!getConfig("FORCE_BABY_MAMA_EVENT", false);
        var forceBabyBaller = !!getConfig("FORCE_BABY_BALLER_EVENT", false);
        
        if (typeof debugLog === "function") {
            debugLog("[BABY_EVENTS] checkForRandomEvent: forceBabyMama=" + forceBabyMama + 
                     ", forceBabyBaller=" + forceBabyBaller +
                     ", hasBabyMamas=" + !!(ctx.babyMamas && ctx.babyMamas.length > 0) +
                     ", hasBabyBallers=" + !!(ctx.babyBallers && ctx.babyBallers.length > 0) +
                     ", isMarried=" + !!(ctx.romance && ctx.romance.spouseName));
        }
        
        // If a specific event type is forced, check that first
        if (forceBabyMama) {
            var mamaEvent = checkBabyMamaEvent(ctx, gameDay);
            if (mamaEvent) {
                if (typeof debugLog === "function") debugLog("[BABY_EVENTS] Returning baby_mama event: " + mamaEvent.eventKey);
                return mamaEvent;
            } else {
                if (typeof debugLog === "function") debugLog("[BABY_EVENTS] No baby mama event available (need ctx.babyMamas)");
            }
        }
        if (forceBabyBaller) {
            var ballerEvent = checkBabyBallerEvent(ctx, gameDay);
            if (ballerEvent) {
                if (typeof debugLog === "function") debugLog("[BABY_EVENTS] Returning baby_baller event: " + ballerEvent.eventKey);
                return ballerEvent;
            } else {
                if (typeof debugLog === "function") debugLog("[BABY_EVENTS] No baby baller event available (need ctx.babyBallers)");
            }
        }
        
        // Check for spouse retaliation first (if married and cheating)
        // Only if we didn't already force-check the other types
        var spouseEvent = checkSpouseRetaliationEvent(ctx, gameDay);
        if (spouseEvent) {
            if (typeof debugLog === "function") debugLog("[BABY_EVENTS] Returning spouse_retaliation event");
            return spouseEvent;
        }
        
        // 50/50 chance to check baby mama or baby baller first
        if (Math.random() < 0.5) {
            var normalMamaEvent = checkBabyMamaEvent(ctx, gameDay);
            if (normalMamaEvent) return normalMamaEvent;
            return checkBabyBallerEvent(ctx, gameDay);
        } else {
            var normalBallerEvent = checkBabyBallerEvent(ctx, gameDay);
            if (normalBallerEvent) return normalBallerEvent;
            return checkBabyMamaEvent(ctx, gameDay);
        }
    }
    
    // ========== EVENT PROCESSING ==========
    
    /**
     * Process the player's choice for an event
     * @param {Object} ctx - Player context
     * @param {Object} eventData - Event data from check function
     * @param {Object} choice - The choice the player made
     * @param {number} gameDay - Current game day
     * @returns {Object} - Result of the choice
     */
    function processEventChoice(ctx, eventData, choice, gameDay) {
        var result = {
            success: true,
            message: "",
            alignmentChange: 0,
            relationshipChange: 0,
            cashChange: 0,
            repChange: 0,
            xpChange: 0,
            triggerMatch: false
        };
        
        // Apply alignment change
        if (choice.alignBonus) {
            result.alignmentChange = choice.alignBonus;
            if (LORB.Data && LORB.Data.Alignment && LORB.Data.Alignment.adjust) {
                LORB.Data.Alignment.adjust(ctx, "baby_event_" + eventData.eventKey, choice.alignBonus);
            } else {
                ctx.alignment = (ctx.alignment || 0) + choice.alignBonus;
                ctx.alignment = Math.max(-100, Math.min(100, ctx.alignment));
            }
        }
        
        // Apply relationship change
        if (choice.relationshipBonus) {
            result.relationshipChange = choice.relationshipBonus;
            
            if (eventData.type === "baby_mama" && ctx.babyMamas && ctx.babyMamas[eventData.mamaId]) {
                ctx.babyMamas[eventData.mamaId].relationship = 
                    (ctx.babyMamas[eventData.mamaId].relationship || 0) + choice.relationshipBonus;
                ctx.babyMamas[eventData.mamaId].relationship = 
                    Math.max(-100, Math.min(100, ctx.babyMamas[eventData.mamaId].relationship));
            }
            
            if (eventData.type === "baby_baller" && ctx.babyBallers) {
                for (var i = 0; i < ctx.babyBallers.length; i++) {
                    if (ctx.babyBallers[i].id === eventData.childId) {
                        ctx.babyBallers[i].relationship = 
                            (ctx.babyBallers[i].relationship || 50) + choice.relationshipBonus;
                        ctx.babyBallers[i].relationship = 
                            Math.max(-100, Math.min(100, ctx.babyBallers[i].relationship));
                        break;
                    }
                }
            }
        }
        
        // Apply cost
        if (choice.cost) {
            if ((ctx.cash || 0) >= choice.cost) {
                ctx.cash -= choice.cost;
                result.cashChange = -choice.cost;
            } else {
                result.success = false;
                result.message = "You don't have enough cash ($" + choice.cost + " needed)";
                return result;
            }
        }
        
        // Apply payment for money demand events
        if (choice.effect === "pay" && eventData.amount > 0) {
            if ((ctx.cash || 0) >= eventData.amount) {
                ctx.cash -= eventData.amount;
                result.cashChange = -eventData.amount;
            } else {
                result.success = false;
                result.message = "You don't have enough cash ($" + eventData.amount + " needed)";
                return result;
            }
        }
        
        if (choice.effect === "half" && eventData.amount > 0) {
            var halfAmount = Math.floor(eventData.amount / 2);
            if ((ctx.cash || 0) >= halfAmount) {
                ctx.cash -= halfAmount;
                result.cashChange = -halfAmount;
            } else {
                result.success = false;
                result.message = "You don't have enough cash ($" + halfAmount + " needed)";
                return result;
            }
        }
        
        if (choice.effect === "pay_full" && eventData.amount > 0) {
            if ((ctx.cash || 0) >= eventData.amount) {
                ctx.cash -= eventData.amount;
                result.cashChange = -eventData.amount;
            } else {
                result.success = false;
                result.message = "You don't have enough cash ($" + eventData.amount + " needed)";
                return result;
            }
        }
        
        // Apply rep penalty
        if (choice.repPenalty) {
            ctx.rep = (ctx.rep || 0) - choice.repPenalty;
            result.repChange = -choice.repPenalty;
        }
        
        // Apply XP bonus
        if (choice.xpBonus && eventData.child) {
            eventData.child.xp = (eventData.child.xp || 0) + choice.xpBonus;
            result.xpChange = choice.xpBonus;
        }
        
        // Handle special effects
        if (choice.effect === "fight" || choice.effect === "challenge") {
            result.triggerMatch = true;
            if (eventData.type === "baby_baller" && eventData.child) {
                result.matchOpponent = eventData.child;
            }
        }
        
        if (choice.effect === "play" && eventData.child) {
            // Playing with child gives them XP and bonding
            eventData.child.xp = (eventData.child.xp || 0) + 25;
            result.xpChange = 25;
            result.message = "You spent quality time with " + (eventData.child.name || "your kid") + ". (+25 XP for them)";
        }
        
        if (choice.effect === "payoff" && eventData.child && eventData.child.childSupport) {
            // Attempt to pay off all remaining support
            var balance = eventData.child.childSupport.balance || 0;
            if ((ctx.cash || 0) >= balance) {
                ctx.cash -= balance;
                eventData.child.childSupport.balance = 0;
                eventData.child.childSupport.isPaidOff = true;
                eventData.child.childSupport.isOverdue = false;
                result.cashChange = -balance;
                result.message = "You paid off all child support ($" + balance + ")!";
            } else {
                result.success = false;
                result.message = "You don't have enough cash ($" + balance + " needed to pay off)";
                return result;
            }
        }
        
        // Handle adoption acceptance - child gets a new father figure
        if (choice.effect === "accept" && eventData.type === "baby_baller" && eventData.adopter) {
            if (eventData.child) {
                eventData.child.adoptiveFatherId = "nba_" + eventData.adopter.toLowerCase().replace(/ /g, "_");
                eventData.child.adoptiveFatherName = eventData.adopter;
                eventData.child.isNemesis = true;  // Adopted kids become nemeses
                result.message = eventData.child.nickname + " now considers " + eventData.adopter + " their father.\n\1r\"I am your father now.\"\1n";
            }
        }
        
        // Handle spouse retaliation events
        if (eventData.type === "spouse_retaliation") {
            // Apply cash penalties
            if (choice.cashPenalty) {
                var penalty = choice.cashPenalty;
                if ((ctx.cash || 0) >= penalty) {
                    ctx.cash -= penalty;
                    result.cashChange = (result.cashChange || 0) - penalty;
                } else {
                    // If can't pay, take what they have and add extra rep penalty
                    var taken = ctx.cash || 0;
                    ctx.cash = 0;
                    result.cashChange = (result.cashChange || 0) - taken;
                    ctx.rep = (ctx.rep || 0) - 25;  // Extra rep hit for being broke
                    result.repChange = (result.repChange || 0) - 25;
                }
            }
            
            // Handle divorce
            if (choice.effect === "divorce") {
                // End the marriage
                if (ctx.romance) {
                    ctx.romance.spouseName = null;
                    ctx.romance.spouseCityId = null;
                }
                result.message = "You've ended your marriage to " + eventData.spouse + ".\n\1y\"I never loved you anyway!\"\1n";
            }
            
            // Handle fight with rival
            if (choice.effect === "fight" && eventData.rival) {
                result.triggerMatch = true;
                result.matchOpponentName = eventData.rival;
                result.message = "You challenged " + eventData.rival + " to a match to defend your honor!";
            }
            
            // Handle bribe/pay attempts
            if (choice.effect === "bribe") {
                result.message = "You paid " + eventData.spouse + " to keep quiet. For now...";
            }
            
            // Handle deny - makes things worse
            if (choice.effect === "deny") {
                result.message = eventData.spouse + " doesn't believe you. Everyone knows the truth now.";
            }
            
            // Handle contest
            if (choice.effect === "contest" && eventData.amount > 0) {
                if ((ctx.cash || 0) >= 500) {
                    ctx.cash -= 500;
                    result.cashChange = (result.cashChange || 0) - 500;
                    result.message = "You took it to court. The truth came out, but everyone knows now.";
                }
            }
        }
        
        // Mark event as processed (rate limiting)
        ctx.dailyBabyEvents.count++;
        
        if (eventData.type === "baby_mama" && ctx.babyMamas && ctx.babyMamas[eventData.mamaId]) {
            ctx.babyMamas[eventData.mamaId].lastEventDay = gameDay;
        }
        
        if (eventData.type === "baby_baller") {
            for (var i = 0; i < ctx.babyBallers.length; i++) {
                if (ctx.babyBallers[i].id === eventData.childId) {
                    ctx.babyBallers[i].lastEventDay = gameDay;
                    break;
                }
            }
        }
        
        return result;
    }
    
    // ========== UI FUNCTIONS ==========
    
    /**
     * Show a random event using RichView
     * @param {Object} eventData - Event data
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object} - Result after player makes choice
     */
    function showEventRichView(eventData, ctx, gameDay) {
        // Load TalkShowView - this is the ONLY view path, no legacy fallback
        if (!LORB.UI || !LORB.UI.TalkShowView) {
            load("/sbbs/xtrn/nba_jam/lib/lorb/ui/talk_show_view.js");
        }
        
        if (!LORB.UI || !LORB.UI.TalkShowView || !LORB.UI.TalkShowView.present) {
            throw new Error("[BABY_EVENTS] TalkShowView failed to load - this should never happen");
        }
        
        var dialogueLines = [];
        // Wrap dialogue to ~38 chars for the content column
        (function wrap(text, width) {
            var words = String(text || "").split(" ");
            var line = "";
            for (var i = 0; i < words.length; i++) {
                var w = words[i];
                if (line.length + w.length + 1 > width) {
                    if (line) dialogueLines.push(line);
                    line = w;
                } else {
                    line += (line ? " " : "") + w;
                }
            }
            if (line) dialogueLines.push(line);
        })(eventData.dialogue, 38);
        
        if (eventData.amount > 0 || eventData.event.choices.some(function(c) { return c.cost; })) {
            dialogueLines.push("");
            dialogueLines.push("Your cash: $" + (ctx.cash || 0));
        }
        
        var choices = eventData.event.choices.map(function(c) {
            var text = c.text;
            if (c.cost) {
                text += " ($" + c.cost + ")";
            } else if (c.effect === "pay" && eventData.amount) {
                text += " ($" + eventData.amount + ")";
            } else if (c.effect === "half" && eventData.amount) {
                text += " ($" + Math.floor(eventData.amount / 2) + ")";
            }
            return { key: c.key, text: text };
        });
        
        if (typeof debugLog === "function") debugLog("[BABY_EVENTS] Calling TalkShowView.present for " + eventData.type + "." + eventData.eventKey);
        
        // Determine if this event has a third party (rival) for dramatic reveal
        var hasDramaticReveal = !!(eventData.rival || eventData.rivalArt);
        
        var tvResult = LORB.UI.TalkShowView.present({
            // New: Pass event type for host matching
            eventType: eventData.type,
            eventSubtype: eventData.eventKey,
            
            // Content
            dialogueLines: dialogueLines,
            choices: choices,
            
            // Guest/rival info for dramatic reveals
            guestArt: eventData.rivalArt || null,
            guestName: eventData.rival || null,
            dramaticReveal: hasDramaticReveal
        });
        
        // Capture the show for result display (so same host appears)
        var usedShow = tvResult ? tvResult.show : null;
        
        var selectedChoice = null;
        if (tvResult && tvResult.choiceKey) {
            var key = tvResult.choiceKey.toUpperCase();
            for (var i = 0; i < eventData.event.choices.length; i++) {
                if (eventData.event.choices[i].key === key) {
                    selectedChoice = eventData.event.choices[i];
                    break;
                }
            }
        }
        
        if (!selectedChoice && eventData.event.choices.length > 0) {
            selectedChoice = eventData.event.choices[0]; // Fallback
        }
        
        if (!selectedChoice) return null;
        
        var resultTv = processEventChoice(ctx, eventData, selectedChoice, gameDay);
        showEventResult(resultTv, eventData, selectedChoice, usedShow);
        return resultTv;
    }
    
    /**
     * Show the result of an event choice using TalkShowView
     * @param {Object} result - Processed result
     * @param {Object} eventData - Original event data
     * @param {Object} choice - The choice made
     * @param {Object} [show] - The talk show to use (for consistency)
     */
    function showEventResult(result, eventData, choice, show) {
        var resultLines = [];
        
        if (!result.success) {
            resultLines.push("\1r" + result.message + "\1n");
        } else {
            if (result.message) {
                resultLines.push("\1w" + result.message + "\1n");
                resultLines.push("");
            }
            
            if (result.cashChange !== 0) {
                var cashColor = result.cashChange < 0 ? "\1r" : "\1g";
                resultLines.push(cashColor + "Cash: " + (result.cashChange < 0 ? "" : "+") + "$" + result.cashChange + "\1n");
            }
            
            if (result.alignmentChange !== 0) {
                var alignColor = result.alignmentChange < 0 ? "\1r" : "\1g";
                resultLines.push(alignColor + "Karma: " + (result.alignmentChange < 0 ? "" : "+") + result.alignmentChange + "\1n");
            }
            
            if (result.relationshipChange !== 0) {
                var relColor = result.relationshipChange < 0 ? "\1r" : "\1g";
                var who = "Relationship";
                if (eventData.type === "baby_mama" && eventData.mama) who = eventData.mama.name;
                else if (eventData.child) who = eventData.child.name || "Your kid";
                resultLines.push(relColor + who + " relationship: " + (result.relationshipChange < 0 ? "" : "+") + result.relationshipChange + "\1n");
            }
            
            if (result.repChange !== 0) {
                resultLines.push("\1r" + "Rep: " + result.repChange + "\1n");
            }
            
            if (result.xpChange !== 0 && eventData.child) {
                resultLines.push("\1c" + (eventData.child.name || "Your kid") + " XP: +" + result.xpChange + "\1n");
            }
        }
        
        // Use TalkShowView for result display (same show as the event)
        if (LORB.UI && LORB.UI.TalkShowView && LORB.UI.TalkShowView.present) {
            LORB.UI.TalkShowView.present({
                show: show,  // Use same show for consistency
                dialogueLines: resultLines,
                choices: []  // press any key
            });
        }
    }
    
    /**
     * Main entry point - check and show a random event if one triggers
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object|null} - Event result or null if no event
     */
    function checkAndShowEvent(ctx, gameDay) {
        var eventData = checkForRandomEvent(ctx, gameDay);
        
        if (!eventData) {
            return null;
        }
        
        // Show the event
        var result = showEventRichView(eventData, ctx, gameDay);
        
        return result;
    }
    
    // ========== ANTI-SPAM EVENTS (Find Another consequences) ==========
    
    /**
     * General anti-spam events that can happen to ANY player.
     * These discourage spamming "Find Another" to cherry-pick opponents.
     * Mostly punitive, occasional rewards, some neutral/entertaining.
     */
    var ANTI_SPAM_EVENTS = {
        // Punitive events
        "reporter_ambush": {
            title: "AMBUSHED!",
            weight: 15,
            dialogue: [
                "A reporter spots you lurking around the courts!",
                "\"Why are you dodging so many opponents? Scared?\"",
                "\1r-5 Rep\1n"
            ],
            effect: { rep: -5 },
            hostKey: "geraldo"
        },
        "heckler": {
            title: "HECKLED!",
            weight: 15,
            dialogue: [
                "A crowd gathers as you keep searching...",
                "\"This guy's scared! He won't play anyone!\"",
                "\1r-3 Rep\1n"
            ],
            effect: { rep: -3 },
            hostKey: "springer"
        },
        "scout_notice": {
            title: "BAD LOOK",
            weight: 10,
            dialogue: [
                "An NBA scout was watching you...",
                "He shakes his head and walks away.",
                "\1r-8 Rep\1n"
            ],
            effect: { rep: -8 },
            hostKey: "arsenio"
        },
        "pickpocket": {
            title: "ROBBED!",
            weight: 12,
            dialogue: [
                "While you were distracted looking for opponents...",
                "Someone lifted your wallet!",
                "\1r-$50\1n"
            ],
            effect: { cash: -50 },
            hostKey: "geraldo"
        },
        "shoe_damage": {
            title: "EQUIPMENT TROUBLE",
            weight: 8,
            dialogue: [
                "All this walking around looking for opponents...",
                "Your shoes are wearing out faster.",
                "\1r-$25\1n for repairs."
            ],
            effect: { cash: -25 },
            hostKey: "donahue"
        },
        
        // Neutral/entertaining events
        "breaking_news": {
            title: "BREAKING NEWS",
            weight: 10,
            dialogue: [
                "Geraldo interrupts with breaking news!",
                "\"Local baller seen wandering courts aimlessly.\"",
                "\"More at 11.\""
            ],
            effect: {},
            hostKey: "geraldo"
        },
        "autograph_seeker": {
            title: "FAN ENCOUNTER",
            weight: 8,
            dialogue: [
                "A fan approaches you for an autograph.",
                "\"I've been watching you look for opponents!\"",
                "At least someone's paying attention..."
            ],
            effect: {},
            hostKey: "ricki"
        },
        
        // Reward events (rare)
        "dropped_cash": {
            title: "LUCKY FIND",
            weight: 5,
            dialogue: [
                "While wandering around...",
                "You find some cash on the ground!",
                "\1g+$25\1n"
            ],
            effect: { cash: 25 },
            hostKey: "oprah"
        },
        "impressed_fan": {
            title: "RESPECT",
            weight: 5,
            dialogue: [
                "A fan watches you scope out the competition.",
                "\"Smart player, picking your battles!\"",
                "\1c+2 Rep\1n"
            ],
            effect: { rep: 2 },
            hostKey: "arsenio"
        }
    };
    
    /**
     * Check for an anti-spam event (triggers on "Find Another")
     * NO daily limit - this is the deterrent for spamming reroll
     * @param {Object} ctx - Player context
     * @param {number} gameDay - Current game day
     * @returns {Object|null} - Event result or null
     */
    function checkAntiSpamEvent(ctx, gameDay) {
        // Base chance for anti-spam event
        var antiSpamChance = getConfig("ANTI_SPAM_EVENT_CHANCE", 0.15); // 15% per reroll
        
        if (Math.random() > antiSpamChance) {
            return null; // No event this time
        }
        
        // First, check if player has family - they might get a family event instead
        var hasBabyMamas = ctx.babyMamas && ctx.babyMamas.length > 0;
        var hasBabyBallers = ctx.babyBallers && ctx.babyBallers.length > 0;
        
        // 60% chance to get family event if player has family, otherwise general event
        if ((hasBabyMamas || hasBabyBallers) && Math.random() < 0.6) {
            // Try to fire a family-related event (baby mama or baby baller)
            var familyEvent = null;
            if (Math.random() < 0.5 && hasBabyMamas) {
                familyEvent = checkBabyMamaEventNoLimit(ctx, gameDay);
            } else if (hasBabyBallers) {
                familyEvent = checkBabyBallerEventNoLimit(ctx, gameDay);
            } else if (hasBabyMamas) {
                familyEvent = checkBabyMamaEventNoLimit(ctx, gameDay);
            }
            
            if (familyEvent) {
                return showEventRichView(familyEvent, ctx, gameDay);
            }
        }
        
        // General anti-spam event (works for all players)
        return showAntiSpamEvent(ctx, gameDay);
    }
    
    /**
     * Check baby mama event without daily limit (for anti-spam flow)
     */
    function checkBabyMamaEventNoLimit(ctx, gameDay) {
        if (!ctx.babyMamas || ctx.babyMamas.length === 0) {
            return null;
        }
        
        // Pick a random baby mama
        var mamaIndex = Math.floor(Math.random() * ctx.babyMamas.length);
        var mama = ctx.babyMamas[mamaIndex];
        var mamaId = mamaIndex.toString();
        
        // Find an applicable event based on relationship
        var relationship = mama.relationship || 0;
        var selected = selectWeightedEvent(BABY_MAMA_EVENTS, function(evt) {
            if (evt.minRelationship !== undefined && relationship < evt.minRelationship) return false;
            if (evt.maxRelationship !== undefined && relationship > evt.maxRelationship) return false;
            return true;
        });
        
        if (!selected) return null;
        
        // Get a child for this mama
        var childName = "your child";
        if (mama.childrenIds && mama.childrenIds.length > 0 && ctx.babyBallers) {
            var childId = mama.childrenIds[0];
            for (var j = 0; j < ctx.babyBallers.length; j++) {
                if (ctx.babyBallers[j].id === childId) {
                    childName = ctx.babyBallers[j].name || ctx.babyBallers[j].nickname || "your child";
                    break;
                }
            }
        }
        
        var amount = 0;
        if (selected.event.amountRange) {
            amount = randomInRange(selected.event.amountRange[0], selected.event.amountRange[1]);
        }
        
        var reason = "";
        if (selected.event.reasons) {
            reason = pickRandom(selected.event.reasons);
        }
        
        var dialogue = formatDialogue(pickRandom(selected.event.dialogue), {
            name: mama.name || "Baby Mama",
            child: childName,
            amount: amount,
            reason: reason
        });
        
        return {
            type: "baby_mama",
            eventKey: selected.key,
            event: selected.event,
            mamaId: mamaId,
            mama: mama,
            childName: childName,
            amount: amount,
            reason: reason,
            dialogue: dialogue
        };
    }
    
    /**
     * Check baby baller event without daily limit (for anti-spam flow)
     */
    function checkBabyBallerEventNoLimit(ctx, gameDay) {
        if (!ctx.babyBallers || ctx.babyBallers.length === 0) {
            return null;
        }
        
        // Pick a random child
        var childIndex = Math.floor(Math.random() * ctx.babyBallers.length);
        var child = ctx.babyBallers[childIndex];
        
        // Find an applicable event
        var relationship = child.relationship || 50;
        var selected = selectWeightedEvent(BABY_BALLER_EVENTS, function(evt) {
            if (evt.minRelationship !== undefined && relationship < evt.minRelationship) return false;
            if (evt.maxRelationship !== undefined && relationship > evt.maxRelationship) return false;
            if (evt.requiresNemesis && !child.isNemesis) return false;
            return true;
        });
        
        if (!selected) return null;
        
        var dialogue = formatDialogue(pickRandom(selected.event.dialogue), {
            name: child.name || child.nickname || "Your kid",
            nickname: child.nickname || child.name || "Junior"
        });
        
        return {
            type: "baby_baller",
            eventKey: selected.key,
            event: selected.event,
            childId: child.id,
            child: child,
            dialogue: dialogue
        };
    }
    
    /**
     * Show a general anti-spam event (works for all players)
     */
    function showAntiSpamEvent(ctx, gameDay) {
        // Select a weighted random event
        var keys = Object.keys(ANTI_SPAM_EVENTS);
        var totalWeight = 0;
        for (var i = 0; i < keys.length; i++) {
            totalWeight += ANTI_SPAM_EVENTS[keys[i]].weight || 1;
        }
        
        var roll = Math.random() * totalWeight;
        var cumulative = 0;
        var selectedKey = keys[0];
        
        for (var j = 0; j < keys.length; j++) {
            cumulative += ANTI_SPAM_EVENTS[keys[j]].weight || 1;
            if (roll < cumulative) {
                selectedKey = keys[j];
                break;
            }
        }
        
        var event = ANTI_SPAM_EVENTS[selectedKey];
        
        // Load TalkShowView
        if (!LORB.UI || !LORB.UI.TalkShowView) {
            load("/sbbs/xtrn/nba_jam/lib/lorb/ui/talk_show_view.js");
        }
        
        if (!LORB.UI || !LORB.UI.TalkShowView || !LORB.UI.TalkShowView.present) {
            if (typeof debugLog === "function") debugLog("[ANTI_SPAM] TalkShowView failed to load");
            return null;
        }
        
        if (typeof debugLog === "function") debugLog("[ANTI_SPAM] Showing event: " + selectedKey);
        
        // Show the talk show event
        LORB.UI.TalkShowView.present({
            eventType: "anti_spam",
            eventSubtype: selectedKey,
            splashText: event.title,
            hostKey: event.hostKey,
            dialogueLines: event.dialogue,
            choices: []  // Press any key
        });
        
        // Apply effects
        var result = { success: true };
        if (event.effect) {
            if (event.effect.cash) {
                ctx.cash = (ctx.cash || 0) + event.effect.cash;
                if (ctx.cash < 0) ctx.cash = 0;
                result.cashChange = event.effect.cash;
            }
            if (event.effect.rep) {
                ctx.rep = (ctx.rep || 0) + event.effect.rep;
                if (ctx.rep < 0) ctx.rep = 0;
                result.repChange = event.effect.rep;
            }
        }
        
        return result;
    }
    
    // ========== EXPORT ==========
    
    LORB.Data = LORB.Data || {};
    LORB.Data.BabyEvents = {
        // Check functions
        checkBabyMamaEvent: checkBabyMamaEvent,
        checkBabyBallerEvent: checkBabyBallerEvent,
        checkSpouseRetaliationEvent: checkSpouseRetaliationEvent,
        checkForRandomEvent: checkForRandomEvent,
        
        // Anti-spam (Find Another consequences)
        checkAntiSpamEvent: checkAntiSpamEvent,
        
        // Processing
        processEventChoice: processEventChoice,
        
        // UI
        showEventRichView: showEventRichView,
        showEventResult: showEventResult,
        
        // Main entry (for narrative events at town entry)
        checkAndShowEvent: checkAndShowEvent,
        
        // Constants (for testing/extension)
        BABY_MAMA_EVENTS: BABY_MAMA_EVENTS,
        BABY_BALLER_EVENTS: BABY_BALLER_EVENTS,
        SPOUSE_RETALIATION_EVENTS: SPOUSE_RETALIATION_EVENTS,
        ANTI_SPAM_EVENTS: ANTI_SPAM_EVENTS
    };
    
})();
