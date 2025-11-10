// NBA Jam Ball Rendering Utilities
// Manages the dedicated frame used to draw the basketball sprite overlay

var ballFrame = null;

function ensureBallFrame(x, y) {
    if (!courtFrame) return;

    var startX = (typeof x === "number") ? x : Math.floor(COURT_WIDTH / 2);
    var startY = (typeof y === "number") ? y : Math.floor(COURT_HEIGHT / 2);
    var offsetY = (typeof getCourtScreenOffsetY === "function") ? getCourtScreenOffsetY() : COURT_SCREEN_Y_OFFSET;
    var drawY = startY + offsetY;

    if (ballFrame && ballFrame.is_open && typeof ballFrame.moveTo === "function") {
        ballFrame.moveTo(startX, drawY);
        if (typeof ballFrame.putmsg === "function") {
            ballFrame.putmsg("o");
        }
        return;
    }

    if (ballFrame && typeof ballFrame.close === "function") {
        try {
            ballFrame.close();
        } catch (closeErr) {
            // Ignore close errors; frame will be recreated below
        }
    }

    ballFrame = new Frame(startX, drawY, 1, 1, YELLOW | WAS_BROWN, courtFrame);
    if (typeof ballFrame.putmsg === "function") {
        ballFrame.putmsg("o");
    }
    ballFrame.open();
}

function moveBallFrameTo(x, y) {
    if (typeof x !== "number" || typeof y !== "number") return;

    var clampedX = clamp(Math.round(x), 1, COURT_WIDTH);
    var clampedY = clamp(Math.round(y), 1, COURT_HEIGHT);

    if (!ballFrame || !ballFrame.is_open) {
        ensureBallFrame(clampedX, clampedY);
        return;
    }

    if (typeof ballFrame.moveTo === "function") {
        var offsetY = (typeof getCourtScreenOffsetY === "function") ? getCourtScreenOffsetY() : COURT_SCREEN_Y_OFFSET;
        ballFrame.moveTo(clampedX, clampedY + offsetY);
    }
}
