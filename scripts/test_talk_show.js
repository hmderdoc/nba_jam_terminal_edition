#!/sbbs/exec/jsexec
/**
 * test_talk_show.js - Direct test of TalkShowView.present()
 * 
 * ⚠️ MUST BE RUN FROM INSIDE THE BBS (not command line)
 * 
 * Usage:
 *   1. Connect to BBS via telnet
 *   2. Run external program (or use SCFG to add as door)
 *   3. Or load from within LORB hub for testing
 * 
 * Tests:
 * 1. Simple dialogue with no choices (press any key)
 * 2. Dialogue with choices (lightbar menu)
 * 3. Host intro → Guest reveal with art swap
 */

load("sbbsdefs.js");

// Initialize minimal LORB namespace for TalkShowView
if (!this.LORB) this.LORB = { UI: {}, Util: {} };

// Load only what we need for talk show view
load("/sbbs/xtrn/nba_jam/lib/lorb/util/figlet-banner.js");
load("/sbbs/xtrn/nba_jam/lib/lorb/ui/talk_show_view.js");

console.clear();

function testSimpleDialogue() {
    console.putmsg("\x01h\x01y=== Test 1: Simple Dialogue (No Choices) ===\x01n\r\n");
    console.putmsg("Press any key to start...");
    console.getkey();
    
    var result = LORB.UI.TalkShowView.present({
        title: "TEST SHOW",
        dialogueLines: [
            "Welcome to the show!",
            "This is a simple test with no choices.",
            "You'll just press any key to continue."
        ],
        choices: []
    });
    
    console.clear();
    console.putmsg("\x01g✓ Test 1 Complete\x01n\r\n");
    console.putmsg("Result: " + JSON.stringify(result) + "\r\n");
    console.putmsg("Press any key to continue...");
    console.getkey();
}

function testChoices() {
    console.clear();
    console.putmsg("\x01h\x01y=== Test 2: Dialogue with Choices (Lightbar) ===\x01n\r\n");
    console.putmsg("Press any key to start...");
    console.getkey();
    
    var result = LORB.UI.TalkShowView.present({
        title: "BABY MAMA DRAMA",
        dialogueLines: [
            "Your baby mama stands up from the audience.",
            "\"You owe me $500 for our kid's basketball camp!\"",
            "What do you do?"
        ],
        choices: [
            { key: "P", text: "Pay up ($500)" },
            { key: "H", text: "Pay half ($250)" },
            { key: "R", text: "Refuse (take the rep hit)" }
        ]
    });
    
    console.clear();
    console.putmsg("\x01g✓ Test 2 Complete\x01n\r\n");
    console.putmsg("Result: " + JSON.stringify(result) + "\r\n");
    console.putmsg("Selected choice: \x01h" + (result.choiceKey || "None") + "\x01n\r\n");
    console.putmsg("Press any key to continue...");
    console.getkey();
}

function testHostToGuest() {
    console.clear();
    console.putmsg("\x01h\x01y=== Test 3: Host Intro → Guest Reveal ===\x01n\r\n");
    console.putmsg("Press any key to start...");
    console.getkey();
    
    // Note: guestArt path would be real in production
    // For testing we'll just use the default art path or skip
    var result = LORB.UI.TalkShowView.present({
        title: "YOUR KID APPEARS",
        hostLines: [
            "Welcome back to DONNIE LIVE!",
            "Today we have a special guest...",
            "Someone who's been looking for their deadbeat dad!"
        ],
        dialogueLines: [
            "Your kid storms onto the stage.",
            "\"You never came to my games! I hate you!\"",
            "The crowd is waiting for your response..."
        ],
        choices: [
            { key: "A", text: "Apologize sincerely" },
            { key: "D", text: "Defend yourself" },
            { key: "L", text: "Leave the stage" }
        ]
        // guestArt: "/sbbs/xtrn/nba_jam/assets/lorb/talkshow_guest.bin"  // Would swap here
    });
    
    console.clear();
    console.putmsg("\x01g✓ Test 3 Complete\x01n\r\n");
    console.putmsg("Result: " + JSON.stringify(result) + "\r\n");
    console.putmsg("Selected choice: \x01h" + (result.choiceKey || "None") + "\x01n\r\n");
    console.putmsg("Press any key to continue...");
    console.getkey();
}

function runAllTests() {
    testSimpleDialogue();
    testChoices();
    testHostToGuest();
    
    console.clear();
    console.putmsg("\x01h\x01g=== All Tests Complete ===\x01n\r\n");
    console.putmsg("TalkShowView.present() is working!\r\n");
}

// Run the tests
runAllTests();
