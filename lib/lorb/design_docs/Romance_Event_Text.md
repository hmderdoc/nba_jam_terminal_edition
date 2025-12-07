# Romance Event Text (Legend of the Red Bull)

This file contains **sample event text** for nightclub romance encounters in *Legend of the Red Bull*.  
Claude Opus should treat these as **templates**, expanding/rewriting as needed while preserving tone.

Tone guidance:
- Light, humorous, slightly chaotic
- Basketball-flavored references
- Respectful toward celebrities & fictional characters
- No crude or explicit content
- Quick, punchy lines suitable for BBS text interfaces

---

# 1. Nightclub Introduction Lines

These fire when the player enters the **Flirt / Socialize** option.

```
The bass thumps through the floor as neon lights flicker overhead.
Tonight, the vibe at {nightclubName} feels electric.
You scan the room… maybe someone interesting is here tonight.
```

```
{nightclubName} is packed and buzzing.
You feel the swirl of cologne, sweat, and questionable financial decisions.
Someone catches your eye from across the bar…
```

```
A DJ scratches something vaguely resembling music.
The crowd roars as dancers spill onto the floor.
You take a breath. Time to see who’s here tonight.
```

---

# 2. First Encounter (Stranger Status)

Triggered when the player meets a bachelorette for the first time.

```
You spot {npcName} leaning against the bar, swirling a drink like she’s plotting a heist.
She notices you looking and raises an eyebrow. Interesting.
```

```
{npcName} is here tonight—no big deal, just one of the most iconic people on the planet.
She glances your way. You sure you want to walk over there?
```

```
You awkwardly sidle up to {npcName}. She doesn’t look annoyed yet.
Promising start.
```

---

# 3. Successful Flirt Lines

Triggered when flirt outcome = success.

```
You deliver the smoothest line you’ve managed all year.
{npcName} actually laughs—a real one. Affection rises sharply.
```

```
Your charm is on fire tonight. {npcName} leans closer, impressed by your swagger.
```

```
You and {npcName} fall into easy conversation about hoops, nightlife, and terrible mascots.
She seems genuinely interested.
```

```
You tell a story about dropping 28 in streetball last week.
{npcName} smirks. “Maybe you’re not just talk.”
```

---

# 4. Neutral Flirt Lines

Triggered when flirt outcome = neutral.

```
You talk about basketball for a few minutes. It's fine. Not amazing. Not terrible.
{npcName} nods politely.
```

```
{npcName} seems mildly entertained but checks her phone once or twice.
You can’t tell if that’s good or bad.
```

```
Conversation goes… okay.
You didn’t embarrass yourself. You also didn’t become a legend.
```

---

# 5. Fail / Awkward Flirt Lines

Triggered when flirt outcome = fail.

```
You attempt a joke.
{npcName} blinks twice and says, “Anyway…”
Ouch.
```

```
You try a pickup line you definitely shouldn’t have.
{npcName} grimaces like you just airballed a layup.
```

```
You talk for a bit, but it’s clunky.
Very clunky.
She excuses herself to “take a call.” You know what that means.
```

---

# 6. Status Advancement Lines

### Acquaintance → Crush

```
{npcName} smiles when she sees you now. Things are warming up.
```

```
She remembers your name. That's progress worth celebrating.
```

### Crush → Partner

```
There’s a spark between you and {npcName}. Everyone else in the club fades out.
```

```
She leans in close, brushing your shoulder with her hand. This is definitely a thing now.
```

### Partner → Fiancé(e)

```
{npcName} tells you she feels something real.
The room goes quiet in your head for a moment.
```

```
You and {npcName} are inseparable tonight. People start whispering about you two.
```

---

# 7. Marriage Proposal Lines

Triggered when player chooses **P) Propose Marriage**.

Successful proposal:

```
You kneel (or something vaguely like kneeling in a crowded nightclub).
{npcName}'s eyes widen… then soften.
“Yes,” she says simply.
You are now married.
```

```
The DJ notices what’s happening and cuts the music.
A spotlight hits you and {npcName}.
She accepts your proposal, and the crowd erupts in cheers.
```

Failed proposal (NPC already married globally):

```
You start your speech, but {npcName} gently places a hand on your shoulder.
“I’m flattered,” she says, “but I’m already with someone.”
The club suddenly feels colder.
```

```
{npcName} looks away, conflicted.
“I can’t,” she says quietly. “My heart belongs to someone else.”
```

---

# 8. Spouse-Specific Perk/Event Text (Optional)

Nightly bonus:

```
Before you leave the club, your spouse {npcName} gives you a confidence boost.
You feel refreshed. (Stamina restored.)
```

Small temporary buff:

```
A supportive message from {npcName} hits your phone:
“Go dominate tonight.”
You feel sharper than usual. (Minor stat bonus.)
```

Gift event:

```
{npcName} surprises you with a small wrapped box.
Inside: {itemName}. “Thought you’d like it.”
```

---

# Notes for Claude / Coding Agent

- These are **templates**, not mandatory static strings.
- Replace `{npcName}`, `{cityName}`, `{nightclubName}`, etc.
- Keep lines short (≤ 78 characters) for BBS compatibility.
- When generating new lines, maintain:
  - Non-explicit flirtation
  - Basketball/nightlife flavor
  - Variety for replayability (cycle text variations)
- Treat this file as a guidance corpus.

# END OF FILE
