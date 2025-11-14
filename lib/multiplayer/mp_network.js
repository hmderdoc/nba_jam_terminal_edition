// mp_network.js - Network Quality Monitoring & Display
// Tracks connection quality and adapts game performance

load(js.exec_dir + "lib/multiplayer/mp_config.js");

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
    this.pingInterval = MP_CONSTANTS.PING_INTERVAL_MS || 2000;

    // Quality metrics
    this.quality = "unknown";

    // Add latency sample
    this.addLatencySample = function (latency) {
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
    this.updateQuality = function () {
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
    this.ping = function () {
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
    this.getAdaptiveTuning = function () {
        if (MP_CONSTANTS.ADAPTIVE_TUNING && MP_CONSTANTS.ADAPTIVE_TUNING[this.quality]) {
            return MP_CONSTANTS.ADAPTIVE_TUNING[this.quality];
        }
        if (MP_CONSTANTS.ADAPTIVE_TUNING && MP_CONSTANTS.ADAPTIVE_TUNING.default) {
            return MP_CONSTANTS.ADAPTIVE_TUNING.default;
        }
        return MP_CONSTANTS.TUNING_PRESETS.interbbs;
    };

    // Get quality indicator for display
    this.getQualityDisplay = function () {
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
    this.drawDebugOverlay = function (x, y) {
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

var networkGlobal = (typeof global !== "undefined") ? global : this;
if (networkGlobal) {
    networkGlobal.NetworkMonitor = NetworkMonitor;
    networkGlobal.measureLatency = measureLatency;
}
