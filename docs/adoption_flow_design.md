# Adoption Flow (Baby Ballers)

Goal: Allow abandoned baby ballers to be adopted by another player via on-court encounters, using RichView UX and keeping core overdue logic intact.

## States
- `isAbandoned`: set when relationship <= `ADOPTION_THRESHOLD` and support is overdue; stops further deadline decay.
- `isOverdue`: remains true on abandoned kids for clarity; they no longer accrue daily decay but are adoption-eligible.
- `adoptiveFatherId/Name`: set on adoption.
- `originalParentId`: tracked on the baby for history; original parent context no longer keeps the child record.

## Triggers
1. **Abandonment**: when `adjustRelationship` drops below `ADOPTION_THRESHOLD`, mark `childSupport.isAbandoned = true` and keep `isOverdue = true`. (Existing code.)
2. **Encounter**: Abandoned babies can appear as street opponents via the world registry. If the player beats an abandoned baby baller, an adoption prompt shows in the post-game RichView.

## Adoption UX (RichView)
- After winning vs. an abandoned baby: prompt “Adopt?” with `[A]dopt / [L]eave`.
- On adopt:
  - Clone baby into adopter’s context.
  - Reset support: not overdue/abandoned, new `dueDate` = today + `SUPPORT_DEADLINE_DAYS`.
  - Relationship reset to 25; not nemesis.
  - Set `adoptiveFatherId/Name`; preserve `originalParentId` if known.
  - Remove from world registry so it stops spawning as abandoned.
- On leave: no change; baby remains in registry for others.

## Not in scope (left for future/content polish)
- Narrative/art polish for the adoption scene.
- Additional consequences (late fees for new parent, emotional events, etc.).
- Explicit removal from original parent save (would require cross-user state).

## Files touched
- `lib/lorb/data/baby-ballers.js`: abandonment marking, adopt helper, registry removal, originalParentId tracking.
- `lib/lorb/locations/courts.js`: post-game adoption prompt in RichView.
- `lib/lorb/locations/crib.js`: abandoned status visibility and deadline clarity in payment UI.
