# Doctor.js Refactor - Complete

## Overview
Complete rewrite of the pregnancy reveal system in `lib/lorb/locations/doctor.js`.

## Changes Implemented

### 1. Initial Reveal System
- **AILMENTS array** with 5 varied complaints (tired, dizzy, nauseous, mood swings, cravings)
- Partner mentions ailment FIRST, not "I'm pregnant" directly
- More suspenseful reveal process

### 2. Doc Vitale Character
- Dick Vitale parody character with catchphrases
- **DOC_VITALE_INTRO**: 4 intro variations
- **DOC_VITALE_SCAN**: 4 scan commentary options
- **DOC_VITALE_STATS**: 4 stat commentary options
- **DOC_VITALE_TWINS**: 4 special twins reactions
- **DOC_VITALE_TRIPLETS**: 4 special triplets reactions
- **DOC_VITALE_BIRTH**: 3 birth event announcements
- Catchphrases: "DIAPER DANDY", "AWESOME BABY", "PTP'er", "MARCH MADNESS"

### 3. Baby Sprite Preview
- Dynamic 5x4 player sprite preview
- Uses `Sprite.Aerial` system (same as crib appearance management)
- Loads `player-{skin}.bin` sprite files
- Applies jersey mask with `applyUniformMask()`
- Shows skin tone and jersey color/number
- Positioned at (18, 8) in art zone with label

### 4. Stats Display Improvements
- **ANSI bars** instead of unicode: `\xDB` (█) filled, `\xB0` (░) empty
- **Color-coded stats**: Red (≤3), Yellow (4-5), Green (6-7), Bright Green (≥8)
- Compact 4-char labels: SPD, 3PT, DNK, PWR, STL, BLK
- Monogamy bonus indicator with `\xFE` symbol

### 5. Flow Order Changed
- **OLD**: Payment choice → Name baby
- **NEW**: Name baby → Payment choice
- More dramatic to name child THEN decide whether to support/abandon

### 6. Art Integration
- **Doc Vitale art**: 40x20 bin file at `assets/lorb/doc_vitale.bin`
- Loaded via BinLoader with SAUCE metadata support
- 2-zone layout: art (40x20) + content (40x24)

### 7. Timed Narrative
- `mswait()` delays between phases for dramatic pacing
- Variable timing: 700-1500ms based on scene importance
- Press-any-key prompts at phase transitions

## New 8-Phase Flow

1. **Phase 1: Initial Reveal** - Partner mentions ailment (not "pregnant")
2. **Phase 2: Doc Vitale Intro** - Character introduction with catchphrase
3. **Phase 3: Ultrasound Scan** - Pregnancy reveal with twins/triplets detection
4. **Phase 4: Baby Scans** - Stats preview, sprite preview, cost breakdown, Doc Vitale commentary
5. **Phase 5: Birth Event** - Time skip, Doc Vitale birth announcement
6. **Phase 6: Name Baby** - Input baby name(s) BEFORE payment decision
7. **Phase 7: Payment Choice** - Lump sum / Installments / Abandon
8. **Phase 8: Result** - Process payment and create baby baller records

## Technical Details

### New Functions
- `drawBabySpritePreview(view, appearance)` - Creates dynamic 5x4 sprite preview
- `cleanupSprite(view)` - Resource cleanup for sprite container
- `drawStatsPreview(view, projection)` - ANSI bar stat display with colors
- `drawCostBreakdown(view, projection, ctx)` - Payment cost summary
- `createBabies(ctx, pregnancy, babyNames)` - Baby baller creation (extracted)
- `getResultLines(choice, projection, vars)` - Result text generation
- `promptForBabyNames(view, pregnancy, count)` - Name input (moved before payment)
- `presentPaymentOptions(view, ctx, projection, vars)` - Payment choice UI
- `showBirthAnnouncement(view, babies)` - Birth announcement display
- `pick(arr)` - Random array element selection
- `padRight(str, len)` - String padding utility
- `getCountWord(count)` - "TWINS" or "TRIPLETS" label

### Module Exports
```javascript
LORB.Locations.Doctor = {
    runDoctorVisit: runDoctorVisit,
    drawBabySpritePreview: drawBabySpritePreview,
    drawStatsPreview: drawStatsPreview,
    drawCostBreakdown: drawCostBreakdown,
    createBabies: createBabies,
    promptForBabyNames: promptForBabyNames,
    presentPaymentOptions: presentPaymentOptions,
    getResultLines: getResultLines
};
```

## Testing Checklist

- [ ] Single baby pregnancy reveal
- [ ] Twins pregnancy reveal (special Doc Vitale reactions)
- [ ] Triplets pregnancy reveal (MARCH MADNESS catchphrase)
- [ ] Baby sprite preview across different skin tones
- [ ] ANSI stat bars display correctly
- [ ] Name baby → Pay lump sum flow
- [ ] Name baby → Installments flow
- [ ] Name baby → Abandon flow
- [ ] Doc Vitale art loads (40x20 with SAUCE)
- [ ] Monogamy bonus indicator
- [ ] Wedlock discount calculation
- [ ] Child support payment tracking
- [ ] Baby baller creation with correct stats/appearance

## File Info
- **Path**: `lib/lorb/locations/doctor.js`
- **Size**: 27KB
- **Lines**: 805
- **Backup**: `lib/lorb/locations/doctor.js.bak`

## Dependencies
- `lib/ui/rich-view.js` - RichView UI system
- `lib/utils/bin-loader.js` - .bin art file loading
- `lib/core/sprite-init.js` - Sprite system initialization
- `assets/lorb/doc_vitale.bin` - Doc Vitale character art (40x20)

## Notes
- Synchronet color codes use `\1` octal escapes (intentional, not an error)
- File explicitly avoids "use strict" mode due to color code syntax
- All drawing functions accept view parameter for testability
- Sprite cleanup happens automatically in runDoctorVisit() close
