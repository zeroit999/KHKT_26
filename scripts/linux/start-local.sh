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

EMULATOR_OUT="$PROJECT_ROOT/firebase-emulator.out.log"
EMULATOR_ERR="$PROJECT_ROOT/firebase-emulator.err.log"

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

if ! command -v npx >/dev/null 2>&1; then
    echo "Không tìm thấy npx." >&2
    exit 1
fi

if ! command -v java >/dev/null 2>&1; then
    echo "Không tìm thấy Java. Firebase Emulator cần OpenJDK 21." >&2
    exit 1
fi

JAVA_VERSION="$(java -version 2>&1 | head -n 1)"

if [[ "$JAVA_VERSION" != *'"21.'* ]] && [[ "$JAVA_VERSION" != *'"21"'* ]]; then
    echo "Java hiện tại không phải Java 21:" >&2
    echo "  $JAVA_VERSION" >&2
    echo >&2
    echo "Hãy chọn Java 21 bằng:" >&2
    echo "  sudo update-alternatives --config java" >&2
    echo "  sudo update-alternatives --config javac" >&2
    exit 1
fi

JAVA_BIN="$(readlink -f "$(command -v java)")"
export JAVA_HOME="$(dirname "$(dirname "$JAVA_BIN")")"
export PATH="$JAVA_HOME/bin:$PATH"

export FIREBASE_PROJECT_ID="zuny-local"
export FIREBASE_STORAGE_BUCKET="zuny-local.appspot.com"
export FIREBASE_DATABASE_URL="http://127.0.0.1:9000?ns=zuny-local"
export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
export FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
export FIREBASE_DATABASE_EMULATOR_HOST="127.0.0.1:9000"
export STORAGE_EMULATOR_HOST="http://127.0.0.1:9199"

stop_old_process "$PROJECT_ROOT/.local-frontend.pid" "frontend"
stop_old_process "$PROJECT_ROOT/.local-backend.pid" "backend"
stop_old_process "$PROJECT_ROOT/.local-emulators.pid" "Firebase Emulator"

cd "$PROJECT_ROOT"

EMULATOR_ARGS=(
    --yes
    firebase-tools@15.24.0
    emulators:start
    --config firebase.local.json
    --project zuny-local
    --export-on-exit .firebase-data
)

if [[ -d "$PROJECT_ROOT/.firebase-data" ]]; then
    EMULATOR_ARGS+=(--import .firebase-data)
fi

echo "Đang khởi động Firebase Emulator..."

nohup npx "${EMULATOR_ARGS[@]}" \
    >"$EMULATOR_OUT" \
    2>"$EMULATOR_ERR" &

EMULATOR_PID=$!
echo "$EMULATOR_PID" >"$PROJECT_ROOT/.local-emulators.pid"

if ! wait_local_port 9099 60 || ! wait_local_port 8080 60; then
    echo >&2
    echo "Firebase Emulator không khởi động được." >&2
    echo "Xem log:" >&2
    echo "  $EMULATOR_ERR" >&2
    exit 1
fi

echo "Đang tạo dữ liệu local..."

"$PYTHON_PATH" "$BACKEND_ROOT/seed_local.py"

echo "Đang khởi động backend..."

cd "$BACKEND_ROOT"

nohup "$PYTHON_PATH" app.py \
    >"$BACKEND_OUT" \
    2>"$BACKEND_ERR" &

BACKEND_PID=$!
echo "$BACKEND_PID" >"$PROJECT_ROOT/.local-backend.pid"

echo "Đang khởi động frontend..."

cd "$FRONTEND_ROOT"

nohup npm run dev -- --host 127.0.0.1 \
    >"$FRONTEND_OUT" \
    2>"$FRONTEND_ERR" &

FRONTEND_PID=$!
echo "$FRONTEND_PID" >"$PROJECT_ROOT/.local-frontend.pid"

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
echo "Firebase Emulator PID: $EMULATOR_PID"
echo "Emulator UI:           http://127.0.0.1:4000"
echo
echo "Java:                  $JAVA_HOME"
echo "=============================================="
echo
echo "Log backend:"
echo "  $BACKEND_ERR"
echo
echo "Log frontend:"
echo "  $FRONTEND_ERR"
echo
echo "Log Firebase:"
echo "  $EMULATOR_ERR"
