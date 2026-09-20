#!/usr/bin/env python3

import json
import os
import resource
import selectors
import signal
import subprocess
import sys
import time
from pathlib import Path


MAX_INPUT_BYTES = 16 * 1024 * 1024
MAX_STDOUT_BYTES = 1 * 1024 * 1024
MAX_STDERR_BYTES = 1 * 1024 * 1024

CGROUP_MEMORY_EVENTS = Path(
    "/sys/fs/cgroup/memory.events"
)

CGROUP_MEMORY_PEAK = Path(
    "/sys/fs/cgroup/memory.peak"
)


def read_memory_events():
    events = {}

    try:
        for line in CGROUP_MEMORY_EVENTS.read_text().splitlines():
            key, value = line.split(maxsplit=1)
            events[key] = int(value)
    except (OSError, ValueError):
        pass

    return events


def read_memory_peak_kb():
    try:
        value = CGROUP_MEMORY_PEAK.read_text().strip()

        if value == "max":
            return None

        return int(value) // 1024

    except (OSError, ValueError):
        return None


def counter_increased(before, after, key):
    return after.get(key, 0) > before.get(key, 0)


def kill_process_group(process):
    try:
        os.killpg(
            process.pid,
            signal.SIGKILL,
        )
    except ProcessLookupError:
        pass


def run_command(
    command,
    input_data,
    timeout_ms=None,
):
    process = subprocess.Popen(
        command,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
        bufsize=0,
    )

    selector = selectors.DefaultSelector()

    # Cả 3 pipe đều non-blocking.
    #
    # Quan trọng: runner phải vừa gửi stdin vừa đọc
    # stdout/stderr. Nếu ghi toàn bộ stdin trước,
    # contestant có thể làm đầy stdout trước khi đọc
    # stdin và tạo pipe deadlock.
    os.set_blocking(
        process.stdin.fileno(),
        False,
    )
    os.set_blocking(
        process.stdout.fileno(),
        False,
    )
    os.set_blocking(
        process.stderr.fileno(),
        False,
    )

    selector.register(
        process.stdout,
        selectors.EVENT_READ,
        "stdout",
    )

    selector.register(
        process.stderr,
        selectors.EVENT_READ,
        "stderr",
    )

    input_view = memoryview(input_data)
    input_offset = 0
    stdin_open = True

    if input_view:
        selector.register(
            process.stdin,
            selectors.EVENT_WRITE,
            "stdin",
        )
    else:
        try:
            process.stdin.close()
        except OSError:
            pass

        stdin_open = False

    stdout_data = bytearray()
    stderr_data = bytearray()

    output_exceeded = False
    timed_out = False
    killed = False

    # Deadline bắt đầu ngay sau khi process được tạo,
    # không phải sau khi gửi xong stdin.
    deadline_ns = None

    if timeout_ms is not None:
        deadline_ns = (
            time.monotonic_ns()
            + max(1, int(timeout_ms))
            * 1_000_000
        )

    def close_stdin():
        nonlocal stdin_open

        if not stdin_open:
            return

        stdin_open = False

        try:
            selector.unregister(
                process.stdin
            )
        except Exception:
            pass

        try:
            process.stdin.close()
        except OSError:
            pass

    try:
        while selector.get_map():
            select_timeout = 0.1

            if (
                deadline_ns is not None
                and not killed
            ):
                remaining_ns = (
                    deadline_ns
                    - time.monotonic_ns()
                )

                if (
                    remaining_ns <= 0
                    and process.poll() is None
                ):
                    timed_out = True
                    killed = True

                    close_stdin()
                    kill_process_group(
                        process
                    )

                elif remaining_ns > 0:
                    select_timeout = min(
                        select_timeout,
                        remaining_ns
                        / 1_000_000_000,
                    )

            events = selector.select(
                timeout=select_timeout
            )

            if (
                deadline_ns is not None
                and not killed
                and time.monotonic_ns()
                >= deadline_ns
                and process.poll() is None
            ):
                timed_out = True
                killed = True

                close_stdin()
                kill_process_group(
                    process
                )

            if not events:
                if process.poll() is None:
                    continue

                # Process đã kết thúc. stdin không
                # còn cần thiết, nhưng stdout/stderr
                # có thể vẫn còn dữ liệu trong pipe.
                close_stdin()

                events = [
                    (
                        key,
                        selectors.EVENT_READ,
                    )
                    for key
                    in list(
                        selector
                        .get_map()
                        .values()
                    )
                    if key.data
                    in ("stdout", "stderr")
                ]

                if not events:
                    break

            for key, mask in events:
                stream = key.fileobj

                if key.data == "stdin":
                    if (
                        not stdin_open
                        or not (
                            mask
                            & selectors.EVENT_WRITE
                        )
                    ):
                        continue

                    try:
                        written = os.write(
                            stream.fileno(),
                            input_view[
                                input_offset:
                                input_offset
                                + 65536
                            ],
                        )

                    except BlockingIOError:
                        continue

                    except (
                        BrokenPipeError,
                        OSError,
                    ):
                        close_stdin()
                        continue

                    input_offset += written

                    if (
                        input_offset
                        >= len(input_view)
                    ):
                        close_stdin()

                    continue

                if not (
                    mask
                    & selectors.EVENT_READ
                ):
                    continue

                try:
                    chunk = os.read(
                        stream.fileno(),
                        65536,
                    )

                except BlockingIOError:
                    continue

                except OSError:
                    chunk = b""

                if not chunk:
                    try:
                        selector.unregister(
                            stream
                        )
                    except Exception:
                        pass

                    continue

                if key.data == "stdout":
                    target = stdout_data
                    limit = MAX_STDOUT_BYTES
                else:
                    target = stderr_data
                    limit = MAX_STDERR_BYTES

                remaining = (
                    limit - len(target)
                )

                if remaining > 0:
                    target.extend(
                        chunk[:remaining]
                    )

                if (
                    len(chunk) > remaining
                    and not output_exceeded
                ):
                    output_exceeded = True

                    # Output limit và timeout là hai
                    # nguyên nhân độc lập. Khi output
                    # đã vượt giới hạn, kill ngay và
                    # không biến nó thành timedOut.
                    killed = True

                    close_stdin()
                    kill_process_group(
                        process
                    )

        return_code = process.wait()

    finally:
        close_stdin()
        selector.close()

        try:
            input_view.release()
        except Exception:
            pass

        if process.poll() is None:
            kill_process_group(
                process
            )
            process.wait()

        # Popen không tự đóng các pipe ở đây.
        # Đóng rõ ràng để runner chạy lâu dài
        # không tích lũy file descriptor.
        for stream in (
            process.stdout,
            process.stderr,
        ):
            if stream is None:
                continue

            try:
                stream.close()
            except OSError:
                pass

    return (
        return_code,
        bytes(stdout_data),
        bytes(stderr_data),
        output_exceeded,
        timed_out,
    )

def main():
    if len(sys.argv) < 2:
        print(
            json.dumps({
                "error": "missing command"
            }),
            file=sys.stderr,
        )
        return 2

    argv = sys.argv[1:]
    timeout_ms = None

    if (
        len(argv) >= 2
        and argv[0] == "--timeout-ms"
    ):
        try:
            timeout_ms = max(
                1,
                int(argv[1]),
            )
        except ValueError:
            print(
                "invalid --timeout-ms",
                file=sys.stderr,
            )
            return 125

        argv = argv[2:]

        if argv and argv[0] == "--":
            argv = argv[1:]

    command = argv

    if not command:
        print(
            "judge runner missing command",
            file=sys.stderr,
        )
        return 125

    input_data = sys.stdin.buffer.read(
        MAX_INPUT_BYTES + 1
    )

    if len(input_data) > MAX_INPUT_BYTES:
        print(
            "judge input exceeds limit",
            file=sys.stderr,
        )
        return 125

    events_before = read_memory_events()
    started = time.monotonic_ns()

    return_code = 125
    stdout_data = b""
    stderr_data = b""
    output_exceeded = False
    timed_out = False

    try:
        (
            return_code,
            stdout_data,
            stderr_data,
            output_exceeded,
            timed_out,
        ) = run_command(
            command,
            input_data,
            timeout_ms=timeout_ms,
        )

    except Exception:
        stderr_data = (
            b"judge runner internal error\n"
        )
        return_code = 125

    finally:
        ended = time.monotonic_ns()
        events_after = read_memory_events()

        usage = resource.getrusage(
            resource.RUSAGE_CHILDREN
        )

        rss_kb = int(usage.ru_maxrss)
        cgroup_peak_kb = (
            read_memory_peak_kb()
        )

        if cgroup_peak_kb is not None:
            memory_used_kb = max(
                rss_kb,
                cgroup_peak_kb,
            )
        else:
            memory_used_kb = rss_kb

        memory_exceeded = (
            counter_increased(
                events_before,
                events_after,
                "oom",
            )
            or counter_increased(
                events_before,
                events_after,
                "oom_kill",
            )
            or counter_increased(
                events_before,
                events_after,
                "oom_group_kill",
            )
        )

        metadata = {
            "executionTimeMs": round(
                (ended - started)
                / 1_000_000,
                3,
            ),
            "memoryUsedKb": memory_used_kb,
            "memoryExceeded": (
                memory_exceeded
            ),
            "outputExceeded": (
                output_exceeded
            ),
            "timedOut": (
                timed_out
            ),
        }

        sys.stdout.buffer.write(
            stdout_data
        )
        sys.stdout.buffer.flush()

        sys.stderr.buffer.write(
            stderr_data
        )

        if (
            stderr_data
            and not stderr_data.endswith(b"\n")
        ):
            sys.stderr.buffer.write(b"\n")

        sys.stderr.write(
            "__ZUNY_META__"
            + json.dumps(
                metadata,
                separators=(",", ":"),
            )
            + "\n"
        )
        sys.stderr.flush()

    return return_code


if __name__ == "__main__":
    raise SystemExit(main())
