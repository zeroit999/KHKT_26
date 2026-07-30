#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

stop_process_tree() {
    local pid="$1"

    # Không tồn tại thì bỏ qua
    if ! kill -0 "$pid" 2>/dev/null; then
        return
    fi

    # Dừng các tiến trình con trước
    local children
    children=$(pgrep -P "$pid" || true)

    for child in $children; do
        stop_process_tree "$child"
    done

    kill "$pid" 2>/dev/null || true

    # Chờ tối đa 3 giây
    for _ in {1..10}; do
        if ! kill -0 "$pid" 2>/dev/null; then
            return
        fi
        sleep 0.3
    done

    # Nếu vẫn còn thì kill -9
    kill -9 "$pid" 2>/dev/null || true
}

for name in frontend backend emulators; do
    PID_FILE="$PROJECT_ROOT/.local-$name.pid"

    if [[ -f "$PID_FILE" ]]; then
        PID="$(cat "$PID_FILE")"

        stop_process_tree "$PID"

        rm -f "$PID_FILE"

        echo "Đã dừng $name (PID $PID)"
    fi
done

echo
echo "Đã dừng toàn bộ dịch vụ local."