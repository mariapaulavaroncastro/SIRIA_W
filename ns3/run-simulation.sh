#!/usr/bin/env bash
set -eu

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
SOURCE="$SCRIPT_DIR/siriaw-mesh.cc"
EXECUTABLE="$SCRIPT_DIR/siriaw-mesh"

MODULES="ns3-applications ns3-core ns3-flow-monitor ns3-internet ns3-mobility ns3-network ns3-point-to-point"
if ! pkg-config --exists $MODULES; then
    echo "Faltan los módulos de desarrollo de NS-3. Instala ns3 y libns3-dev." >&2
    exit 1
fi

g++ -std=c++20 -O2 "$SOURCE" -o "$EXECUTABLE" \
    $(pkg-config --cflags --libs $MODULES)

cd "$PROJECT_DIR"
exec "$EXECUTABLE" \
    --duration="${DURATION_SECONDS:-30}" \
    --lossPercent="${LOSS_PERCENT:-0}" \
    --output=src/main/resources/static/ns3-metrics.json
