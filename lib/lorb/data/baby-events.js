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
        
        // Check daily event limit
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
        
        var eventChance = getConfig("BABY_MAMA_EVENT_CHANCE", 0.20);
        
        // Check each baby mama for event trigger
        var babyMamaIds = Object.keys(ctx.babyMamas);
        for (var i = 0; i < babyMamaIds.length; i++) {
            var mamaId = babyMamaIds[i];
            var mama = ctx.babyMamas[mamaId];
            
            // Rate limit per baby mama
            if (mama.lastEventDay && mama.lastEventDay === gameDay) {
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
        
        // Check daily event limit
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
        
        var eventChance = getConfig("CHILD_CHALLENGE_CHANCE", 0.15);
        
        // Check each child for event trigger
        for (var i = 0; i < ctx.babyBallers.length; i++) {
            var child = ctx.babyBallers[i];
            
            // Rate limit per child
            if (child.lastEventDay && child.lastEventDay === gameDay) {
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
        var forceRetaliation = !!getConfig("FORCE_SPOUSE_RETALIATION", false);
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
        
        // Check daily event limit
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
        
        // Rate limit: check last spouse event
        if (!forceRetaliation && ctx.lastSpouseRetaliationDay && gameDay - ctx.lastSpouseRetaliationDay < 5) {
            return null;  // At least 5 days between spouse events
        }
        
        // Chance of spouse retaliation event
        var retaliationChance = forceRetaliation ? 1.0 : getConfig("SPOUSE_RETALIATION_CHANCE", 0.20);
        if (!forceRetaliation && Math.random() > retaliationChance) {
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
        
        if (selected.event.rivals) {
            var rivalPlayer = getRandomCharacterWithData();
            if (rivalPlayer) {
                rival = rivalPlayer.name;
                eventData.rivalArt = rivalPlayer.path;
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
            rivalArt: (rivalPlayer && rivalPlayer.path) ? rivalPlayer.path : null,
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
        // Check for spouse retaliation first (if married and cheating)
        var spouseEvent = checkSpouseRetaliationEvent(ctx, gameDay);
        if (spouseEvent) return spouseEvent;
        
        // 50/50 chance to check baby mama or baby baller first
        if (Math.random() < 0.5) {
            var mamaEvent = checkBabyMamaEvent(ctx, gameDay);
            if (mamaEvent) return mamaEvent;
            return checkBabyBallerEvent(ctx, gameDay);
        } else {
            var ballerEvent = checkBabyBallerEvent(ctx, gameDay);
            if (ballerEvent) return ballerEvent;
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
        
        if (typeof debugLog === "function") debugLog("[BABY_EVENTS] Calling TalkShowView.present for " + eventData.type);
        
        var tvResult = LORB.UI.TalkShowView.present({
            dialogueLines: dialogueLines,
            choices: choices,
            guestArt: eventData.rivalArt || null,
            guestName: eventData.rival || null
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
     * Legacy text-based event display (fallback when TalkShowView unavailable)
     */
    function showEventLegacy(eventData, ctx, gameDay) {
        LORB.View.clear();
        
        var title = eventData.type === "baby_mama" ? "BABY MAMA DRAMA!" : "YOUR KID APPEARS!";
        LORB.View.header(title);
        LORB.View.line("");
        LORB.View.line(eventData.dialogue);
        LORB.View.line("");
        
        if (eventData.amount > 0) {
            LORB.View.line("\1cYour cash: \1y$" + (ctx.cash || 0) + "\1n");
            LORB.View.line("");
        }
        
        LORB.View.line("\1h\1yWhat do you do?\1n");
        LORB.View.line("");
        
        var choices = eventData.event.choices;
        for (var i = 0; i < choices.length; i++) {
            var choiceText = choices[i].text;
            if (choices[i].cost) {
                choiceText += " ($" + choices[i].cost + ")";
            } else if (choices[i].effect === "pay" && eventData.amount) {
                choiceText += " ($" + eventData.amount + ")";
            } else if (choices[i].effect === "half" && eventData.amount) {
                choiceText += " ($" + Math.floor(eventData.amount / 2) + ")";
            }
            LORB.View.line("[" + choices[i].key + "] " + choiceText);
        }
        
        // Get player choice
        var selectedChoice = null;
        while (!selectedChoice) {
            var key = console.getkey().toUpperCase();
            for (var i = 0; i < choices.length; i++) {
                if (choices[i].key === key) {
                    selectedChoice = choices[i];
                    break;
                }
            }
        }
        
        // Process the choice
        var result = processEventChoice(ctx, eventData, selectedChoice, gameDay);
        
        // Show result
        showEventResult(result, eventData, selectedChoice);
        
        return result;
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
    
    // ========== EXPORT ==========
    
    LORB.Data = LORB.Data || {};
    LORB.Data.BabyEvents = {
        // Check functions
        checkBabyMamaEvent: checkBabyMamaEvent,
        checkBabyBallerEvent: checkBabyBallerEvent,
        checkSpouseRetaliationEvent: checkSpouseRetaliationEvent,
        checkForRandomEvent: checkForRandomEvent,
        
        // Processing
        processEventChoice: processEventChoice,
        
        // UI
        showEventRichView: showEventRichView,
        showEventLegacy: showEventLegacy,
        showEventResult: showEventResult,
        
        // Main entry
        checkAndShowEvent: checkAndShowEvent,
        
        // Constants (for testing/extension)
        BABY_MAMA_EVENTS: BABY_MAMA_EVENTS,
        BABY_BALLER_EVENTS: BABY_BALLER_EVENTS,
        SPOUSE_RETALIATION_EVENTS: SPOUSE_RETALIATION_EVENTS
    };
    
})();
