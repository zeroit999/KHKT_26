import tempfile
import unittest
from pathlib import Path

from oj.judge.comparator import outputs_equal
from oj.judge.languages import get_language
from oj.judge.sandbox import run_in_sandbox


class OJComparatorTest(unittest.TestCase):
    def test_equal_without_final_newline(self):
        self.assertTrue(
            outputs_equal(
                "42\n",
                "42",
            )
        )

    def test_trailing_spaces_are_ignored(self):
        self.assertTrue(
            outputs_equal(
                "42   \n",
                "42\n",
            )
        )

    def test_internal_spaces_are_not_ignored(self):
        self.assertFalse(
            outputs_equal(
                "1  2\n",
                "1 2\n",
            )
        )

    def test_wrong_answer(self):
        self.assertFalse(
            outputs_equal(
                "YES\n",
                "NO\n",
            )
        )


class OJSandboxTest(unittest.TestCase):
    def run_python(
        self,
        source_code,
        *,
        stdin_data="",
        memory_mb=128,
        execution_timeout_ms=1000,
        host_timeout_seconds=3,
    ):
        language = get_language(
            "PYTHON314"
        )

        with tempfile.TemporaryDirectory(
            prefix="zuny-test-"
        ) as temp:
            workspace = Path(temp)

            (
                workspace
                / language["source_file"]
            ).write_text(
                source_code,
                encoding="utf-8",
            )

            return run_in_sandbox(
                workspace,
                language["run"],
                stdin_data=stdin_data,
                memory_mb=memory_mb,
                timeout_seconds=(
                    host_timeout_seconds
                ),
                measured=True,
                execution_timeout_ms=(
                    execution_timeout_ms
                ),
            )

    def test_ac_execution(self):
        result = self.run_python(
            """
a, b = map(int, input().split())
print(a + b)
""".strip(),
            stdin_data="12 30\n",
        )

        self.assertFalse(
            result.timed_out
        )
        self.assertFalse(
            result.memory_exceeded
        )
        self.assertFalse(
            result.output_exceeded
        )

        self.assertEqual(
            result.return_code,
            0,
        )

        self.assertEqual(
            result.stdout.strip(),
            "42",
        )

        self.assertIsNotNone(
            result.execution_time_ms
        )

        self.assertGreater(
            result.memory_used_kb or 0,
            0,
        )

    def test_runtime_error(self):
        result = self.run_python(
            """
raise RuntimeError("ZUNY")
""".strip(),
        )

        self.assertFalse(
            result.timed_out
        )

        self.assertFalse(
            result.memory_exceeded
        )

        self.assertFalse(
            result.output_exceeded
        )

        self.assertNotEqual(
            result.return_code,
            0,
        )

    def test_internal_tle_has_telemetry(self):
        limit_ms = 300

        result = self.run_python(
            """
x = 0

while True:
    x += 1
""".strip(),
            execution_timeout_ms=limit_ms,
            host_timeout_seconds=2,
        )

        self.assertTrue(
            result.timed_out
        )

        self.assertFalse(
            result.memory_exceeded
        )

        self.assertFalse(
            result.output_exceeded
        )

        self.assertIsNotNone(
            result.execution_time_ms
        )

        self.assertGreaterEqual(
            result.execution_time_ms,
            250,
        )

        self.assertLess(
            result.execution_time_ms,
            1000,
        )

        self.assertGreater(
            result.memory_used_kb or 0,
            0,
        )

    def test_memory_limit(self):
        result = self.run_python(
            """
chunks = []

while True:
    chunks.append(
        bytearray(8 * 1024 * 1024)
    )
""".strip(),
            memory_mb=64,
            execution_timeout_ms=3000,
            host_timeout_seconds=5,
        )

        self.assertFalse(
            result.timed_out
        )

        self.assertTrue(
            result.memory_exceeded
        )

        self.assertFalse(
            result.output_exceeded
        )

        self.assertGreater(
            result.memory_used_kb or 0,
            0,
        )

    def test_output_limit(self):
        result = self.run_python(
            """
import sys

chunk = "A" * 65536

while True:
    sys.stdout.write(chunk)
    sys.stdout.flush()
""".strip(),
            execution_timeout_ms=3000,
            host_timeout_seconds=5,
        )

        self.assertFalse(
            result.timed_out
        )

        self.assertFalse(
            result.memory_exceeded
        )

        self.assertTrue(
            result.output_exceeded
        )

        # Runner chỉ được capture tối đa 1 MiB.
        self.assertLessEqual(
            len(
                result.stdout.encode(
                    "utf-8"
                )
            ),
            1024 * 1024,
        )


class OJLanguageTest(unittest.TestCase):
    def test_required_runtimes_exist(self):
        for language_name in (
            "CPP23",
            "PYTHON314",
            "JAVA21",
        ):
            with self.subTest(
                language=language_name
            ):
                self.assertIsNotNone(
                    get_language(
                        language_name
                    )
                )



class OJRunnerFullDuplexTest(unittest.TestCase):
    def test_large_stdin_and_early_stdout_do_not_deadlock(
        self,
    ):
        """
        Contestant ghi nhiều stdout trước khi đọc
        stdin lớn. Runner phải vừa WRITE stdin vừa
        READ stdout để không xảy ra pipe deadlock.
        """
        import importlib.util
        import sys
        from pathlib import Path

        runner_path = (
            Path(__file__).resolve().parents[2]
            / "judge"
            / "runner.py"
        )

        spec = importlib.util.spec_from_file_location(
            "zuny_runner_full_duplex_test",
            runner_path,
        )

        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)

        runner = importlib.util.module_from_spec(
            spec
        )
        spec.loader.exec_module(runner)

        child_code = r"""
import sys

sys.stdout.buffer.write(
    b"X" * (200 * 1024)
)
sys.stdout.buffer.flush()

data = sys.stdin.buffer.read()

sys.stderr.write(
    "INPUT_BYTES=" + str(len(data))
)
sys.stderr.flush()
"""

        input_data = (
            b"A" * (4 * 1024 * 1024)
        )

        (
            return_code,
            stdout,
            stderr,
            output_exceeded,
            timed_out,
        ) = runner.run_command(
            [
                sys.executable,
                "-c",
                child_code,
            ],
            input_data,
            timeout_ms=5000,
        )

        self.assertEqual(
            return_code,
            0,
        )
        self.assertEqual(
            len(stdout),
            200 * 1024,
        )
        self.assertEqual(
            stderr,
            b"INPUT_BYTES=4194304",
        )
        self.assertFalse(
            output_exceeded
        )
        self.assertFalse(
            timed_out
        )


if __name__ == "__main__":
    unittest.main()
