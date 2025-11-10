(function (global) {
    var DEFAULT_WIDTH = 80;
    var DEFAULT_HEIGHT = 24;
    var COLUMN_WIDTH = 40;
    var MESSAGE_HEIGHT = 2;
    var LOADER_HEIGHT = 20;
    var STATUS_HEIGHT = 2;
    var DEFAULT_TRANSITION_MS = 2500;

    var activeDisplay = null;
    var lastLayoutError = null;

    function nowMs() {
        if (typeof getTimeMs === "function") return getTimeMs();
        if (typeof Date !== "undefined" && Date.now) return Date.now();
        if (typeof time === "function") return time() * 1000;
        return 0;
    }

    function repeatCharLocal(ch, count) {
        var out = "";
        var iterations = Math.max(0, count || 0);
        for (var i = 0; i < iterations; i++) out += ch;
        return out;
    }

    function padCenterLocal(text, width) {
        var str = String(text || "");
        var maxWidth = Math.max(0, width || 0);
        if (str.length >= maxWidth) return str.substring(0, maxWidth);
        var totalPad = maxWidth - str.length;
        var left = Math.floor(totalPad / 2);
        var right = totalPad - left;
        return repeatCharLocal(" ", left) + str + repeatCharLocal(" ", right);
    }

    function clampLocal(value, min, max) {
        if (typeof clamp === "function") return clamp(value, min, max);
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    function hasConsole() {
        return typeof console !== "undefined";
    }

    function hasAnsiSupport() {
        return hasConsole() && typeof File === "function";
    }

    function streamAnsiFile(path) {
        if (!path || !hasAnsiSupport()) return false;
        var file = new File(path);
        if (!file.exists) return false;

        if (typeof console.printfile === "function") {
            try {
                var printableName = file.name || path;
                console.printfile(printableName);
                return true;
            } catch (e) {
                // fall through to manual streaming
            }
        }

        if (!file.open("rb")) return false;
        try {
            var mode = (typeof P_SAVEATR === "number") ? P_SAVEATR : 0;
            while (!file.eof) {
                var chunk = file.read(4096);
                if (!chunk) break;
                if (typeof console.putmsg === "function") {
                    console.putmsg(chunk, mode);
                } else if (typeof console.print === "function") {
                    console.print(chunk);
                } else {
                    return false;
                }
            }
        } finally {
            file.close();
        }
        return true;
    }

    function ansiFileExists(path) {
        if (!path || !hasAnsiSupport()) return false;
        var file = new File(path);
        return !!file.exists;
    }

    function hasFrameSupport() {
        return typeof Frame === "function" && hasConsole();
    }

    function closeFrame(frame) {
        if (!frame || typeof frame.close !== "function") return;
        try {
            frame.close();
        } catch (e) {
            // Ignore frame teardown errors
        }
    }

    function cleanupLayout() {
        if (!activeDisplay) return;
        for (var i = 0; i < activeDisplay.columnFrames.length; i++) {
            var column = activeDisplay.columnFrames[i];
            if (!column) continue;
            closeFrame(column.message);
            closeFrame(column.loader);
            closeFrame(column.status);
            closeFrame(column.container);
        }
        closeFrame(activeDisplay.rootFrame);
        activeDisplay = null;
    }

    function computeFrameSpec(parentFrame) {
        var width, height, startX, startY, parentRef = null;

        if (parentFrame) {
            parentRef = parentFrame;
            var parentWidth = Math.max(1, parentFrame.width || DEFAULT_WIDTH);
            var parentHeight = Math.max(1, parentFrame.height || DEFAULT_HEIGHT);
            width = Math.min(DEFAULT_WIDTH, parentWidth);
            height = Math.min(DEFAULT_HEIGHT, parentHeight);
            startX = Math.max(1, Math.floor((parentWidth - width) / 2) + 1);
            startY = Math.max(1, Math.floor((parentHeight - height) / 2) + 1);
            return { width: width, height: height, x: startX, y: startY, parent: parentRef };
        }

        var screenCols = hasConsole() && typeof console.screen_columns === "number" ? console.screen_columns : DEFAULT_WIDTH;
        var screenRows = hasConsole() && typeof console.screen_rows === "number" ? console.screen_rows : DEFAULT_HEIGHT;
        width = Math.min(DEFAULT_WIDTH, screenCols);
        height = Math.min(DEFAULT_HEIGHT, screenRows);
        startX = Math.max(1, Math.floor((screenCols - width) / 2) + 1);
        startY = Math.max(1, Math.floor((screenRows - height) / 2) + 1);
        return { width: width, height: height, x: startX, y: startY, parent: null };
    }

    function createChildFrame(parentFrame, relX, relY, width, height, attr) {
        if (!parentFrame) {
            throw new Error("createChildFrame requires a parent frame");
        }
        var relStartX = Math.max(1, relX || 1);
        var relStartY = Math.max(1, relY || 1);
        var offsetX = relStartX - 1;
        var offsetY = relStartY - 1;
        var baseX = parentFrame.x + offsetX;
        var baseY = parentFrame.y + offsetY;
        var availableWidth = parentFrame.width - offsetX;
        var availableHeight = parentFrame.height - offsetY;
        if (availableWidth < 1 || availableHeight < 1) {
            throw new Error("Child frame exceeds parent bounds");
        }
        var childWidth = Math.max(1, Math.min(width || availableWidth, availableWidth));
        var childHeight = Math.max(1, Math.min(height || availableHeight, availableHeight));
        return new Frame(baseX, baseY, childWidth, childHeight, attr, parentFrame);
    }

    function createColumnSections(containerFrame, options) {
        var height = containerFrame.height || DEFAULT_HEIGHT;
        var messageHeight = Math.min(MESSAGE_HEIGHT, height);
        if (messageHeight <= 0) messageHeight = Math.min(2, height);
        var statusHeight = Math.min(STATUS_HEIGHT, Math.max(1, height - messageHeight - 1));
        var loaderHeight = Math.max(1, height - messageHeight - statusHeight);

        var messageAttr = options && typeof options.messageAttr === "number" ? options.messageAttr : (BG_BLUE | WHITE);
        var loaderAttr = options && typeof options.loaderAttr === "number" ? options.loaderAttr : (BG_BLACK | LIGHTGRAY);
        var statusAttr = options && typeof options.statusAttr === "number" ? options.statusAttr : (BG_BLACK | CYAN);

        var messageFrame = createChildFrame(containerFrame, 1, 1, containerFrame.width, messageHeight, messageAttr);
        messageFrame.open();
        var loaderFrame = createChildFrame(containerFrame, 1, messageHeight + 1, containerFrame.width, loaderHeight, loaderAttr);
        loaderFrame.open();
        var statusFrame = createChildFrame(containerFrame, 1, messageHeight + loaderHeight + 1, containerFrame.width, statusHeight, statusAttr);
        statusFrame.open();

        return {
            container: containerFrame,
            message: messageFrame,
            loader: loaderFrame,
            status: statusFrame
        };
    }

    function ensureLayout(options) {
        cleanupLayout();
        lastLayoutError = null;
        if (!hasFrameSupport()) return null;

        var spec = computeFrameSpec(options && options.parentFrame);
        var frameAttr = options && typeof options.attr === "number" ? options.attr : (BG_BLACK | LIGHTGRAY);
        var rootFrame, leftFrame, rightFrame, leftSections, rightSections;

        try {
            rootFrame = new Frame(spec.x, spec.y, spec.width, spec.height, frameAttr, spec.parent);
            rootFrame.open();
            if (typeof drawFrameBorder === "function") {
                drawFrameBorder(rootFrame, { color: frameAttr });
            }

            var columnAttr = options && typeof options.columnAttr === "number" ? options.columnAttr : (BG_BLACK | LIGHTGRAY);
            var baseWidth = rootFrame.width || spec.width;
            var columnWidth = Math.min(COLUMN_WIDTH, Math.floor(baseWidth / 2));
            if (columnWidth <= 0) columnWidth = Math.max(1, Math.floor(baseWidth / 2));
            if (columnWidth <= 0) columnWidth = 1;
            var leftWidth = columnWidth;
            var rightWidth = baseWidth - leftWidth;
            if (rightWidth <= 0) {
                rightWidth = leftWidth;
                leftWidth = Math.max(1, baseWidth - rightWidth);
            }

            leftFrame = createChildFrame(rootFrame, 1, 1, leftWidth, rootFrame.height, columnAttr);
            leftFrame.open();
            rightFrame = createChildFrame(rootFrame, leftWidth + 1, 1, rightWidth, rootFrame.height, columnAttr);
            rightFrame.open();

            leftSections = createColumnSections(leftFrame, options);
            rightSections = createColumnSections(rightFrame, options);

            activeDisplay = {
                rootFrame: rootFrame,
                columnFrames: [leftSections, rightSections]
            };
            return activeDisplay;
        } catch (layoutErr) {
            closeFrame(leftFrame);
            closeFrame(rightFrame);
            closeFrame(rootFrame);
            activeDisplay = null;
            lastLayoutError = layoutErr;
            return null;
        }
    }

    function fillFrame(frame, attr) {
        if (!frame) return;
        var width = Math.max(0, frame.width || 0);
        var height = Math.max(0, frame.height || 0);
        var blankLine = repeatCharLocal(" ", width);
        for (var row = 1; row <= height; row++) {
            frame.gotoxy(1, row);
            frame.putmsg(blankLine, attr);
        }
    }

    function writeCentered(frame, text, row, attr) {
        if (!frame || !text) return;
        var content = String(text);
        if (content.length > frame.width) {
            content = content.substring(0, frame.width);
        }
        var start = Math.max(1, Math.floor((frame.width - content.length) / 2) + 1);
        frame.gotoxy(start, row);
        frame.putmsg(content, attr);
    }

    function renderTextBlock(frame, lines, attr) {
        if (!frame) return;
        fillFrame(frame, attr);
        var maxRows = frame.height || 0;
        var startRow = 1;
        if (lines.length < maxRows) {
            startRow = Math.max(1, Math.floor((maxRows - lines.length) / 2) + 1);
        }
        for (var i = 0; i < lines.length && (startRow + i) <= maxRows; i++) {
            var text = lines[i];
            if (text.length > frame.width) text = text.substring(0, frame.width);
            frame.gotoxy(1, startRow + i);
            frame.putmsg(text, attr);
        }
    }

    function drawPlaceholderColumn(columnCtx, placeholderText) {
        if (!columnCtx) return;
        var headline = placeholderText || "Awaiting opponent data";
        fillFrame(columnCtx.message, columnCtx.message.attr);
        writeCentered(columnCtx.message, headline.toUpperCase(), 1, columnCtx.message.attr);
        if (columnCtx.message.height > 1) {
            writeCentered(columnCtx.message, "", columnCtx.message.height, columnCtx.message.attr);
        }

        var loaderLines = [
            "Scanning league files...",
            "Please wait."
        ];
        renderTextBlock(columnCtx.loader, loaderLines, columnCtx.loader.attr);

        fillFrame(columnCtx.status, columnCtx.status.attr);
        writeCentered(columnCtx.status, "Press any key to refresh", 1, columnCtx.status.attr);
        if (columnCtx.status.height > 1) {
            writeCentered(columnCtx.status, "", columnCtx.status.height, columnCtx.status.attr);
        }

        cycleFrame(columnCtx.message);
        cycleFrame(columnCtx.loader);
        cycleFrame(columnCtx.status);
    }

    function formatBytes(size) {
        if (typeof size !== "number" || size <= 0) return "";
        if (size >= 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + " MB";
        if (size >= 1024) return (size / 1024).toFixed(1) + " KB";
        return size + " B";
    }

    function buildLoaderLines(entry) {
        var lines = [];
        if (!entry) {
            lines.push("No scouting report available.");
            return lines;
        }

        if (entry.id) lines.push("ID: " + entry.id);
        if (entry.fileName) lines.push("Asset: " + entry.fileName);
        if (entry.size) lines.push("Size: " + formatBytes(entry.size));
        if (entry.position) lines.push("Position: " + entry.position);

        var stats = entry.stats || {};
        var statPairs = [
            ["SPD", stats.speed],
            ["POW", stats.power],
            ["3PT", stats["3point"]],
            ["STL", stats.steal],
            ["BLK", stats.block],
            ["DNK", stats.dunk]
        ];

        for (var i = 0; i < statPairs.length; i += 2) {
            var leftStat = statPairs[i];
            var rightStat = statPairs[i + 1];
            if (!leftStat && !rightStat) continue;
            var line = "";
            if (leftStat && leftStat[1] !== undefined) {
                line += leftStat[0] + ": " + leftStat[1];
            } else if (leftStat) {
                line += leftStat[0] + ": -";
            }
            if (rightStat) {
                var spacer = line.length > 0 ? "    " : "";
                line += spacer + rightStat[0] + ": " + (rightStat[1] !== undefined ? rightStat[1] : "-");
            }
            if (line) lines.push(line);
        }

        if (entry.status) lines.push(entry.status);
        if (!lines.length) lines.push("Scouting data pending...");
        return lines;
    }

    function drawMessageFrame(frame, entry) {
        if (!frame) return;
        var headline = entry ? (entry.name || entry.id || "Opponent") : "Awaiting Opponent";
        var subline = "";
        if (entry) {
            if (entry.team) subline = entry.team;
            else if (entry.position) subline = entry.position;
        }
        fillFrame(frame, frame.attr);
        writeCentered(frame, headline.toUpperCase(), 1, frame.attr);
        if (frame.height > 1) {
            writeCentered(frame, subline, frame.height, frame.attr);
        }
        cycleFrame(frame);
    }

    function tryLoadAnsiIntoFrame(frame, entry) {
        if (!frame || !entry || !entry.path) return false;
        if (!hasAnsiSupport()) return false;
        var artPath = entry.ansiPath || entry.path;
        var artFile = new File(artPath);
        if (!artFile.exists) return false;
        try {
            frame.clear(frame.attr);
            // Assets are authored at 40x20 characters; pass dimensions so Frame
            // renders the content without relying on SAUCE metadata.
            frame.load(artPath, 40, 20);
            return true;
        } catch (err) {
            if (hasConsole() && typeof console.print === "function") {
                console.print("\r\n\1h\1rOpponent art load failed: " + err + "\1n\r\n");
            }
            return false;
        }
    }

    function drawLoaderFrame(frame, entry) {
        if (!frame) return;
        if (entry && tryLoadAnsiIntoFrame(frame, entry)) {
            cycleFrame(frame);
            return;
        }
        var lines = buildLoaderLines(entry);
        renderTextBlock(frame, lines, frame.attr);
        cycleFrame(frame);
    }

    function drawStatusFrame(frame, entry, talkText) {
        if (!frame) return;
        var line1 = entry ? (entry.team || entry.normalizedTeam || "") : "";
        var line2 = talkText || (entry ? entry.status || "" : "");
        fillFrame(frame, frame.attr);
        if (line1) {
            writeCentered(frame, line1, 1, frame.attr);
        }
        if (frame.height > 1) {
            writeCentered(frame, line2 || "", frame.height, frame.attr);
        }
        cycleFrame(frame);
    }

    function drawColumn(columnCtx, entry, talkText, options) {
        if (!columnCtx) return;
        if (!entry) {
            drawPlaceholderColumn(columnCtx, options && options.emptySlotMessage);
            return;
        }
        drawMessageFrame(columnCtx.message, entry);
        drawLoaderFrame(columnCtx.loader, entry);
        drawStatusFrame(columnCtx.status, entry, talkText);
    }

    function waitForAdvance(options) {
        if (!hasConsole()) return;
        var allowKeys = !options || options.allowKeyAdvance !== false;
        var duration = options && typeof options.transitionMs === "number" ? options.transitionMs : DEFAULT_TRANSITION_MS;

        if (duration <= 0) {
            if (allowKeys && typeof console.getkey === "function") {
                console.getkey();
            }
            return;
        }

        var start = nowMs();
        var keyMask = typeof K_NONE !== "undefined" ? K_NONE : 0;
        while (nowMs() - start < duration) {
            if (allowKeys && typeof console.inkey === "function") {
                var key = console.inkey(keyMask, 50);
                if (key) return;
            }
            if (typeof mswait === "function") {
                mswait(25);
            } else {
                break;
            }
        }
    }

    function normalizeEntry(entry, index) {
        if (!entry) return null;
        var name = entry.name || entry.player_name || entry.playerName || entry.displayName || entry.id || entry.fileName || ("Opponent " + (index + 1));
        var team = entry.team || entry.teamName || entry.team_key || entry.teamKey || entry.player_team || entry.playerTeam || "Unknown";
        var normalizedTeam = team ? String(team).toUpperCase() : "UNKNOWN";
        var stats = {};
        var statFields = ["speed", "3point", "power", "steal", "block", "dunk"];
        for (var i = 0; i < statFields.length; i++) {
            var key = statFields[i];
            if (typeof entry[key] === "number") stats[key] = entry[key];
            else if (entry.stats && typeof entry.stats[key] === "number") stats[key] = entry.stats[key];
        }
        return {
            raw: entry,
            id: entry.id || entry.player_id || entry.playerId || entry.slug || entry.fileName || ("opponent_" + index),
            name: name,
            team: team,
            normalizedTeam: normalizedTeam,
            fileName: entry.fileName || entry.assetName || null,
            path: entry.path || entry.assetPath || entry.ansiPath || null,
            size: typeof entry.size === "number" ? entry.size : null,
            position: entry.position || entry.pos || entry.player_position || null,
            stats: stats,
            status: entry.status || entry.statusText || entry.info || ""
        };
    }

    function normalizeEntries(data) {
        var list = [];
        if (Array.isArray(data)) {
            for (var i = 0; i < data.length && list.length < 4; i++) {
                var normalized = normalizeEntry(data[i], i);
                if (normalized) list.push(normalized);
            }
        } else if (data) {
            var single = normalizeEntry(data, 0);
            if (single) list.push(single);
        }
        return list;
    }

    function sameTeam(a, b) {
        if (!a || !b) return false;
        return a.normalizedTeam === b.normalizedTeam;
    }

    function groupByTeam(entries) {
        var groups = {};
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            var key = entry.normalizedTeam || "UNKNOWN";
            if (!groups[key]) groups[key] = [];
            groups[key].push(entry);
        }
        return groups;
    }

    function createTrashTalk(talker, target) {
        var talkerName = talker && talker.name ? talker.name : "Unknown";
        var targetName = target && target.name ? target.name : "someone";
        var talkerTeam = talker && talker.team ? talker.team : "their squad";
        var lines = [
            talkerName + " (" + talkerTeam + ") wants a piece of " + targetName + ".",
            talkerName + " barks: you're next, " + targetName + "!",
            talkerName + " says " + targetName + " can't guard them."
        ];
        return lines[Math.floor(Math.random() * lines.length)];
    }

    function createTeamTrashTalk(team1, team2) {
        var left = team1 || "Team A";
        var right = team2 || "Team B";
        if (left === right) {
            return left + " is flexing their depth!";
        }
        return left + " squares up with " + right + ".";
    }

    function buildTwoEntrySequences(entries) {
        var left = entries[0];
        var right = entries[1];
        var same = sameTeam(left, right);
        return [{
            leftEntry: left,
            rightEntry: right,
            leftTalk: same ? createTeamTrashTalk(left.team, right.team) : createTrashTalk(left, right),
            rightTalk: same ? createTeamTrashTalk(right.team, left.team) : createTrashTalk(right, left)
        }];
    }

    function buildThreeEntrySequences(entries) {
        var groups = groupByTeam(entries);
        var dominantKey = null;
        var keys = [];
        var maxCount = 0;
        for (var key in groups) {
            if (!groups.hasOwnProperty(key)) continue;
            var count = groups[key].length;
            keys.push(key);
            if (count > maxCount) {
                maxCount = count;
                dominantKey = key;
            }
        }
        if (!dominantKey) dominantKey = keys[0];
        var dominantEntries = groups[dominantKey] || [];
        var others = [];
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].normalizedTeam !== dominantKey) others.push(entries[i]);
        }
        var sequences = [];
        if (dominantEntries.length >= 2) {
            var teamTalk = createTeamTrashTalk(dominantEntries[0].team, others.length ? others[0].team : dominantEntries[0].team);
            sequences.push({
                leftEntry: dominantEntries[0],
                rightEntry: dominantEntries[1],
                leftTalk: teamTalk,
                rightTalk: teamTalk
            });
        } else {
            sequences = sequences.concat(buildTwoEntrySequences(entries.slice(0, 2)));
        }
        if (others.length) {
            sequences.push({
                leftEntry: others[0],
                rightEntry: null,
                leftTalk: createTrashTalk(others[0], dominantEntries[0] || others[0]),
                rightTalk: ""
            });
        }
        return sequences;
    }

    function buildFourEntrySequences(entries) {
        var groups = groupByTeam(entries);
        var keys = [];
        for (var key in groups) {
            if (groups.hasOwnProperty(key)) keys.push(key);
        }
        if (keys.length < 2) return buildTwoEntrySequences(entries.slice(0, 2));
        keys.sort(function (a, b) { return groups[b].length - groups[a].length; });
        var firstTeamEntries = groups[keys[0]].slice(0, 2);
        var secondTeamEntries = groups[keys[1]].slice(0, 2);
        var sequences = [];
        sequences.push({
            leftEntry: firstTeamEntries[0] || null,
            rightEntry: firstTeamEntries[1] || null,
            leftTalk: createTeamTrashTalk(firstTeamEntries[0] ? firstTeamEntries[0].team : null, secondTeamEntries[0] ? secondTeamEntries[0].team : null),
            rightTalk: createTeamTrashTalk(firstTeamEntries[1] ? firstTeamEntries[1].team : null, secondTeamEntries[0] ? secondTeamEntries[0].team : null)
        });
        sequences.push({
            leftEntry: secondTeamEntries[0] || null,
            rightEntry: secondTeamEntries[1] || null,
            leftTalk: createTeamTrashTalk(secondTeamEntries[0] ? secondTeamEntries[0].team : null, firstTeamEntries[0] ? firstTeamEntries[0].team : null),
            rightTalk: createTeamTrashTalk(secondTeamEntries[1] ? secondTeamEntries[1].team : null, firstTeamEntries[0] ? firstTeamEntries[0].team : null)
        });
        return sequences;
    }

    function buildSequences(entries) {
        if (!entries.length) return [];
        if (entries.length === 1) return [{ leftEntry: entries[0], rightEntry: null, leftTalk: "", rightTalk: "" }];
        if (entries.length === 2) return buildTwoEntrySequences(entries);
        if (entries.length === 3) return buildThreeEntrySequences(entries);
        return buildFourEntrySequences(entries);
    }

    function renderSequence(layout, sequence, options) {
        drawColumn(layout.columnFrames[0], sequence.leftEntry, sequence.leftTalk, options);
        drawColumn(layout.columnFrames[1], sequence.rightEntry, sequence.rightTalk, options);
        cycleFrame(layout.rootFrame);
    }

    function renderNoOpponents(layout, options) {
        var message = (options && options.emptySlotMessage) || "No opponents found";
        drawPlaceholderColumn(layout.columnFrames[0], message);
        drawPlaceholderColumn(layout.columnFrames[1], message);
        if (layout.rootFrame) {
            writeCentered(layout.rootFrame, message.toUpperCase(), Math.floor((layout.rootFrame.height || DEFAULT_HEIGHT) / 2), layout.rootFrame.attr);
            cycleFrame(layout.rootFrame);
        }
    }

    function fallbackConsoleRender(entries) {
        if (!hasConsole() || typeof console.print !== "function") return;
        var reason = null;
        if (!hasFrameSupport()) {
            reason = "frame support unavailable";
        } else if (lastLayoutError && lastLayoutError.message) {
            reason = lastLayoutError.message;
        }
        var header = "\r\nOpponent display unavailable";
        if (reason) header += " (" + reason + ")";
        console.print(header + ".\r\n");
        if (!entries.length) {
            console.print("No opponents found.\r\n");
            return;
        }
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            console.print("- " + entry.name + " (" + entry.team + ")\r\n");
        }
    }

    function renderAnsiOpponent(entry, options) {
        if (!entry || !entry.path) return false;
        if (!hasAnsiSupport() || !ansiFileExists(entry.path)) return false;

        if (!options || options.clearScreen !== false) {
            try {
                if (typeof console.clear === "function") console.clear();
            } catch (e) {
                // ignore console clear failures
            }
        }

        var rendered = false;
        try {
            rendered = streamAnsiFile(entry.path);
        } catch (err) {
            if (hasConsole() && typeof console.print === "function") {
                console.print("\r\n\1h\1rUnable to load opponent art: " + err + "\1n\r\n");
            }
            rendered = false;
        }
        if (!rendered) return false;

        var prompt = (options && options.promptText) || "Press any key to continue...";
        if (prompt && typeof console.print === "function") {
            console.print("\r\n" + prompt + "\r\n");
        }

        waitForAdvance({
            allowKeyAdvance: options && options.allowKeyAdvance !== false,
            transitionMs: options && typeof options.transitionMs === "number" ? options.transitionMs : 0
        });
        return true;
    }

    function renderOpponentDisplay(data, options) {
        var entries = normalizeEntries(data);
        var layout = ensureLayout(options);
        if (!layout) {
            fallbackConsoleRender(entries);
            return null;
        }
        if (!entries.length) {
            renderNoOpponents(layout, options);
            return layout;
        }
        var sequences = buildSequences(entries);
        for (var i = 0; i < sequences.length; i++) {
            renderSequence(layout, sequences[i], options);
            if (i < sequences.length - 1) {
                waitForAdvance(options);
            }
        }
        return layout;
    }

    function destroyOpponentDisplay() {
        cleanupLayout();
    }

    var OpponentDisplay = {
        render: renderOpponentDisplay,
        renderAnsiOpponent: renderAnsiOpponent,
        destroy: destroyOpponentDisplay,
        createTrashTalk: createTrashTalk,
        createTeamTrashTalk: createTeamTrashTalk
    };

    global.LORBShared = global.LORBShared || {};
    global.LORBShared.OpponentDisplay = OpponentDisplay;

    if (typeof module !== "undefined" && module.exports) {
        module.exports = OpponentDisplay;
    }
})(this);
