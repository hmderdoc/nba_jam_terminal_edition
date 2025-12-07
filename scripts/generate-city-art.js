/**
 * generate-city-art.js
 * 
 * Generates simple banner (80x4) and detail (40x20) .bin art files
 * for all 30 NBA cities in LORB.
 * 
 * Run with: /sbbs/exec/jsexec /sbbs/xtrn/nba_jam/scripts/generate-city-art.js
 */

load("sbbsdefs.js");

var CITIES_JSON = "/sbbs/xtrn/nba_jam/lib/lorb/design_docs/season_concept/cities.json";
var OUTPUT_DIR = "/sbbs/xtrn/nba_jam/assets/lorb/cities/";

// Dimensions
var BANNER_W = 80;
var BANNER_H = 4;
var DETAIL_W = 40;
var DETAIL_H = 20;

// CP437 block characters
var BLOCK_FULL = 219;       // █
var BLOCK_DARK = 178;       // ▓
var BLOCK_MEDIUM = 177;     // ▒
var BLOCK_LIGHT = 176;      // ░
var BLOCK_HALF_U = 223;     // ▀
var BLOCK_HALF_D = 220;     // ▄
var BLOCK_CORNER_TL = 218;  // ┌
var BLOCK_CORNER_TR = 191;  // ┐
var BLOCK_CORNER_BL = 192;  // └
var BLOCK_CORNER_BR = 217;  // ┘
var BLOCK_HORIZ = 196;      // ─
var BLOCK_VERT = 179;       // │
var BLOCK_DOUBLE_HORIZ = 205; // ═
var BLOCK_DOUBLE_VERT = 186;  // ║

// DOS Colors (foreground bits 0-3, background bits 4-6, blink bit 7)
var BLACK = 0;
var BLUE = 1;
var GREEN = 2;
var CYAN = 3;
var RED = 4;
var MAGENTA = 5;
var BROWN = 6;
var LIGHTGRAY = 7;
var DARKGRAY = 8;
var LIGHTBLUE = 9;
var LIGHTGREEN = 10;
var LIGHTCYAN = 11;
var LIGHTRED = 12;
var LIGHTMAGENTA = 13;
var YELLOW = 14;
var WHITE = 15;

// Background color helper
function bg(color) {
    return (color << 4);
}

// Combined attribute
function attr(fg, bgColor) {
    return fg | bg(bgColor);
}

// Team color mapping
var TEAM_COLORS = {
    "bos": { fg: WHITE, bg: GREEN, accent: LIGHTGREEN },
    "nyk": { fg: LIGHTBLUE, bg: BLUE, accent: BROWN },
    "bkn": { fg: WHITE, bg: BLACK, accent: LIGHTGRAY },
    "phi": { fg: LIGHTBLUE, bg: BLUE, accent: LIGHTRED },
    "tor": { fg: LIGHTRED, bg: RED, accent: WHITE },
    "cle": { fg: BROWN, bg: RED, accent: YELLOW },
    "det": { fg: LIGHTBLUE, bg: RED, accent: WHITE },
    "chi": { fg: LIGHTRED, bg: BLACK, accent: WHITE },
    "mil": { fg: LIGHTGREEN, bg: GREEN, accent: BROWN },
    "ind": { fg: YELLOW, bg: BLUE, accent: WHITE },
    "atl": { fg: LIGHTRED, bg: RED, accent: YELLOW },
    "cha": { fg: LIGHTCYAN, bg: MAGENTA, accent: WHITE },
    "mia": { fg: LIGHTRED, bg: BLACK, accent: YELLOW },
    "orl": { fg: LIGHTBLUE, bg: BLACK, accent: WHITE },
    "was": { fg: LIGHTBLUE, bg: RED, accent: WHITE },
    "mem": { fg: LIGHTCYAN, bg: BLUE, accent: YELLOW },
    "nop": { fg: BROWN, bg: RED, accent: YELLOW },
    "hou": { fg: LIGHTRED, bg: RED, accent: WHITE },
    "sas": { fg: LIGHTGRAY, bg: BLACK, accent: WHITE },
    "dal": { fg: LIGHTBLUE, bg: BLUE, accent: WHITE },
    "den": { fg: YELLOW, bg: BLUE, accent: LIGHTRED },
    "uta": { fg: YELLOW, bg: BLUE, accent: GREEN },
    "phx": { fg: BROWN, bg: MAGENTA, accent: YELLOW },
    "sac": { fg: LIGHTMAGENTA, bg: MAGENTA, accent: LIGHTGRAY },
    "gsw": { fg: YELLOW, bg: BLUE, accent: WHITE },
    "lal": { fg: YELLOW, bg: MAGENTA, accent: WHITE },
    "lac": { fg: LIGHTRED, bg: BLUE, accent: WHITE },
    "por": { fg: LIGHTRED, bg: BLACK, accent: WHITE },
    "min": { fg: LIGHTGREEN, bg: BLUE, accent: WHITE },
    "okc": { fg: LIGHTCYAN, bg: BLUE, accent: BROWN }
};

// City imagery keywords for visual elements
var CITY_IMAGERY = {
    "bos": { icon: "SHAMROCK", elements: ["Celtic", "History", "Garden"] },
    "nyk": { icon: "SKYLINE", elements: ["Empire", "Garden", "Lights"] },
    "bkn": { icon: "BRIDGE", elements: ["Bridge", "Streets", "Hoops"] },
    "phi": { icon: "LIBERTY", elements: ["Process", "76ers", "Philly"] },
    "tor": { icon: "MAPLE", elements: ["North", "Raptors", "Cold"] },
    "cle": { icon: "ROCK", elements: ["Lake", "Cavs", "Heart"] },
    "det": { icon: "MOTOR", elements: ["Pistons", "Grit", "Motor"] },
    "chi": { icon: "BULLS", elements: ["Wind", "Bulls", "Jordan"] },
    "mil": { icon: "ANTLER", elements: ["Bucks", "Cream", "Greek"] },
    "ind": { icon: "HOOPS", elements: ["Hoosier", "Pace", "Racing"] },
    "atl": { icon: "PEACH", elements: ["Hawks", "South", "ATL"] },
    "cha": { icon: "HORNET", elements: ["Buzz", "Queen", "Hornets"] },
    "mia": { icon: "PALM", elements: ["Heat", "Beach", "Vice"] },
    "orl": { icon: "MAGIC", elements: ["Magic", "Castle", "Disney"] },
    "was": { icon: "CAPITOL", elements: ["Wizards", "DC", "Capital"] },
    "mem": { icon: "MUSIC", elements: ["Grit", "Blues", "Beale"] },
    "nop": { icon: "FLEUR", elements: ["Jazz", "Bayou", "Mardi"] },
    "hou": { icon: "ROCKET", elements: ["Space", "NASA", "Rockets"] },
    "sas": { icon: "SPUR", elements: ["Spurs", "River", "Alamo"] },
    "dal": { icon: "STAR", elements: ["Mavs", "Texas", "BigD"] },
    "den": { icon: "MOUNTAIN", elements: ["Mile", "Nuggets", "Peaks"] },
    "uta": { icon: "PEAKS", elements: ["Jazz", "Wasatch", "Mountain"] },
    "phx": { icon: "SUN", elements: ["Desert", "Suns", "Valley"] },
    "sac": { icon: "CROWN", elements: ["Kings", "River", "Capital"] },
    "gsw": { icon: "BRIDGE2", elements: ["Splash", "Bay", "Warriors"] },
    "lal": { icon: "STAR2", elements: ["Showtime", "Lakers", "LA"] },
    "lac": { icon: "SAILBOAT", elements: ["Clips", "LobCity", "LA"] },
    "por": { icon: "ROSE", elements: ["Rip", "Blazers", "PDX"] },
    "min": { icon: "WOLF", elements: ["Wolves", "Lakes", "North"] },
    "okc": { icon: "THUNDER", elements: ["Thunder", "Plains", "OKC"] }
};

/**
 * Create a buffer for a .bin file
 */
function createBuffer(width, height) {
    var size = width * height * 2; // 2 bytes per cell
    var buffer = [];
    for (var i = 0; i < size; i++) {
        buffer.push(0);
    }
    return buffer;
}

/**
 * Set a character in the buffer
 */
function setChar(buffer, width, x, y, charCode, attribute) {
    var offset = (y * width + x) * 2;
    buffer[offset] = charCode;
    buffer[offset + 1] = attribute;
}

/**
 * Write text to buffer
 */
function writeText(buffer, width, x, y, text, attribute) {
    for (var i = 0; i < text.length; i++) {
        if (x + i >= width) break;
        setChar(buffer, width, x + i, y, text.charCodeAt(i), attribute);
    }
}

/**
 * Fill a rectangle
 */
function fillRect(buffer, width, x, y, w, h, charCode, attribute) {
    for (var row = 0; row < h; row++) {
        for (var col = 0; col < w; col++) {
            if (x + col < width && y + row < 25) {
                setChar(buffer, width, x + col, y + row, charCode, attribute);
            }
        }
    }
}

/**
 * Draw a horizontal line
 */
function hLine(buffer, width, x, y, len, charCode, attribute) {
    for (var i = 0; i < len; i++) {
        if (x + i < width) {
            setChar(buffer, width, x + i, y, charCode, attribute);
        }
    }
}

/**
 * Draw a vertical line
 */
function vLine(buffer, width, x, y, len, charCode, attribute) {
    for (var i = 0; i < len; i++) {
        setChar(buffer, width, x, y + i, charCode, attribute);
    }
}

/**
 * Center text within a given width
 */
function centerText(text, totalWidth) {
    var pad = Math.floor((totalWidth - text.length) / 2);
    return pad;
}

/**
 * Generate a banner (80x4) for a city
 */
function generateBanner(city) {
    var buffer = createBuffer(BANNER_W, BANNER_H);
    var colors = TEAM_COLORS[city.id] || { fg: WHITE, bg: BLACK, accent: LIGHTGRAY };
    
    var mainAttr = attr(colors.fg, colors.bg);
    var accentAttr = attr(colors.accent, colors.bg);
    var darkAttr = attr(DARKGRAY, colors.bg);
    
    // Fill background
    fillRect(buffer, BANNER_W, 0, 0, BANNER_W, BANNER_H, 32, mainAttr); // space
    
    // Top decorative line
    hLine(buffer, BANNER_W, 0, 0, BANNER_W, BLOCK_DOUBLE_HORIZ, accentAttr);
    
    // City name and team - centered on line 2
    var titleText = city.cityName.toUpperCase() + " - " + city.teamName.toUpperCase();
    var titleX = centerText(titleText, BANNER_W);
    writeText(buffer, BANNER_W, titleX, 1, titleText, attr(WHITE, colors.bg));
    
    // Decorative elements at edges
    setChar(buffer, BANNER_W, 0, 1, BLOCK_DOUBLE_VERT, accentAttr);
    setChar(buffer, BANNER_W, BANNER_W - 1, 1, BLOCK_DOUBLE_VERT, accentAttr);
    
    // Tagline or imagery on line 3
    var imagery = CITY_IMAGERY[city.id] || { elements: ["Ball", "Game", "Hoops"] };
    var tagline = imagery.elements.join(" * ");
    var tagX = centerText(tagline, BANNER_W);
    writeText(buffer, BANNER_W, tagX, 2, tagline, accentAttr);
    
    // Decorative elements at edges
    setChar(buffer, BANNER_W, 0, 2, BLOCK_DOUBLE_VERT, accentAttr);
    setChar(buffer, BANNER_W, BANNER_W - 1, 2, BLOCK_DOUBLE_VERT, accentAttr);
    
    // Bottom decorative line
    hLine(buffer, BANNER_W, 0, 3, BANNER_W, BLOCK_DOUBLE_HORIZ, accentAttr);
    
    return buffer;
}

/**
 * Generate a detail panel (40x20) for a city
 */
function generateDetail(city) {
    var buffer = createBuffer(DETAIL_W, DETAIL_H);
    var colors = TEAM_COLORS[city.id] || { fg: WHITE, bg: BLACK, accent: LIGHTGRAY };
    
    var mainAttr = attr(colors.fg, colors.bg);
    var accentAttr = attr(colors.accent, colors.bg);
    var darkAttr = attr(DARKGRAY, colors.bg);
    var whiteAttr = attr(WHITE, colors.bg);
    
    // Fill background with shading
    for (var y = 0; y < DETAIL_H; y++) {
        for (var x = 0; x < DETAIL_W; x++) {
            // Gradient effect from top to bottom
            var shade = BLOCK_LIGHT;
            if (y < 5) shade = 32; // space
            else if (y < 10) shade = BLOCK_LIGHT;
            else if (y < 15) shade = BLOCK_MEDIUM;
            else shade = BLOCK_DARK;
            
            setChar(buffer, DETAIL_W, x, y, shade, darkAttr);
        }
    }
    
    // Draw border
    hLine(buffer, DETAIL_W, 0, 0, DETAIL_W, BLOCK_DOUBLE_HORIZ, accentAttr);
    hLine(buffer, DETAIL_W, 0, DETAIL_H - 1, DETAIL_W, BLOCK_DOUBLE_HORIZ, accentAttr);
    vLine(buffer, DETAIL_W, 0, 0, DETAIL_H, BLOCK_DOUBLE_VERT, accentAttr);
    vLine(buffer, DETAIL_W, DETAIL_W - 1, 0, DETAIL_H, BLOCK_DOUBLE_VERT, accentAttr);
    
    // Corners
    setChar(buffer, DETAIL_W, 0, 0, 201, accentAttr);               // ╔
    setChar(buffer, DETAIL_W, DETAIL_W - 1, 0, 187, accentAttr);    // ╗
    setChar(buffer, DETAIL_W, 0, DETAIL_H - 1, 200, accentAttr);    // ╚
    setChar(buffer, DETAIL_W, DETAIL_W - 1, DETAIL_H - 1, 188, accentAttr); // ╝
    
    // City name at top
    var cityName = city.cityName.toUpperCase();
    var nameX = centerText(cityName, DETAIL_W);
    writeText(buffer, DETAIL_W, nameX, 2, cityName, whiteAttr);
    
    // Team name below
    var teamName = city.teamName.toUpperCase();
    var teamX = centerText(teamName, DETAIL_W);
    writeText(buffer, DETAIL_W, teamX, 4, teamName, accentAttr);
    
    // Draw a basketball or city icon in center
    var imagery = CITY_IMAGERY[city.id] || { icon: "BALL" };
    drawIcon(buffer, DETAIL_W, 15, 7, imagery.icon, colors);
    
    // Nightclub name at bottom
    var clubName = city.nightclubName || "The Club";
    var clubX = centerText(clubName, DETAIL_W);
    writeText(buffer, DETAIL_W, clubX, 16, clubName, attr(YELLOW, colors.bg));
    
    // Region/notes
    var region = city.region ? city.region.toUpperCase() : "";
    var regX = centerText(region, DETAIL_W);
    writeText(buffer, DETAIL_W, regX, 18, region, darkAttr);
    
    return buffer;
}

/**
 * Draw a simple ASCII icon
 */
function drawIcon(buffer, width, x, y, iconType, colors) {
    var iconAttr = attr(colors.accent, colors.bg);
    var brightAttr = attr(WHITE, colors.bg);
    
    // Simple 8x5 icons
    switch (iconType) {
        case "BASKETBALL":
        case "HOOPS":
        case "BALL":
            // Simple basketball
            writeText(buffer, width, x, y + 0, "  ████  ", iconAttr);
            writeText(buffer, width, x, y + 1, " █─██─█ ", iconAttr);
            writeText(buffer, width, x, y + 2, " ██──██ ", iconAttr);
            writeText(buffer, width, x, y + 3, " █─██─█ ", iconAttr);
            writeText(buffer, width, x, y + 4, "  ████  ", iconAttr);
            break;
            
        case "SKYLINE":
            writeText(buffer, width, x, y + 0, "  █ ███ ", iconAttr);
            writeText(buffer, width, x, y + 1, " ██████ ", iconAttr);
            writeText(buffer, width, x, y + 2, " ██████ ", iconAttr);
            writeText(buffer, width, x, y + 3, "████████", iconAttr);
            writeText(buffer, width, x, y + 4, "████████", iconAttr);
            break;
            
        case "SHAMROCK":
            writeText(buffer, width, x, y + 0, "  ▓ ▓   ", iconAttr);
            writeText(buffer, width, x, y + 1, " ▓▓▓▓▓  ", iconAttr);
            writeText(buffer, width, x, y + 2, "  ▓▓▓   ", iconAttr);
            writeText(buffer, width, x, y + 3, "   █    ", iconAttr);
            writeText(buffer, width, x, y + 4, "   █    ", iconAttr);
            break;
            
        case "BULLS":
            writeText(buffer, width, x, y + 0, "▄█   █▄ ", iconAttr);
            writeText(buffer, width, x, y + 1, " ██████ ", iconAttr);
            writeText(buffer, width, x, y + 2, "  ████  ", iconAttr);
            writeText(buffer, width, x, y + 3, "  ▀▀▀▀  ", iconAttr);
            writeText(buffer, width, x, y + 4, "  █  █  ", iconAttr);
            break;
            
        case "MOUNTAIN":
        case "PEAKS":
            writeText(buffer, width, x, y + 0, "    ▲   ", iconAttr);
            writeText(buffer, width, x, y + 1, "   ███  ", iconAttr);
            writeText(buffer, width, x, y + 2, "  █████ ", iconAttr);
            writeText(buffer, width, x, y + 3, " ██▲████", iconAttr);
            writeText(buffer, width, x, y + 4, "████████", iconAttr);
            break;
            
        case "ROCKET":
            writeText(buffer, width, x, y + 0, "   ▲    ", iconAttr);
            writeText(buffer, width, x, y + 1, "  ███   ", iconAttr);
            writeText(buffer, width, x, y + 2, "  ███   ", iconAttr);
            writeText(buffer, width, x, y + 3, "  ▀█▀   ", iconAttr);
            writeText(buffer, width, x, y + 4, " ▀▀▀▀▀  ", brightAttr);
            break;
            
        case "SUN":
            writeText(buffer, width, x, y + 0, " \\  │ / ", iconAttr);
            writeText(buffer, width, x, y + 1, "  ████  ", brightAttr);
            writeText(buffer, width, x, y + 2, "──████──", iconAttr);
            writeText(buffer, width, x, y + 3, "  ████  ", brightAttr);
            writeText(buffer, width, x, y + 4, " /  │ \\ ", iconAttr);
            break;
            
        case "STAR":
        case "STAR2":
            writeText(buffer, width, x, y + 0, "   ★    ", brightAttr);
            writeText(buffer, width, x, y + 1, "  ███   ", iconAttr);
            writeText(buffer, width, x, y + 2, "███████ ", brightAttr);
            writeText(buffer, width, x, y + 3, "  ███   ", iconAttr);
            writeText(buffer, width, x, y + 4, " ██ ██  ", iconAttr);
            break;
            
        case "PALM":
            writeText(buffer, width, x, y + 0, " \\│/ \\│/", iconAttr);
            writeText(buffer, width, x, y + 1, "  \\│/   ", iconAttr);
            writeText(buffer, width, x, y + 2, "   █    ", iconAttr);
            writeText(buffer, width, x, y + 3, "   █    ", iconAttr);
            writeText(buffer, width, x, y + 4, "  ███   ", iconAttr);
            break;
            
        case "BRIDGE":
        case "BRIDGE2":
            writeText(buffer, width, x, y + 0, "        ", iconAttr);
            writeText(buffer, width, x, y + 1, "┬──────┬", iconAttr);
            writeText(buffer, width, x, y + 2, "│\\    /│", iconAttr);
            writeText(buffer, width, x, y + 3, "│ \\  / │", iconAttr);
            writeText(buffer, width, x, y + 4, "│  \\/  │", iconAttr);
            break;
            
        case "THUNDER":
            writeText(buffer, width, x, y + 0, "   ██   ", brightAttr);
            writeText(buffer, width, x, y + 1, "  ██    ", brightAttr);
            writeText(buffer, width, x, y + 2, " █████  ", iconAttr);
            writeText(buffer, width, x, y + 3, "    ██  ", brightAttr);
            writeText(buffer, width, x, y + 4, "   ██   ", brightAttr);
            break;
            
        case "WOLF":
            writeText(buffer, width, x, y + 0, " ▄█  █▄ ", iconAttr);
            writeText(buffer, width, x, y + 1, "  ████  ", iconAttr);
            writeText(buffer, width, x, y + 2, "  ●██●  ", iconAttr);
            writeText(buffer, width, x, y + 3, "   ▼▼   ", iconAttr);
            writeText(buffer, width, x, y + 4, "  ████  ", iconAttr);
            break;
            
        default:
            // Default basketball icon
            writeText(buffer, width, x, y + 0, "  ████  ", iconAttr);
            writeText(buffer, width, x, y + 1, " ██████ ", iconAttr);
            writeText(buffer, width, x, y + 2, " ██████ ", iconAttr);
            writeText(buffer, width, x, y + 3, " ██████ ", iconAttr);
            writeText(buffer, width, x, y + 4, "  ████  ", iconAttr);
            break;
    }
}

/**
 * Write buffer to a .bin file
 */
function writeBuffer(filename, buffer) {
    var f = new File(filename);
    if (!f.open("wb")) {
        log(LOG_ERR, "Failed to open " + filename + " for writing");
        return false;
    }
    
    for (var i = 0; i < buffer.length; i++) {
        f.writeBin(buffer[i], 1);
    }
    
    f.close();
    log(LOG_INFO, "Wrote " + filename);
    return true;
}

/**
 * Main
 */
function main() {
    log(LOG_INFO, "=== City Art Generator ===");
    
    // Load cities
    var f = new File(CITIES_JSON);
    if (!f.open("r")) {
        log(LOG_ERR, "Failed to open cities.json");
        return 1;
    }
    
    var cities = JSON.parse(f.read());
    f.close();
    
    log(LOG_INFO, "Loaded " + cities.length + " cities");
    
    // Create default files first
    var defaultBannerBuffer = createBuffer(BANNER_W, BANNER_H);
    fillRect(defaultBannerBuffer, BANNER_W, 0, 0, BANNER_W, BANNER_H, 32, attr(WHITE, BLUE));
    writeText(defaultBannerBuffer, BANNER_W, 30, 1, "LEGEND OF THE RED BULL", attr(YELLOW, BLUE));
    hLine(defaultBannerBuffer, BANNER_W, 0, 0, BANNER_W, BLOCK_DOUBLE_HORIZ, attr(WHITE, BLUE));
    hLine(defaultBannerBuffer, BANNER_W, 0, 3, BANNER_W, BLOCK_DOUBLE_HORIZ, attr(WHITE, BLUE));
    writeBuffer(OUTPUT_DIR + "default_banner.bin", defaultBannerBuffer);
    
    var defaultDetailBuffer = createBuffer(DETAIL_W, DETAIL_H);
    fillRect(defaultDetailBuffer, DETAIL_W, 0, 0, DETAIL_W, DETAIL_H, BLOCK_LIGHT, attr(DARKGRAY, BLUE));
    writeText(defaultDetailBuffer, DETAIL_W, 12, 10, "RIM CITY", attr(WHITE, BLUE));
    writeBuffer(OUTPUT_DIR + "default_detail.bin", defaultDetailBuffer);
    
    // Generate art for each city
    for (var i = 0; i < cities.length; i++) {
        var city = cities[i];
        
        // Banner
        var bannerBuffer = generateBanner(city);
        var bannerFile = OUTPUT_DIR + city.id + "_banner.bin";
        writeBuffer(bannerFile, bannerBuffer);
        
        // Detail
        var detailBuffer = generateDetail(city);
        var detailFile = OUTPUT_DIR + city.id + "_detail.bin";
        writeBuffer(detailFile, detailBuffer);
        
        log(LOG_INFO, "Generated art for: " + city.cityName);
    }
    
    log(LOG_INFO, "=== Done! ===");
    return 0;
}

exit(main());
