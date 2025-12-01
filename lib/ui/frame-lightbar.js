/**
 * FrameLightbar - A Frame-aware lightbar menu component
 * 
 * Features:
 * - onSelect callback: fires when selection changes (hover effect)
 * - onExecute callback: fires when Enter is pressed
 * - Multiline items with separate title/detail formatting
 * - Viewport scrolling with scroll indicators when content overflows
 * - Supports disabled items, hotkeys, themes
 */

load("sbbsdefs.js");
load("frame.js");

function FrameLightbar(options) {
    options = options || {};
    
    this.parentFrame = options.frame || null;
    this.x = options.x || 1;
    this.y = options.y || 1;
    this.width = options.width || 38;
    this.height = options.height || 0;  // 0 = no viewport limit
    this.items = options.items || [];
    this.current = options.current || 0;
    this.direction = options.direction || 0;  // 0 = vertical
    this.align = options.align || 0;  // 0 = left
    this.hotkeys = options.hotkeys || "";
    
    // Multiline mode
    this.multiline = options.multiline || false;
    this.detailIndent = options.detailIndent !== undefined ? options.detailIndent : 2;
    
    // Callbacks
    this.onSelect = options.onSelect || null;
    this.onExecute = options.onExecute || null;
    
    // Theme colors
    var theme = options.theme || {};
    this.fg = theme.fg !== undefined ? theme.fg : LIGHTGRAY;
    this.bg = theme.bg !== undefined ? theme.bg : BG_BLACK;
    this.hfg = theme.hfg !== undefined ? theme.hfg : WHITE;
    this.hbg = theme.hbg !== undefined ? theme.hbg : BG_BLUE;
    this.kfg = theme.kfg !== undefined ? theme.kfg : YELLOW;
    this.khfg = theme.khfg !== undefined ? theme.khfg : YELLOW | HIGH;
    this.dfg = theme.dfg !== undefined ? theme.dfg : DARKGRAY;
    this.dbg = theme.dbg !== undefined ? theme.dbg : BG_BLACK;
    
    // Detail line colors
    this.detailFg = theme.detailFg !== undefined ? theme.detailFg : CYAN;
    this.detailBg = theme.detailBg !== undefined ? theme.detailBg : BG_BLACK;
    this.detailHfg = theme.detailHfg !== undefined ? theme.detailHfg : CYAN | HIGH;
    this.detailHbg = theme.detailHbg !== undefined ? theme.detailHbg : BG_BLACK;
    this.detailDfg = theme.detailDfg !== undefined ? theme.detailDfg : DARKGRAY;
    
    // Padding
    this.lpadding = options.lpadding || "  ";
    this.rpadding = options.rpadding || "  ";
    
    // Scrolling state
    this._scrollOffset = 0;
    this._viewportFrame = null;
    this._ownsFrame = false;
    
    this._calculateLineOffsets();
    this._validateCurrent();
}

/**
 * Calculate Y offset for each item
 */
FrameLightbar.prototype._calculateLineOffsets = function() {
    this._itemYOffsets = [];
    this._itemHeights = [];
    var y = 0;
    
    for (var i = 0; i < this.items.length; i++) {
        this._itemYOffsets[i] = y;
        var h = this._getItemHeight(this.items[i]);
        this._itemHeights[i] = h;
        y += h;
    }
    
    this._totalHeight = y;
};

/**
 * Get the number of lines an item takes
 */
FrameLightbar.prototype._getItemHeight = function(item) {
    if (!item) return 1;
    if (!this.multiline) return 1;
    
    var lines = 1;
    if (item.detail) {
        if (Array.isArray(item.detail)) {
            lines += item.detail.length;
        } else {
            lines += 1;
        }
    }
    return lines;
};

/**
 * Ensure current index points to a selectable item
 */
FrameLightbar.prototype._validateCurrent = function() {
    if (this.items.length === 0) return;
    
    var startIdx = this.current;
    while (this.items[this.current] && 
           (this.items[this.current].disabled || this.items[this.current].value === undefined)) {
        this.current++;
        if (this.current >= this.items.length) this.current = 0;
        if (this.current === startIdx) break;
    }
};

/**
 * Get the effective viewport height
 */
FrameLightbar.prototype._getViewportHeight = function() {
    if (this.height > 0) {
        return this.height;
    }
    if (this.parentFrame) {
        return this.parentFrame.height - this.y + 1;
    }
    return 20;
};

/**
 * Check if scrolling is needed
 */
FrameLightbar.prototype._needsScrolling = function() {
    return this._totalHeight > this._getViewportHeight();
};

/**
 * Translate viewport Y (1-based) to actual frame Y coordinate
 */
FrameLightbar.prototype._toFrameY = function(viewY) {
    if (this._ownsFrame) {
        return viewY;  // Child frame coords start at 1
    }
    return this.y + viewY - 1;  // Parent frame needs offset
};

/**
 * Translate viewport X to actual frame X coordinate  
 */
FrameLightbar.prototype._toFrameX = function() {
    if (this._ownsFrame) {
        return 1;
    }
    return this.x;
};

/**
 * Get Y position of an item relative to scroll offset (1-based viewport coords)
 */
FrameLightbar.prototype._getItemViewY = function(index) {
    var absY = this._itemYOffsets[index];
    var scrollY = this._scrollOffset > 0 ? this._itemYOffsets[this._scrollOffset] : 0;
    return absY - scrollY + 1;
};

/**
 * Check if an item is fully visible in the current viewport
 */
FrameLightbar.prototype._isItemVisible = function(index) {
    var viewH = this._getViewportHeight();
    var itemStartY = this._getItemViewY(index);
    var itemEndY = itemStartY + this._itemHeights[index] - 1;
    
    return itemStartY >= 1 && itemEndY <= viewH;
};

/**
 * Adjust scroll offset to ensure current item is fully visible
 */
FrameLightbar.prototype._ensureCurrentVisible = function() {
    if (!this._needsScrolling()) {
        this._scrollOffset = 0;
        return false;
    }
    
    var viewH = this._getViewportHeight();
    var changed = false;
    
    // Scroll up if current item is above viewport
    while (this._scrollOffset > 0 && this._getItemViewY(this.current) < 1) {
        this._scrollOffset--;
        changed = true;
    }
    
    // Scroll down if current item is below viewport
    while (this._scrollOffset < this.items.length - 1) {
        var itemEndY = this._getItemViewY(this.current) + this._itemHeights[this.current] - 1;
        if (itemEndY <= viewH) break;
        this._scrollOffset++;
        changed = true;
    }
    
    return changed;
};

/**
 * Create or get the rendering frame
 */
FrameLightbar.prototype._getFrame = function() {
    if (this._viewportFrame) {
        return this._viewportFrame;
    }
    
    // If we need scrolling, create a child frame for the viewport
    if (this._needsScrolling() && this.parentFrame) {
        var viewH = this._getViewportHeight();
        this._viewportFrame = new Frame(
            this.x, 
            this.y, 
            this.width, 
            viewH, 
            BG_BLACK, 
            this.parentFrame
        );
        this._viewportFrame.open();
        this._ownsFrame = true;
        return this._viewportFrame;
    }
    
    // No scrolling needed, draw directly to parent
    return this.parentFrame;
};

/**
 * Clear the viewport
 */
FrameLightbar.prototype._clearViewport = function() {
    var frame = this._getFrame();
    if (!frame) return;
    
    var viewH = this._getViewportHeight();
    var blankLine = repeatStr(" ", this.width);
    
    for (var row = 0; row < viewH; row++) {
        var frameY = this._toFrameY(row + 1);
        var frameX = this._toFrameX();
        frame.gotoxy(frameX, frameY);
        frame.putmsg(attrToCtrl(this.fg, this.bg) + blankLine + "\1n");
    }
};

/**
 * Draw a single menu item
 */
FrameLightbar.prototype._drawItemAt = function(index, viewY) {
    var frame = this._getFrame();
    if (!frame) return;
    
    var item = this.items[index];
    if (!item) return;
    
    var viewH = this._getViewportHeight();
    
    // Skip if completely outside viewport
    if (viewY < 1 || viewY > viewH) return;
    
    var isCurrent = (index === this.current);
    var isDisabled = item.disabled;
    
    // Determine colors for title
    var textFg, textBg, hotkeyFg;
    if (isDisabled) {
        textFg = this.dfg;
        textBg = this.dbg;
        hotkeyFg = this.dfg;
    } else if (isCurrent) {
        textFg = this.hfg;
        textBg = this.hbg;
        hotkeyFg = this.khfg;
    } else {
        textFg = this.fg;
        textBg = this.bg;
        hotkeyFg = this.kfg;
    }
    
    // Get actual frame coordinates
    var frameX = this._toFrameX();
    var frameY = this._toFrameY(viewY);
    
    // Build the display text
    var displayText = item.text;
    var hotkey = item.hotkey || "";
    var hotkeyPos = -1;
    
    if (hotkey && hotkey.length === 1) {
        var lowerText = displayText.toLowerCase();
        var lowerKey = hotkey.toLowerCase();
        hotkeyPos = lowerText.indexOf(lowerKey);
    }
    
    // Pad/truncate to width (use visible length to account for color codes)
    var contentWidth = this.width - this.lpadding.length - this.rpadding.length;
    var visLen = visibleLength(displayText);
    var hasCtrlCodes = displayText.indexOf("\1") !== -1;
    
    if (visLen > contentWidth) {
        displayText = truncateToVisible(displayText, contentWidth);
        visLen = contentWidth;
        if (hotkeyPos >= contentWidth) hotkeyPos = -1;
    }
    
    if (visLen < contentWidth) {
        var padding = contentWidth - visLen;
        if (this.align === 1) {
            displayText = repeatStr(" ", padding) + displayText;
            if (hotkeyPos >= 0) hotkeyPos += padding;
        } else if (this.align === 2) {
            var leftPad = Math.floor(padding / 2);
            displayText = repeatStr(" ", leftPad) + displayText + repeatStr(" ", padding - leftPad);
            if (hotkeyPos >= 0) hotkeyPos += leftPad;
        } else {
            displayText = displayText + repeatStr(" ", padding);
        }
    }
    
    // Draw title line
    frame.gotoxy(frameX, frameY);
    frame.putmsg(attrToCtrl(this.fg, this.bg) + this.lpadding);
    
    if (hasCtrlCodes) {
        // Text has embedded color codes - use them directly
        frame.putmsg(displayText + "\1n");
    } else if (hotkeyPos >= 0 && hotkeyPos < displayText.length) {
        if (hotkeyPos > 0) {
            frame.putmsg(attrToCtrl(textFg, textBg) + displayText.substring(0, hotkeyPos));
        }
        frame.putmsg(attrToCtrl(hotkeyFg, textBg) + displayText.charAt(hotkeyPos));
        if (hotkeyPos < displayText.length - 1) {
            frame.putmsg(attrToCtrl(textFg, textBg) + displayText.substring(hotkeyPos + 1));
        }
    } else {
        frame.putmsg(attrToCtrl(textFg, textBg) + displayText);
    }
    
    frame.putmsg(attrToCtrl(this.fg, this.bg) + this.rpadding + "\1n");
    
    // Draw detail lines if multiline mode
    if (this.multiline && item.detail) {
        this._drawDetailLinesAt(item, viewY + 1, isCurrent, isDisabled);
    }
};

/**
 * Draw detail lines at a specific position
 */
FrameLightbar.prototype._drawDetailLinesAt = function(item, startViewY, isCurrent, isDisabled) {
    var frame = this._getFrame();
    if (!frame) return;
    
    var details = Array.isArray(item.detail) ? item.detail : [item.detail];
    var contentWidth = this.width - this.lpadding.length - this.rpadding.length;
    var viewH = this._getViewportHeight();
    var frameX = this._toFrameX();
    
    var detFg, detBg;
    if (isDisabled) {
        detFg = this.detailDfg;
        detBg = this.dbg;
    } else if (isCurrent) {
        detFg = this.detailHfg;
        detBg = this.detailHbg;
    } else {
        detFg = this.detailFg;
        detBg = this.detailBg;
    }
    
    for (var i = 0; i < details.length; i++) {
        var viewY = startViewY + i;
        
        // Skip if line is outside viewport
        if (viewY < 1 || viewY > viewH) continue;
        
        var frameY = this._toFrameY(viewY);
        var detailText = details[i] || "";
        var hasCtrlCodes = detailText.indexOf("\1") !== -1;
        var indentStr = repeatStr(" ", this.detailIndent);
        var availWidth = contentWidth - this.detailIndent;
        
        // Truncate if needed (works with or without color codes)
        var visLen = visibleLength(detailText);
        if (visLen > availWidth) {
            detailText = truncateToVisible(detailText, availWidth);
            visLen = availWidth;
        }
        
        // Pad to fill available width
        if (visLen < availWidth) {
            var padNeeded = availWidth - visLen;
            detailText = detailText + repeatStr(" ", padNeeded);
        }
        
        frame.gotoxy(frameX, frameY);
        frame.putmsg(attrToCtrl(this.fg, this.bg) + this.lpadding + indentStr);
        
        if (hasCtrlCodes) {
            frame.putmsg(detailText + "\1n");
        } else {
            frame.putmsg(attrToCtrl(detFg, detBg) + detailText + "\1n");
        }
        
        frame.putmsg(attrToCtrl(this.fg, this.bg) + this.rpadding);
    }
};

/**
 * Draw scroll indicators
 */
FrameLightbar.prototype._drawScrollIndicators = function() {
    if (!this._needsScrolling()) return;
    
    var frame = this._getFrame();
    if (!frame) return;
    
    var viewH = this._getViewportHeight();
    var frameX = this._toFrameX();
    
    // Up indicator
    if (this._scrollOffset > 0) {
        var topFrameY = this._toFrameY(1);
        frame.gotoxy(frameX + this.width - 3, topFrameY);
        frame.putmsg("\1h\1c^\1n");
    }
    
    // Down indicator
    var lastVisibleItem = this._findLastVisibleItem();
    if (lastVisibleItem < this.items.length - 1) {
        var bottomFrameY = this._toFrameY(viewH);
        frame.gotoxy(frameX + this.width - 3, bottomFrameY);
        frame.putmsg("\1h\1cv\1n");
    }
};

/**
 * Find the last item that's at least partially visible
 */
FrameLightbar.prototype._findLastVisibleItem = function() {
    var viewH = this._getViewportHeight();
    for (var i = this.items.length - 1; i >= 0; i--) {
        var itemStartY = this._getItemViewY(i);
        var itemEndY = itemStartY + this._itemHeights[i] - 1;
        if (itemEndY >= 1 && itemStartY <= viewH) {
            return i;
        }
    }
    return this._scrollOffset;
};

/**
 * Draw all visible items
 */
FrameLightbar.prototype._drawVisible = function() {
    this._clearViewport();
    
    var viewH = this._getViewportHeight();
    
    for (var i = 0; i < this.items.length; i++) {
        var viewY = this._getItemViewY(i);
        var itemH = this._itemHeights[i];
        
        // Skip items completely above viewport
        if (viewY + itemH - 1 < 1) continue;
        
        // Stop if we've passed the viewport
        if (viewY > viewH) break;
        
        this._drawItemAt(i, viewY);
    }
    
    this._drawScrollIndicators();
};

/**
 * Draw the entire menu
 */
FrameLightbar.prototype.draw = function() {
    this._ensureCurrentVisible();
    this._drawVisible();
    
    var frame = this._getFrame();
    if (frame) frame.cycle();
    if (this.parentFrame && this._ownsFrame) {
        this.parentFrame.cycle();
    }
};

/**
 * Add an item to the menu
 */
FrameLightbar.prototype.add = function(text, value, hotkey, disabled, detail) {
    this.items.push({
        text: text,
        value: value,
        hotkey: hotkey,
        disabled: disabled || false,
        detail: detail || null
    });
    this._calculateLineOffsets();
};

/**
 * Clear all items
 */
FrameLightbar.prototype.clear = function() {
    this.items = [];
    this.current = 0;
    this._scrollOffset = 0;
    this._calculateLineOffsets();
};

/**
 * Get current item
 */
FrameLightbar.prototype.getCurrentItem = function() {
    return this.items[this.current] || null;
};

/**
 * Get current index
 */
FrameLightbar.prototype.getCurrentIndex = function() {
    return this.current;
};

/**
 * Set current selection by index
 */
FrameLightbar.prototype.setCurrentIndex = function(index) {
    if (index >= 0 && index < this.items.length) {
        this.current = index;
        this._validateCurrent();
    }
};

/**
 * Set current selection by value
 */
FrameLightbar.prototype.setCurrentByValue = function(value) {
    for (var i = 0; i < this.items.length; i++) {
        if (this.items[i].value === value && !this.items[i].disabled) {
            this.current = i;
            return true;
        }
    }
    return false;
};

/**
 * Move to next selectable item
 */
FrameLightbar.prototype._moveNext = function() {
    var startIdx = this.current;
    do {
        this.current++;
        if (this.current >= this.items.length) this.current = 0;
    } while ((this.items[this.current].disabled || this.items[this.current].value === undefined) 
             && this.current !== startIdx);
};

/**
 * Move to previous selectable item
 */
FrameLightbar.prototype._movePrev = function() {
    var startIdx = this.current;
    do {
        this.current--;
        if (this.current < 0) this.current = this.items.length - 1;
    } while ((this.items[this.current].disabled || this.items[this.current].value === undefined) 
             && this.current !== startIdx);
};

/**
 * Fire the onSelect callback
 */
FrameLightbar.prototype._fireSelect = function() {
    if (this.onSelect && typeof this.onSelect === "function") {
        var item = this.items[this.current];
        try {
            this.onSelect(item, this.current, this);
        } catch (e) {
            log(LOG_WARNING, "[FrameLightbar] onSelect callback error: " + e);
        }
    }
};

/**
 * Fire the onExecute callback
 */
FrameLightbar.prototype._fireExecute = function() {
    if (this.onExecute && typeof this.onExecute === "function") {
        var item = this.items[this.current];
        try {
            var result = this.onExecute(item, this.current, this);
            return result !== false;
        } catch (e) {
            log(LOG_WARNING, "[FrameLightbar] onExecute callback error: " + e);
        }
    }
    return true;
};

/**
 * Get total height of the menu
 */
FrameLightbar.prototype.getHeight = function() {
    return this.multiline ? this._totalHeight : this.items.length;
};

/**
 * Clean up resources
 */
FrameLightbar.prototype.close = function() {
    if (this._viewportFrame && this._ownsFrame) {
        try {
            this._viewportFrame.close();
        } catch (e) {}
        this._viewportFrame = null;
        this._ownsFrame = false;
    }
};

/**
 * Main input loop
 */
FrameLightbar.prototype.getval = function() {
    if (this.items.length === 0) return null;
    
    this._validateCurrent();
    this._ensureCurrentVisible();
    this.draw();
    this._fireSelect();
    
    while (bbs.online) {
        var key = console.inkey(K_NONE, 100);
        if (!key) continue;
        
        var upperKey = key.toUpperCase();
        
        // Check custom hotkeys
        if (this.hotkeys.indexOf(upperKey) !== -1) {
            this.close();
            return upperKey;
        }
        
        // Check item hotkeys
        var hotkeyHandled = false;
        for (var i = 0; i < this.items.length; i++) {
            var item = this.items[i];
            if (!item.disabled && item.hotkey && item.hotkey.toUpperCase() === upperKey) {
                var oldCurrent = this.current;
                this.current = i;
                
                if (oldCurrent !== this.current) {
                    this._ensureCurrentVisible();
                    this.draw();
                    this._fireSelect();
                }
                
                if (this._fireExecute()) {
                    this.close();
                    return item.value;
                }
                hotkeyHandled = true;
                break;
            }
        }
        if (hotkeyHandled) continue;
        
        // Navigation keys
        var oldCurrent = this.current;
        var oldScroll = this._scrollOffset;
        
        switch (key) {
            case KEY_UP:
                if (this.direction === 0) this._movePrev();
                break;
            case KEY_DOWN:
                if (this.direction === 0) this._moveNext();
                break;
            case KEY_LEFT:
                if (this.direction === 1) this._movePrev();
                break;
            case KEY_RIGHT:
                if (this.direction === 1) this._moveNext();
                break;
            case KEY_HOME:
                this.current = 0;
                this._validateCurrent();
                break;
            case KEY_END:
                this.current = this.items.length - 1;
                while (this.current > 0 && 
                       (this.items[this.current].disabled || this.items[this.current].value === undefined)) {
                    this.current--;
                }
                break;
            case "\r":
            case "\n":
                if (this.items[this.current] && !this.items[this.current].disabled) {
                    if (this._fireExecute()) {
                        this.close();
                        return this.items[this.current].value;
                    }
                }
                continue;
            case "\x1b":
                this.close();
                return null;
        }
        
        // Redraw if selection changed
        if (oldCurrent !== this.current) {
            var scrollChanged = this._ensureCurrentVisible();
            
            if (scrollChanged || oldScroll !== this._scrollOffset) {
                this.draw();
            } else {
                // Partial redraw - just the two affected items
                this._drawItemAt(oldCurrent, this._getItemViewY(oldCurrent));
                this._drawItemAt(this.current, this._getItemViewY(this.current));
                this._drawScrollIndicators();
                
                var frame = this._getFrame();
                if (frame) frame.cycle();
                if (this.parentFrame && this._ownsFrame) {
                    this.parentFrame.cycle();
                }
            }
            
            this._fireSelect();
        }
    }
    
    this.close();
    return null;
};

/**
 * Convert fg/bg attributes to Ctrl-A codes
 */
function attrToCtrl(fg, bg) {
    var code = "\1n";
    
    switch (bg) {
        case BG_BLACK:   code += "\1" + "0"; break;
        case BG_BLUE:    code += "\1" + "4"; break;
        case BG_GREEN:   code += "\1" + "2"; break;
        case BG_CYAN:    code += "\1" + "6"; break;
        case BG_RED:     code += "\1" + "1"; break;
        case BG_MAGENTA: code += "\1" + "5"; break;
        case BG_BROWN:   code += "\1" + "3"; break;
        case BG_LIGHTGRAY: code += "\1" + "7"; break;
    }
    
    if (fg & HIGH) {
        code += "\1h";
        fg = fg & ~HIGH;
    }
    
    switch (fg & 0x07) {
        case BLACK:     code += "\1k"; break;
        case BLUE:      code += "\1b"; break;
        case GREEN:     code += "\1g"; break;
        case CYAN:      code += "\1c"; break;
        case RED:       code += "\1r"; break;
        case MAGENTA:   code += "\1m"; break;
        case BROWN:     code += "\1y"; break;
        case LIGHTGRAY: code += "\1w"; break;
    }
    
    return code;
}

/**
 * Repeat a string n times
 */
function repeatStr(str, n) {
    var result = "";
    for (var i = 0; i < n; i++) result += str;
    return result;
}

/**
 * Calculate visible length of a string, excluding Ctrl-A color codes.
 * Color codes are \1X where X is a single character (e.g., \1w, \1g, \1n, \1h).
 */
function visibleLength(str) {
    if (!str) return 0;
    // Remove all \1X sequences (Ctrl-A followed by any single character)
    return str.replace(/\x01[^\x01]/g, "").length;
}

/**
 * Truncate a string to a visible length, preserving color codes.
 * Returns the truncated string that will display at most maxVisible characters.
 */
function truncateToVisible(str, maxVisible) {
    if (!str) return "";
    var visible = 0;
    var i = 0;
    while (i < str.length && visible < maxVisible) {
        if (str.charAt(i) === "\x01" && i + 1 < str.length) {
            // Skip past the color code (2 chars: \1 + code char)
            i += 2;
        } else {
            visible++;
            i++;
        }
    }
    return str.substring(0, i);
}

// Export
this.FrameLightbar = FrameLightbar;
