/**
 * talk-shows.js - Talk Show Host Configuration and Event Mapping
 * 
 * Defines talk show hosts with distinct personalities, art, catchphrases,
 * and maps event types to appropriate hosts for maximum dramatic effect.
 * 
 * Returns a TalkShowConfig object directly - no IIFE, no global namespace games.
 * Consumer is responsible for storing the reference.
 */

var ART_PATH = "/sbbs/xtrn/nba_jam/assets/lorb/";

// ========== HOST DEFINITIONS ==========

var TalkShowHosts = {
    
    // JERRY SPRINGER - Maximum drama, confrontations, infidelity reveals
    springer: {
        name: "SPRUNG!",
        host: "Jerry S.",
        art: ART_PATH + "talkshow_sprung.bin",
        style: "dramatic",
        bonusType: "drama",
        catchphrases: {
            intro: [
                "Welcome back to SPRUNG! Today's show... you might want to sit down for this one.",
                "On today's SPRUNG: Lies, betrayal, and a whole lotta baby drama!",
                "Our next guest has something to tell you... and you're NOT gonna like it."
            ],
            reveal: [
                "\1r*AUDIENCE GASPS*\1n",
                "\1cSECURITY!\1n",
                "\1y*chairs start flying*\1n"
            ],
            reactions: {
                angry: "Whoa whoa whoa! Let's calm down here!",
                sad: "Hey now, tissues are under your seat...",
                fight: "SECURITY! We got a runner!"
            },
            outro: [
                "Until next time... take care of yourselves, and each other.",
                "Final thought: Maybe don't have babies with everyone you meet?",
                "That's all the drama we have time for. See you next time on SPRUNG!"
            ]
        },
        dialogueStyle: {
            pauseAfterReveal: true,
            audienceReactions: true,
            dramaticTiming: true
        }
    },
    
    // ARSENIO HALL - Cool factor, rep bonuses, money talk
    arsenio: {
        name: "LATE NIGHT BALL",
        host: "Arsenio H.",
        art: ART_PATH + "talkshow_arsenio.bin",
        style: "cool",
        bonusType: "rep",
        catchphrases: {
            intro: [
                "*WOOF WOOF WOOF WOOF*",
                "Everybody give it up for our next guest - a real baller!",
                "You know what time it is? It's time to talk about that MONEY!"
            ],
            hype: [
                "\1c*crowd goes wild*\1n",
                "\1y*arm pump* WOOF WOOF!\1n",
                "\1g*standing ovation*\1n"
            ],
            reactions: {
                money: "Now THAT'S what I'm talking about! Get that paper!",
                cool: "Smooth move, my friend. Smooth move.",
                rep: "Your rep just went through the ROOF!"
            },
            outro: [
                "You're definitely one of the cool kids now!",
                "Keep ballin', my friend. Keep ballin'.",
                "*WOOF WOOF* That's all we got! Peace!"
            ]
        },
        dialogueStyle: {
            audienceChants: true,
            upbeatTone: true,
            repMultiplier: 1.25
        }
    },
    
    // OPRAH - Philosophical, karma/alignment, deep questions
    oprah: {
        name: "OPAL",
        host: "Opal Win",
        art: ART_PATH + "talkshow_opal.bin",
        style: "thoughtful",
        bonusType: "karma",
        catchphrases: {
            intro: [
                "Welcome. Today, we're going to have a real conversation about choices.",
                "Every decision shapes who we become. Let's explore that together.",
                "I want you to look deep inside yourself for this one..."
            ],
            wisdom: [
                "\1m\"The greatest discovery is that you can change your future.\"\1n",
                "\1c\"Be thankful for what you have; you'll end up having more.\"\1n",
                "\1y\"Turn your wounds into wisdom.\"\1n"
            ],
            reactions: {
                good: "That took courage. I'm proud of you.",
                bad: "We all make mistakes. The question is: what do you learn from this?",
                thoughtful: "Now THAT is the kind of growth I love to see."
            },
            outro: [
                "Remember: Live your best life. You get a car! Everyone gets a car!",
                "Go forth and make better choices. The universe is watching.",
                "Thank you for your honesty today. That's the first step to healing."
            ]
        },
        dialogueStyle: {
            contemplativePauses: true,
            alignmentFocus: true,
            karmaMultiplier: 1.5
        }
    },
    
    // DR. PHIL - Family disputes, child issues, tough love
    drphil: {
        name: "DR. FEEL",
        host: "Dr. Feel",
        art: ART_PATH + "talkshow_drfeel.bin",
        style: "confrontational",
        bonusType: "family",
        catchphrases: {
            intro: [
                "Let me tell you something - and I want you to hear this:",
                "You know what your problem is? I'll tell you what your problem is.",
                "We're gonna get REAL today. No more excuses."
            ],
            realityCheck: [
                "\1r\"How's that workin' out for ya?\"\1n",
                "\1y\"You can't change what you don't acknowledge.\"\1n",
                "\1c\"Get real! This ain't my first rodeo.\"\1n"
            ],
            reactions: {
                good: "NOW we're getting somewhere! That's what a real parent does.",
                bad: "And how's that working out for ya? Exactly.",
                neglect: "That child NEEDS you. Step up or step out."
            },
            outro: [
                "Now go out there and be the parent that kid deserves.",
                "We're done here. You know what you need to do.",
                "I've given you the tools. Now USE them."
            ]
        },
        dialogueStyle: {
            directConfrontation: true,
            familyFocus: true,
            childBonusMultiplier: 1.25
        }
    },
    
    // GERALDO - Investigative reports, exposés, no choice (just reveals)
    geraldo: {
        name: "GERALDO REPORT",
        host: "Geraldo R.",
        art: ART_PATH + "talkshow_geraldo.bin",
        style: "investigative",
        bonusType: "scandal",
        catchphrases: {
            intro: [
                "BREAKING NEWS: We have uncovered something EXPLOSIVE.",
                "Our investigative team has been working on this for months...",
                "What you're about to see will SHOCK you."
            ],
            dramatic: [
                "\1r*EXCLUSIVE FOOTAGE*\1n",
                "\1y*dramatic music intensifies*\1n",
                "\1c*documents shuffle*\1n"
            ],
            reactions: {
                exposed: "The evidence is RIGHT HERE. You can't deny this.",
                scandal: "This is going to be all over the news tomorrow.",
                reveal: "And THAT is the truth they didn't want you to know."
            },
            outro: [
                "The people have a right to know. Geraldo Rivera, signing off.",
                "Stay tuned for more explosive revelations.",
                "That's all the dirt we have time for today. But there's always more..."
            ]
        },
        dialogueStyle: {
            noChoiceReveal: true,
            dramaticBuildup: true,
            scandalFocus: true
        }
    },
    
    // SALLY JESSE RAPHAEL - Emotional reunions, relationship healing
    sally: {
        name: "SALLY SCOOP",
        host: "Sally S.",
        art: ART_PATH + "talkshow_sally.bin",
        style: "empathetic",
        bonusType: "relationship",
        catchphrases: {
            intro: [
                "Today's show is about second chances and healing old wounds.",
                "I've brought someone here who wants to reconnect with you...",
                "Let's talk about what happened and how we can move forward."
            ],
            emotional: [
                "\1m*audience wipes tears*\1n",
                "\1c*heartfelt music plays*\1n",
                "\1y*Sally adjusts her red glasses*\1n"
            ],
            reactions: {
                forgive: "That's beautiful. Forgiveness is the first step.",
                reject: "I understand it hurts, but are you sure?",
                reunion: "There's nothing more powerful than family coming back together."
            },
            outro: [
                "Remember: It's never too late to say 'I'm sorry.'",
                "Healing takes time, but you've taken the first step today.",
                "Love is stronger than pride. Think about that."
            ]
        },
        dialogueStyle: {
            emotionalMoments: true,
            relationshipFocus: true,
            relationshipMultiplier: 1.5
        }
    },
    
    // DONAHUE (generic/fallback) - General talk show, balanced
    donahue: {
        name: "DONNIE LIVE",
        host: "Donnie Q",
        art: ART_PATH + "talkshow_donnie.bin",
        style: "balanced",
        bonusType: "balanced",
        catchphrases: {
            intro: [
                "Welcome to the show. Let's hear what our audience thinks!",
                "Today's topic has everyone talking...",
                "We've got a fascinating guest with quite a story!"
            ],
            audience: [
                "\1c*audience member stands up*\1n",
                "\1y*applause*\1n",
                "\1w*murmurs from crowd*\1n"
            ],
            reactions: {
                agree: "The audience seems to agree with you!",
                disagree: "Well, that's certainly one way to look at it...",
                neutral: "Interesting perspective. Let's see what happens next."
            },
            outro: [
                "That's all we have time for today!",
                "Join us next time for more fascinating stories!",
                "Thanks for watching - you've been a great audience!"
            ]
        },
        dialogueStyle: {
            audienceParticipation: true,
            balanced: true
        }
    },
    
    // RICKI LAKE - Young, hip, relationship drama
    ricki: {
        name: "RICKI REAL TALK",
        host: "Ricki Blaze",
        art: ART_PATH + "talkshow_ricki.bin",
        style: "energetic",
        bonusType: "drama",
        catchphrases: {
            intro: [
                "Okay okay okay, let me get this straight...",
                "Girl, you are NOT gonna believe what I found out!",
                "Hold up - we got some TEA to spill today!"
            ],
            hype: [
                "\1m*snaps fingers*\1n",
                "\1y*crowd hoots*\1n",
                "\1g\"RICKI! RICKI! RICKI!\"\1n"
            ],
            reactions: {
                drama: "OH NO SHE DIDN'T!",
                support: "You go girl! That's what I'm talking about!",
                shock: "Wait wait wait - say that again?!"
            },
            outro: [
                "That's all the drama for today! Stay real, everyone!",
                "Remember: Be true to yourself! RICKI OUT!",
                "Until next time - keep it 100!"
            ]
        },
        dialogueStyle: {
            fastPaced: true,
            youthfulEnergy: true
        }
    }
};

// ========== EVENT TYPE TO HOST MAPPING ==========

var TalkShowEventHostMap = {
    // Baby mama events
    "baby_mama.money_demand": ["donahue", "ricki"],
    "baby_mama.gossip_threat": ["sally", "ricki"],
    "baby_mama.legal_action": ["geraldo", "drphil"],
    "baby_mama.new_dad": ["springer", "geraldo"],
    "baby_mama.custody_challenge": ["drphil", "geraldo"],
    
    // Spouse retaliation events  
    "spouse_retaliation.confrontation": ["springer", "drphil"],
    "spouse_retaliation.sabotage": ["geraldo", "springer"],
    "spouse_retaliation.revenge_baby": ["springer"],
    "spouse_retaliation.hidden_support": ["geraldo", "drphil"],
    
    // Baby baller events
    "baby_baller.play_request": ["arsenio", "donahue"],
    "baby_baller.advice": ["oprah", "drphil"],
    "baby_baller.gift_request": ["sally", "ricki"],
    "baby_baller.school_issue": ["drphil", "oprah"],
    "baby_baller.first_game": ["arsenio", "donahue"],
    "baby_baller.parent_visit": ["sally", "oprah"],
    "baby_baller.nemesis_challenge": ["springer", "arsenio"],
    "baby_baller.adoption_request": ["oprah", "sally"],
    
    // Special events
    "nba_encounter": ["arsenio", "geraldo"],
    "scandal": ["geraldo", "springer"],
    "reconciliation": ["sally", "oprah"],
    "money_opportunity": ["arsenio", "donahue"],
    "moral_choice": ["oprah", "drphil"],
    
    // Anti-spam events (Find Another consequences)
    "anti_spam": ["geraldo", "springer"],
    "anti_spam.reporter_ambush": ["geraldo"],
    "anti_spam.heckler": ["springer"],
    "anti_spam.scout_notice": ["arsenio"],
    "anti_spam.pickpocket": ["geraldo"],
    "anti_spam.breaking_news": ["geraldo"],
    "anti_spam.dropped_cash": ["oprah"],
    "anti_spam.impressed_fan": ["arsenio"]
};

// ========== SPLASH SCREEN TEXT MAPPING ==========

var TalkShowSplashText = {
    "baby_mama": ["BABY MAMA DRAMA", "IT'S ABOUT TO GET REAL", "INCOMING!"],
    "spouse_retaliation": ["BETRAYAL!", "YOUR PAST CATCHES UP", "KARMA TIME"],
    "baby_baller": ["YOUR KID APPEARS!", "FAMILY MATTERS", "DADDY TIME"],
    "anti_spam": ["WAIT A MINUTE!", "HOLD UP!", "NOT SO FAST!"],
    "scandal": ["EXPOSED!", "BREAKING NEWS", "SCANDAL ALERT"],
    "confrontation": ["SHOWDOWN!", "FACE TO FACE", "IT'S ON!"],
    "money": ["CASH RULES", "PAY UP!", "$$$ TIME"],
    "reconciliation": ["SECOND CHANCES", "HEALING TIME", "COME TOGETHER"]
};

// ========== HELPER FUNCTIONS ==========

function TalkShow_pick(arr) {
    if (!arr || arr.length === 0) return "";
    return arr[Math.floor(Math.random() * arr.length)];
}

function TalkShow_getHostForEvent(eventType, eventSubtype) {
    var key = eventType + "." + eventSubtype;
    var hostList = TalkShowEventHostMap[key];
    
    if (!hostList) {
        hostList = TalkShowEventHostMap[eventType];
    }
    
    if (hostList && hostList.length > 0) {
        var hostKey = hostList[0];
        if (hostList.length > 1 && Math.random() < 0.3) {
            hostKey = hostList[1];
        }
        if (TalkShowHosts[hostKey]) {
            return TalkShowHosts[hostKey];
        }
    }
    
    return TalkShowHosts.donahue;
}

function TalkShow_getSplashText(eventType, eventSubtype) {
    var texts = TalkShowSplashText[eventType] || TalkShowSplashText[eventSubtype];
    if (texts && texts.length > 0) {
        return texts[Math.floor(Math.random() * texts.length)];
    }
    return "BREAKING NEWS";
}

function TalkShow_getHost(key) {
    return TalkShowHosts[key] || TalkShowHosts.donahue;
}

function TalkShow_getAllHosts() {
    var result = [];
    for (var key in TalkShowHosts) {
        if (TalkShowHosts.hasOwnProperty(key)) {
            result.push(TalkShowHosts[key]);
        }
    }
    return result;
}

function TalkShow_getHostIntro(hostKey) {
    var host = TalkShowHosts[hostKey] || TalkShowHosts.donahue;
    return TalkShow_pick(host.catchphrases.intro);
}

function TalkShow_getHostOutro(hostKey) {
    var host = TalkShowHosts[hostKey] || TalkShowHosts.donahue;
    return TalkShow_pick(host.catchphrases.outro);
}

function TalkShow_getHostReaction(hostKey, reactionType) {
    var host = TalkShowHosts[hostKey] || TalkShowHosts.donahue;
    if (host.catchphrases.reactions && host.catchphrases.reactions[reactionType]) {
        return host.catchphrases.reactions[reactionType];
    }
    return "";
}

// ========== EXPORT: TalkShowConfig object ==========
// This is what consumers should capture and use

var TalkShowConfig = {
    HOSTS: TalkShowHosts,
    getHost: TalkShow_getHost,
    getAllHosts: TalkShow_getAllHosts,
    
    EVENT_HOST_MAP: TalkShowEventHostMap,
    getHostForEvent: TalkShow_getHostForEvent,
    
    SPLASH_TEXT: TalkShowSplashText,
    getSplashText: TalkShow_getSplashText,
    
    getHostIntro: TalkShow_getHostIntro,
    getHostOutro: TalkShow_getHostOutro,
    getHostReaction: TalkShow_getHostReaction,
    pick: TalkShow_pick
};
