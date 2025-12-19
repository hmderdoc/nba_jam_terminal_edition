# Event Testing Cheatsheet (Deterministic Triggers)

Quick ways to force events so you can verify behavior/visuals.

## Spouse Events
- Out-of-wedlock (RichView “BUSTED AT THE HOSPITAL”): Be married, then finish a doctor visit with a non-spouse mother. Fires right after the birth announcement.
- Caught with wrong companion: Enter spouse’s home city with any companion who isn’t the spouse; triggers on hub entry.
- Caught flirting: Go to Club 23 in spouse’s home city and pick a flirt; triggers before the flirt attempt.

## Nemesis / Child Encounters
- Nemesis cooldown check: Beat a nemesis child at any court; see cooldown line and they won’t reappear until next game day.
- Adoption offer: Beat an abandoned child (not yours) in a court match; adoption prompt appears after the result screen.
- Random baby baller events (play request, advice, progress, nemesis confrontation, adoption reveal): Enter a court and use “Find Another” a few times. For deterministic testing, temporarily set `CHILD_CHALLENGE_CHANCE` to 1.0 in config and clear `dailyBabyEvents`/`lastEventDay` on ctx, then hit “Find Another.”

## Baby Mama / Spouse Retaliation
- Baby mama randoms (money demand, gossip, drama, good news, ultimatum): Same “Find Another” flow. Set `BABY_MAMA_EVENT_CHANCE` to 1.0 and clear `dailyBabyEvents`/`lastEventDay` to force one. Relationship band matters (ultimatum wants low relationship, good_news wants high).
- Spouse retaliation (confrontation, sabotage, revenge baby, hidden support): Must be married and have at least one non-spouse baby mama. Enter a court; for deterministic, set `SPOUSE_RETALIATION_CHANCE` to 1.0 and clear `lastSpouseRetaliationDay`/`dailyBabyEvents`.

## Admin / Setup Helpers
- Admin menu: option 5 “Set Pregnancy” to create pregnancies; option 8 “Remove Baby Ballers” to prune test kids.
- State reset: clear `ctx.dailyBabyEvents`, `ctx.lastSpouseRetaliationDay`, `ctx.defeatedNemesisToday` if you want multiple runs in one session.
- Config nudges for forcing: set chances (`BABY_MAMA_EVENT_CHANCE`, `CHILD_CHALLENGE_CHANCE`, `SPOUSE_RETALIATION_CHANCE`) to 1.0 temporarily, then enter a court and use “Find Another” to trigger.

## Art / View Notes
- Doctor/pregnancy/birth news use RichView with `assets/lorb/doc_vitale.bin` on the left.
- Spouse events now use RichView but currently show only text art (“♥ DRAMA ♥ / Spouse Fury”) on the left; no .bin art is wired yet. Good spot to drop a spouse-drama bin if/when created.
- Baby mama/child random events (baby-events.js) use RichView with a header bar; no art bin is used.
- Court encounter/result screens use RichView; no dedicated event art bins there.
- General pattern to match: RichView with an 80x4 header; figlet banners available via `LORB.Util.FigletBanner.renderToFrame`.

## Temporary Test Toggles (remember to revert)
- `FORCE_SPOUSE_RETALIATION` (config flag) is off by default; turn it on to bypass cooldown/chance, but reset after testing.
- Event caps: `MAX_RANDOM_EVENTS_PER_DAY` defaults to 1; raising it allows multiple events per game day—remember to revert.
- Chance overrides: setting `BABY_MAMA_EVENT_CHANCE`/`CHILD_CHALLENGE_CHANCE`/`SPOUSE_RETALIATION_CHANCE` to 1.0 forces rolls; restore defaults after testing.
