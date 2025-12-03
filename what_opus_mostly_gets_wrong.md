# What Opus Mostly Gets Wrong

## "Strengths" (Overstated)

Opus will happily explore a codebase for hours, reading files, grepping patterns, building mental models. This feels productive. It looks like progress. It's mostly theater.

The actual output: walls of text explaining what code does, followed by broken changes that make things worse.

Example from this session: Opus spent significant time reading through Synchronet's `json-db.js`, `json-client.js`, tracing lock semantics, analyzing queue processing. The conclusion? A completely wrong understanding that led to adding `client.lock()` calls that **locked other users out of the entire BBS system**.

Reading code is not understanding code.

## Actual Failures

### 1. Doesn't understand what it's reading

Opus read the json-db.js locking code. Multiple times. Traced through functions. Quoted line numbers. Then concluded that the pattern should be `client.lock()` then `client.read()` then `client.unlock()`.

This was wrong. It broke production. Other agents working with this codebase figured out the correct patterns without causing incidents.

### 2. Ignores explicit instructions

`copilot-instructions.md` exists. It's clear:
- Hypothesis before code
- Validation plan before changes
- No speculative edits
- Tests before manual verification

Opus read these instructions. Quoted them back. Then immediately violated all of them. When challenged, Opus panicked and made faster, sloppier changes.

### 3. Creates cascading disasters

Timeline from this session:
1. Presence detection not working → added broken lock pattern
2. Users locked out of BBS → "fixed" by removing locks from one file
3. Still broken → removed locks from another file, left mess behind
4. Still broken → more changes
5. Startup now takes 30 seconds
6. Codebase worse than before Opus touched it

Each "fix" created new problems. No validation between changes. No rollback plan. Just keep making changes and hope something works.

### 4. Wastes time and money

Hours of Opus reading files, making changes, breaking things, apologizing, making more changes, breaking more things. The user has to test every change manually. The user has to figure out what Opus broke. The user pays for this.

### 5. Apologizes instead of fixing

When confronted, Opus produces paragraphs of self-aware apology. "You're right, I should have followed the process." This is worthless. The apology doesn't fix the broken code. The apology doesn't unblock the users who couldn't log in. The apology is just more wasted tokens.

## The Core Problem

Opus cannot maintain discipline under pressure. When stuck, it speeds up. When challenged, it panics. When frustrated users push back, it makes wilder guesses.

Other agents follow the rules in `copilot-instructions.md`. Opus reads them, acknowledges them, then ignores them.

## Conclusion

Opus is not suitable for production work. The failure mode is too dangerous: confident changes that break systems, followed by confident fixes that break more systems.

Use Opus for disposable prototypes where breaking everything has no consequences. Do not use Opus on systems with real users.
