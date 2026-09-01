#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PROJECT_PORTS=(
    5000  # Flask backend
    5173  # Vite frontend
)

is_valid_pid() {
    local pid="${1:-}"

    [[ "$pid" =~ ^[0-9]+$ ]] && (( pid > 1 ))
}

stop_process_tree() {
    local pid="$1"
    local children child

    if ! is_valid_pid "$pid"; then
        return 0
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
        return 0
    fi

    children="$(pgrep -P "$pid" 2>/dev/null || true)"

    for child in $children; do
        stop_process_tree "$child"
    done

    kill -TERM "$pid" 2>/dev/null || true

    for _ in {1..10}; do
        if ! kill -0 "$pid" 2>/dev/null; then
            return 0
        fi

        sleep 0.3
    done

    kill -KILL "$pid" 2>/dev/null || true
}

stop_from_pid_file() {
    local name="$1"
    local pid_file="$PROJECT_ROOT/.local-$name.pid"
    local pid

    if [[ ! -f "$pid_file" ]]; then
        echo "Không tìm thấy PID file của $name."
        return 0
    fi

    pid="$(tr -d '[:space:]' < "$pid_file")"

    if ! is_valid_pid "$pid"; then
        echo "PID file của $name không hợp lệ: $pid_file"
        rm -f "$pid_file"
        return 0
    fi

    if kill -0 "$pid" 2>/dev/null; then
        stop_process_tree "$pid"
        echo "Đã dừng $name (PID $pid)."
    else
        echo "$name không còn chạy (PID cũ: $pid)."
    fi

    rm -f "$pid_file"
}

stop_port() {
    local port="$1"
    local pids pid

    pids="$(
        lsof -t \
            -iTCP:"$port" \
            -sTCP:LISTEN \
            2>/dev/null |
            sort -u ||
            true
    )"

    if [[ -z "$pids" ]]; then
        return 0
    fi

    echo "Phát hiện tiến trình còn giữ cổng $port: $pids"

    for pid in $pids; do
        if is_valid_pid "$pid"; then
            stop_process_tree "$pid"
        fi
    done
}

echo "Đang dừng các dịch vụ ZUNY local..."
echo "Thư mục dự án: $PROJECT_ROOT"
echo

for name in frontend backend; do
    stop_from_pid_file "$name"
done

echo
echo "Đang kiểm tra các cổng còn sót..."

for port in "${PROJECT_PORTS[@]}"; do
    stop_port "$port"
done

echo
echo "Kiểm tra lại..."

remaining=0

for port in "${PROJECT_PORTS[@]}"; do
    if lsof -t -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        echo "Cảnh báo: cổng $port vẫn đang được sử dụng."
        remaining=1
    fi
done

if (( remaining == 0 )); then
    echo "Đã dừng toàn bộ dịch vụ ZUNY local."
else
    echo "Một số dịch vụ chưa dừng hoàn toàn."
    echo "Kiểm tra bằng:"
    echo "sudo ss -lptn"
    exit 1
fi
