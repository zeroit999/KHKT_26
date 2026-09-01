#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_ROOT="$PROJECT_ROOT/backend"
FRONTEND_ROOT="$PROJECT_ROOT/frontend"

PYTHON_PATH="$BACKEND_ROOT/venv311/bin/python"

BACKEND_OUT="$BACKEND_ROOT/backend-local.out.log"
BACKEND_ERR="$BACKEND_ROOT/backend-local.err.log"

FRONTEND_OUT="$FRONTEND_ROOT/frontend-local.out.log"
FRONTEND_ERR="$FRONTEND_ROOT/frontend-local.err.log"

wait_local_port() {
    local port="$1"
    local timeout="${2:-45}"
    local elapsed=0

    echo "Đang chờ cổng $port..."

    while (( elapsed < timeout * 2 )); do
        if (echo >"/dev/tcp/127.0.0.1/$port") >/dev/null 2>&1; then
            echo "Cổng $port đã sẵn sàng."
            return 0
        fi

        sleep 0.5
        ((elapsed += 1))
    done

    echo "Dịch vụ local trên cổng $port không khởi động kịp thời." >&2
    return 1
}

stop_old_process() {
    local pid_file="$1"
    local service_name="$2"

    if [[ ! -f "$pid_file" ]]; then
        return
    fi

    local old_pid
    old_pid="$(cat "$pid_file" 2>/dev/null || true)"

    if [[ -n "$old_pid" ]] && kill -0 "$old_pid" 2>/dev/null; then
        echo "Đang dừng $service_name cũ, PID $old_pid..."
        kill "$old_pid" 2>/dev/null || true

        for _ in {1..10}; do
            if ! kill -0 "$old_pid" 2>/dev/null; then
                break
            fi

            sleep 0.3
        done

        if kill -0 "$old_pid" 2>/dev/null; then
            kill -9 "$old_pid" 2>/dev/null || true
        fi
    fi

    rm -f "$pid_file"
}

if [[ ! -x "$PYTHON_PATH" ]]; then
    echo "Chưa có môi trường Python tại:" >&2
    echo "  $PYTHON_PATH" >&2
    echo >&2
    echo "Hãy chạy:" >&2
    echo "  python3.11 -m venv backend/venv311" >&2
    echo "  backend/venv311/bin/pip install -r backend/requirements.txt" >&2
    exit 1
fi

if ! command -v node >/dev/null 2>&1; then
    echo "Không tìm thấy Node.js." >&2
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "Không tìm thấy npm." >&2
    exit 1
fi

stop_old_process "$PROJECT_ROOT/.local-frontend.pid" "frontend"
stop_old_process "$PROJECT_ROOT/.local-backend.pid" "backend"

echo "Đang tạo/cập nhật dữ liệu PostgreSQL local..."

cd "$BACKEND_ROOT"
"$PYTHON_PATH" seed_local.py

echo "Đang khởi động backend..."

nohup "$PYTHON_PATH" app.py \
    >"$BACKEND_OUT" \
    2>"$BACKEND_ERR" &

BACKEND_PID=$!
echo "$BACKEND_PID" >"$PROJECT_ROOT/.local-backend.pid"

if ! wait_local_port 5000 45; then
    echo >&2
    echo "Backend không khởi động được." >&2
    echo "Xem log:" >&2
    echo "  $BACKEND_ERR" >&2
    exit 1
fi

echo "Đang khởi động frontend..."

cd "$FRONTEND_ROOT"

nohup npm run dev -- --host 127.0.0.1 \
    >"$FRONTEND_OUT" \
    2>"$FRONTEND_ERR" &

FRONTEND_PID=$!
echo "$FRONTEND_PID" >"$PROJECT_ROOT/.local-frontend.pid"

if ! wait_local_port 5173 45; then
    echo >&2
    echo "Frontend không khởi động được." >&2
    echo "Xem log:" >&2
    echo "  $FRONTEND_ERR" >&2
    exit 1
fi

echo
echo "=============================================="
echo "ZUNY local đã được khởi động"
echo "=============================================="
echo "Backend PID:          $BACKEND_PID"
echo "Backend:              http://127.0.0.1:5000"
echo
echo "Frontend PID:         $FRONTEND_PID"
echo "Frontend:             http://127.0.0.1:5173"
echo
echo "Database:             PostgreSQL"
echo "=============================================="
echo
echo "Log backend:"
echo "  $BACKEND_ERR"
echo
echo "Log frontend:"
echo "  $FRONTEND_ERR"
