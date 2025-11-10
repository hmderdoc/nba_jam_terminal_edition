#!/usr/bin/env bash
# View error log with timestamps and context

ERROR_LOG="error.log"

if [ ! -f "$ERROR_LOG" ]; then
    echo "No error log found at $ERROR_LOG"
    exit 1
fi

echo "=== NBA JAM Error Log ==="
echo ""

# Show last 50 lines with color
tail -50 "$ERROR_LOG" | sed 's/FATAL/\x1b[31;1mFATAL\x1b[0m/g' | sed 's/ERROR/\x1b[31mERROR\x1b[0m/g' | sed 's/WARN/\x1b[33mWARN\x1b[0m/g'

echo ""
echo "=== Summary ==="
echo "Total errors: $(grep -c '\[' "$ERROR_LOG" 2>/dev/null || echo 0)"
echo "Fatal: $(grep -c 'FATAL' "$ERROR_LOG" 2>/dev/null || echo 0)"
echo "Errors: $(grep -c 'ERROR' "$ERROR_LOG" 2>/dev/null || echo 0)"
echo "Warnings: $(grep -c 'WARN' "$ERROR_LOG" 2>/dev/null || echo 0)"
echo ""
echo "Snapshots available: $(ls -1 error-snapshots/*.json 2>/dev/null | wc -l)"
