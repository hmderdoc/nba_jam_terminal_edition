# NBA Jam - Shoved Sprite Merge Instructions

## Overview

The game now uses bearing-switching to display shoved/injured player animations. This requires merging the `player-shoved.bin` frames into each player color sprite file.

## Steps to Enable Shoved Animations

### 1. Run the Sprite Merge Script

```bash
cd /sbbs/xtrn/nba_jam
jsexec merge_shoved_sprites.js
```

This will create:
- `player-brown-extended.bin`
- `player-lightgray-extended.bin`
- `player-magenta-extended.bin`

### 2. Backup Original Sprite Files

```bash
cd sprites/
cp player-brown.bin player-brown.bin.original
cp player-lightgray.bin player-lightgray.bin.original
cp player-magenta.bin player-magenta.bin.original
```

### 3. Replace Original Files with Extended Versions

```bash
mv player-brown-extended.bin player-brown.bin
mv player-lightgray-extended.bin player-lightgray.bin
mv player-magenta-extended.bin player-magenta.bin
```

### 4. Update .ini Files

Edit each `player-{color}.ini` file and update the bearings line:

**Before:**
```ini
bearings = n,ne,e,se,s,sw,w,nw
```

**After:**
```ini
bearings = n,ne,e,se,s,sw,w,nw,shoved_n,shoved_ne,shoved_e,shoved_se,shoved_s,shoved_sw,shoved_w,shoved_nw
```

Files to update:
- `sprites/player-brown.ini`
- `sprites/player-lightgray.ini`
- `sprites/player-magenta.ini`

### 5. Test the Game

Run the game and verify that when players get shoved, you see the injured/shoved sprite appearance.

## How It Works

1. **Normal bearings** (n, ne, e, se, s, sw, w, nw) show regular player sprites
2. **Shoved bearings** (shoved_n, shoved_ne, etc.) show injured player sprites
3. When `shoveCooldown > 0`, the game switches from `e` → `shoved_e` (or any bearing)
4. When cooldown expires, the game switches back: `shoved_e` → `e`
5. Jersey numbers/colors are preserved via the uniform mask system

## Technical Details

- The merge script simply concatenates `player-{color}.bin + player-shoved.bin`
- The sprite system treats each bearing as a separate animation frame
- No runtime frame manipulation needed - clean bearing switching
- Frame data order: 8 normal bearings + 8 shoved bearings = 16 total frames

## Reverting Changes

If you need to revert:

```bash
cd sprites/
cp player-brown.bin.original player-brown.bin
cp player-lightgray.bin.original player-lightgray.bin
cp player-magenta.bin.original player-magenta.bin
```

Then restore the original bearings line in the .ini files.
