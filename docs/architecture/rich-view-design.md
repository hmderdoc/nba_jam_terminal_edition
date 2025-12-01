# Rich View System Design

## Goals

1. Reusable layout system for menu screens
2. Support 40x20 ANSI art positioned left OR right
3. Lightbar menus with theming support
4. Content zone for non-menu contextual info
5. Optional banner/footer zone
6. Works within 80x24 terminal constraint

## Screen Zones

```
80 columns x 24 rows

Option A: Art Left, Content Right
┌────────────────────┬────────────────────┐
│                    │  CONTENT ZONE      │  rows 1-20
│   ART ZONE         │  - Context text    │
│   40x20            │  - Lightbar menu   │
│                    │  - Status info     │
├────────────────────┴────────────────────┤
│  BANNER ZONE (optional) - 80x4          │  rows 21-24
└─────────────────────────────────────────┘

Option B: Content Left, Art Right
┌────────────────────┬────────────────────┐
│  CONTENT ZONE      │                    │
│  - Context text    │   ART ZONE         │
│  - Lightbar menu   │   40x20            │
│  - Status info     │                    │
├────────────────────┴────────────────────┤
│  BANNER ZONE (optional) - 80x4          │
└─────────────────────────────────────────┘
```

## Core Components

### 1. RichView - Layout Container

```javascript
// Usage example
var view = new RichView({
    art: {
        file: "assets/team_select.ans",
        position: "left"   // or "right"
    },
    banner: {
        file: "assets/footer.ans",  // optional
        position: "bottom"
    },
    theme: {
        menuFg: LIGHTGRAY,
        menuBg: BG_BLUE,
        menuHighlightFg: WHITE,
        menuHighlightBg: BG_CYAN,
        menuHotkeyFg: YELLOW
    }
});

// Content zone methods
view.clear();           // Clear content zone
view.header("TITLE");   // Print header text
view.line("info");      // Print info line
view.blank();           // Blank line

// Menu support
var choice = view.menu([
    { text: "Play Game", value: "play", hotkey: "P" },
    { text: "Options", value: "options", hotkey: "O" },
    { text: "Quit", value: "quit", hotkey: "Q" }
]);

// Or manual lightbar control
view.showMenu(items);   // Display but don't wait
var val = view.getMenuSelection();  // Wait for selection

view.close();
```

### 2. FrameLightbar - Frame-aware lightbar

```javascript
// Renders within a Frame, not direct console
var menu = new FrameLightbar({
    frame: contentFrame,    // Parent frame
    x: 2,                   // Position within frame
    y: 5,
    width: 36,              // Max width
    items: [...],
    theme: {...}
});

menu.draw();
var selection = menu.getSelection();
```

### 3. Theme Object

```javascript
var THEMES = {
    default: {
        fg: LIGHTGRAY,
        bg: BG_BLACK,
        highlightFg: WHITE | HIGH,
        highlightBg: BG_BLUE,
        hotkeyFg: YELLOW,
        hotkeyHighlightFg: YELLOW | HIGH,
        disabledFg: DARKGRAY,
        borderFg: CYAN
    },
    fire: {
        fg: YELLOW,
        bg: BG_RED,
        highlightFg: WHITE | HIGH,
        highlightBg: BG_YELLOW,
        // ...
    }
};
```

## Art Loading

```javascript
// Art files are .ans files, loaded into Frame
function loadArt(frame, filepath) {
    frame.load(filepath, frame.width, frame.height);
}
```

## Content Zone Flexibility

The content zone (40x20 or 40x24 without banner) can render:
- Headers/titles
- Descriptive text
- Lightbar menus (vertical, centered or top-aligned)
- Stats/status displays
- Dynamic content (like sprite preview)

Content is rendered into a Frame, so child frames (like sprite preview) can overlay.

## Animation Considerations (Future)

- Keep art/content in separate Frames
- Transition could slide one frame out, another in
- Or crossfade via attribute manipulation
- Design doesn't preclude this, just not implemented initially

## File Structure

```
lib/ui/
    rich-view.js          # Main layout manager
    frame-lightbar.js     # Frame-aware lightbar
    themes.js             # Color theme definitions
    art-loader.js         # ANSI art loading utilities
```

## Migration Path

1. Create RichView system
2. Add to LORB menus first (hub, courts, etc.)
3. Extend to main game menus (team select, etc.)
4. Create themed variants per game mode

## Questions to Resolve

1. Should RichView extend LORB.View or replace it?
2. Do we need scrolling in content zone for long text?
3. How to handle input during menu display + other content updates?
