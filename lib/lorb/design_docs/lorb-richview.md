# LORB RichView Integration

RichView is a zone-based layout manager used for LORB screens that need richer UI than simple text output.

---

## Overview

**File:** `lib/ui/rich-view.js`

RichView divides the 80x24 terminal into configurable zones, each backed by a Frame object. This allows:
- Art/sprites in one zone while text in another
- Lightbar menus with hover callbacks
- Independent zone updates without full redraws

---

## Creating a RichView

```javascript
var view = new RichView({
    zones: [
        { name: "content", x: 1, y: 1, width: 40, height: 24 },
        { name: "art", x: 41, y: 1, width: 40, height: 24 }
    ],
    theme: "lorb"
});
```

### Presets

RichView includes common layouts:

```javascript
var view = new RichView({ preset: "artLeft" });   // Art on left, content on right
var view = new RichView({ preset: "artRight" });  // Content on left, art on right
var view = new RichView({ preset: "twoColumn" }); // Two equal columns
```

---

## Zone API

### Get a zone's Frame
```javascript
var frame = view.getZone("content");
frame.gotoxy(5, 10);
frame.putmsg("Hello!");
```

### Clear a zone
```javascript
view.clearZone("art");
```

### Set active content zone
```javascript
view.setContentZone("content");
view.setCursorY(0);
```

### Update zone with callback
```javascript
view.updateZone("art", function(frame) {
    frame.clear();
    frame.gotoxy(2, 2);
    frame.putmsg("Updated!");
});
```

---

## Content Helpers

When a content zone is active, these helpers are available:

```javascript
view.setContentZone("content");
view.setCursorY(0);

view.header("TITLE");           // Centered, highlighted
view.line("Regular text");      // Standard line
view.blank();                   // Empty line
view.info("Hint text");         // Cyan/dim
view.warn("Warning!");          // Yellow/red
```

---

## Menus

### Basic menu
```javascript
var items = [
    { text: "Play Game", value: "play", hotkey: "P" },
    { text: "Options", value: "opts", hotkey: "O" },
    { text: "Quit", value: "quit", hotkey: "Q" }
];

var choice = view.menu(items, { y: 10, width: 30 });
// Returns: "play", "opts", "quit", or null if escaped
```

### Multiline menu (for shop items)
```javascript
var items = [
    {
        text: "Air Jordans - $500",
        detail: ["+2 Speed", "+1 Dunk"],  // Additional lines
        value: "jordans",
        hotkey: "1"
    },
    // ...
];

var choice = view.menu(items, {
    y: 5,
    multiline: true,
    detailIndent: 2
});
```

### Menu with hover callback
```javascript
var choice = view.menu(items, {
    y: 5,
    onSelect: function(item, index, rv) {
        // Called when user hovers over item
        if (item._previewData) {
            drawPreview(rv, item._previewData);
        }
        rv.render();
    }
});
```

**Important:** `view.menu()` is **synchronous** - it blocks and returns the selected value. Do not expect it to work with callbacks for the final selection.

---

## Rendering

### Manual render
```javascript
view.render();  // Cycles all frames to update display
```

### Auto-render
Most operations auto-render, but call `render()` after direct Frame manipulation.

---

## Cleanup

Always close the view when done:

```javascript
function runMyLocation(ctx) {
    var view = new RichView({ preset: "artLeft" });
    
    try {
        // ... location logic
    } finally {
        view.close();
    }
}
```

---

## Themes

RichView supports themes for consistent styling:

```javascript
var view = new RichView({ theme: "lorb" });
```

Themes define colors for:
- Headers
- Menu items (normal, selected, disabled)
- Info/warning text
- Borders

See `lib/ui/themes.js` for available themes.

---

## Common Patterns

### Two-panel layout (content + preview)
```javascript
var view = new RichView({
    zones: [
        { name: "content", x: 1, y: 1, width: 40, height: 24 },
        { name: "art", x: 41, y: 1, width: 40, height: 24 }
    ]
});

// Left side: text content
view.setContentZone("content");
view.header("SELECT ITEM");
// ...

// Right side: preview
view.updateZone("art", function(frame) {
    frame.clear();
    drawItemPreview(frame, selectedItem);
});
```

### Menu in specific zone
```javascript
view.setContentZone("art");
view.setCursorY(15);

var choice = view.menu(items, { y: 16, width: 36 });
```

---

## Troubleshooting

### Menu not responding
- Ensure you're calling `view.menu()` not trying to use async callbacks
- Check that the menu Y position is within the zone bounds

### Content not appearing
- Call `view.render()` after direct frame operations
- Verify zone coordinates don't overlap

### Frame corruption
- Always `view.close()` when exiting
- Clean up child frames/sprites before closing parent
