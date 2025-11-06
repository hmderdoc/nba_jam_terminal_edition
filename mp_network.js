// mp_network.js - Network Quality Monitoring & Display
// Tracks connection quality and adapts game performance

load("mp_config.js");

function NetworkMonitor(client, sessionId) {
    this.client = client;
    this.sessionId = sessionId;

    // Latency tracking
    this.latencySamples = [];
    this.maxSamples = 20;
    this.currentLatency = 0;
    this.avgLatency = 0;
    this.minLatency = 999;
    this.maxLatency = 0;

    // Packet tracking
    this.packetsSent = 0;
    this.packetsReceived = 0;
    this.packetsLost = 0;
    this.lastSequence = 0;

    // Timing
    this.lastPingTime = 0;
    this.pingInterval = 2000; // Ping every 2 seconds

    // Quality metrics
    this.quality = "unknown";

    // Add latency sample
    this.addLatencySample = function(latency) {
        this.latencySamples.push(latency);

        if (this.latencySamples.length > this.maxSamples) {
            this.latencySamples.shift();
        }

        // Update stats
        this.currentLatency = latency;
        this.minLatency = Math.min(this.minLatency, latency);
        this.maxLatency = Math.max(this.maxLatency, latency);

        // Calculate average
        var sum = 0;
        for (var i = 0; i < this.latencySamples.length; i++) {
            sum += this.latencySamples[i];
        }
        this.avgLatency = Math.round(sum / this.latencySamples.length);

        // Determine quality
        this.updateQuality();
    };

    // Update quality assessment
    this.updateQuality = function() {
        var jitter = this.maxLatency - this.minLatency;

        if (this.avgLatency < 50 && jitter < 20) {
            this.quality = "excellent";
        } else if (this.avgLatency < 100 && jitter < 40) {
            this.quality = "good";
        } else if (this.avgLatency < 200 && jitter < 80) {
            this.quality = "fair";
        } else if (this.avgLatency < 350) {
            this.quality = "poor";
        } else {
            this.quality = "unplayable";
        }
    };

    // Periodic ping to coordinator
    this.ping = function() {
        var now = Date.now();

        if (now - this.lastPingTime < this.pingInterval) {
            return;
        }

        this.lastPingTime = now;

        try {
            var pingPacket = {
                from: user.number,
                sent: now,
                seq: this.packetsSent++
            };

            // Send ping
            var start = Date.now();
            this.client.write("nba_jam",
                "session." + this.sessionId + ".ping." + user.number,
                pingPacket, 2);

            // Read back (blocking with short timeout)
            var pong = this.client.read("nba_jam",
                "session." + this.sessionId + ".ping." + user.number, 1);

            var latency = Date.now() - start;
            this.addLatencySample(latency);

        } catch (e) {
            // Ping failed
        }
    };

    // Get adaptive tuning based on current network quality
    this.getAdaptiveTuning = function() {
        switch (this.quality) {
            case "excellent":
                return {
                    inputFlushInterval: 33,      // 30 FPS
                    stateUpdateInterval: 50,     // 20 FPS
                    reconciliationStrength: 0.6,
                    predictionFrames: 2
                };

            case "good":
                return {
                    inputFlushInterval: 50,      // 20 FPS
                    stateUpdateInterval: 75,     // 13 FPS
                    reconciliationStrength: 0.4,
                    predictionFrames: 3
                };

            case "fair":
                return {
                    inputFlushInterval: 75,      // 13 FPS
                    stateUpdateInterval: 100,    // 10 FPS
                    reconciliationStrength: 0.3,
                    predictionFrames: 5
                };

            case "poor":
                return {
                    inputFlushInterval: 100,     // 10 FPS
                    stateUpdateInterval: 150,    // 6 FPS
                    reconciliationStrength: 0.2,
                    predictionFrames: 7
                };

            default:
                return {
                    inputFlushInterval: 150,     // 6 FPS
                    stateUpdateInterval: 200,    // 5 FPS
                    reconciliationStrength: 0.1,
                    predictionFrames: 10
                };
        }
    };

    // Get quality indicator for display
    this.getQualityDisplay = function() {
        var indicator = getLatencyIndicator(this.avgLatency);

        return {
            text: indicator.text,
            color: indicator.color,
            bars: indicator.bars,
            latency: this.avgLatency,
            jitter: this.maxLatency - this.minLatency,
            quality: this.quality
        };
    };

    // Draw network stats overlay (for debugging)
    this.drawDebugOverlay = function(x, y) {
        if (!console || !console.gotoxy) return;

        var display = this.getQualityDisplay();

        console.gotoxy(x, y);
        console.print(format("\1h\1wNET:\1n %s%s\1n %dms",
            display.color, display.bars, display.latency));

        console.gotoxy(x, y + 1);
        console.print(format("\1n\1wJitter: %dms Quality: %s",
            display.jitter, display.quality.toUpperCase()));
    };
}

// Network quality HUD element for in-game display
function NetworkQualityHUD(frame, x, y, width) {
    this.frame = frame;
    this.x = x;
    this.y = y;
    this.width = width;
    this.monitor = null;

    this.setMonitor = function(monitor) {
        this.monitor = monitor;
    };

    this.render = function() {
        if (!this.monitor || !this.frame) return;

        var display = this.monitor.getQualityDisplay();

        // Simple bar display
        this.frame.gotoxy(this.x, this.y);

        var barText = format("%s %dms",
            display.bars,
            display.latency);

        this.frame.putmsg(barText, WHITE | BG_BLACK);
    };
}

// Packet loss detector
function PacketLossDetector() {
    this.expectedSequence = 0;
    this.received = 0;
    this.lost = 0;

    this.checkPacket = function(packet) {
        if (!packet || typeof packet.s !== "number") {
            return;
        }

        var seq = packet.s;

        if (seq > this.expectedSequence) {
            // We missed some packets
            this.lost += (seq - this.expectedSequence);
        }

        this.expectedSequence = seq + 1;
        this.received++;
    };

    this.getLossRate = function() {
        var total = this.received + this.lost;
        if (total === 0) return 0;

        return Math.round((this.lost / total) * 100);
    };

    this.shouldWarn = function() {
        return this.getLossRate() > 10;
    };
}

// Bandwidth monitor (rough estimate)
function BandwidthMonitor() {
    this.bytesSent = 0;
    this.bytesReceived = 0;
    this.lastReset = Date.now();
    this.intervalMs = 5000; // 5 second window

    this.recordSent = function(bytes) {
        this.bytesSent += bytes;
        this.checkReset();
    };

    this.recordReceived = function(bytes) {
        this.bytesReceived += bytes;
        this.checkReset();
    };

    this.checkReset = function() {
        var now = Date.now();
        if (now - this.lastReset > this.intervalMs) {
            this.lastReset = now;
        }
    };

    this.getRate = function() {
        var elapsed = (Date.now() - this.lastReset) / 1000;
        if (elapsed === 0) return { sent: 0, received: 0 };

        return {
            sent: Math.round(this.bytesSent / elapsed),      // bytes/sec
            received: Math.round(this.bytesReceived / elapsed)
        };
    };

    this.getDisplayRate = function() {
        var rate = this.getRate();

        function formatRate(bytesPerSec) {
            if (bytesPerSec < 1024) {
                return bytesPerSec + " B/s";
            } else if (bytesPerSec < 1024 * 1024) {
                return Math.round(bytesPerSec / 1024) + " KB/s";
            } else {
                return (bytesPerSec / (1024 * 1024)).toFixed(2) + " MB/s";
            }
        }

        return {
            sent: formatRate(rate.sent),
            received: formatRate(rate.received)
        };
    };
}

// Connection health checker
function ConnectionHealthChecker(client, sessionId) {
    this.client = client;
    this.sessionId = sessionId;
    this.lastSuccessfulRead = Date.now();
    this.timeoutMs = 10000; // 10 seconds without response = problem

    this.check = function() {
        try {
            // Try to read session metadata
            var meta = this.client.read("nba_jam",
                "session." + this.sessionId + ".meta", 1);

            if (meta) {
                this.lastSuccessfulRead = Date.now();
                return true;
            }

        } catch (e) {
            // Read failed
        }

        return this.isHealthy();
    };

    this.isHealthy = function() {
        return (Date.now() - this.lastSuccessfulRead) < this.timeoutMs;
    };

    this.getTimeSinceLastResponse = function() {
        return Date.now() - this.lastSuccessfulRead;
    };
}
