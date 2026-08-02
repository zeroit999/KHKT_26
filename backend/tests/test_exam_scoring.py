import unittest

from exams.exam_scoring import calculate_exam_score


class ExamScoringCompatibilityTest(unittest.TestCase):
    def test_grades_legacy_string_answers_with_numeric_correct_index(self):
        result = calculate_exam_score(
            questions=[{
                "id": "q1",
                "type": "multiple",
                "section": "part1",
                "question": "2 + 2 bằng bao nhiêu?",
                "answers": ["3", "4", "5", "6"],
                "correctAnswer": 1,
            }],
            answers={"q1": 1},
            text_answers={},
            scoring={"part1": {"perQuestion": 1}},
        )

        self.assertEqual(result["score"], 1)
        self.assertEqual(result["wrongCount"], 0)

    def test_grades_current_object_answers(self):
        result = calculate_exam_score(
            questions=[{
                "id": "q1",
                "type": "multiple",
                "section": "part1",
                "answers": [
                    {"content": "A", "isCorrect": False},
                    {"content": "B", "isCorrect": True},
                ],
            }],
            answers={"q1": 1},
            text_answers={},
            scoring={"part1": {"perQuestion": 0.25}},
        )

        self.assertEqual(result["score"], 0.25)

    def test_grades_legacy_true_false_values(self):
        result = calculate_exam_score(
            questions=[{
                "id": "q2",
                "type": "truefalse",
                "section": "part2",
                "answers": ["Ý a", "Ý b", "Ý c", "Ý d"],
                "correctAnswer": [True, False, True, False],
            }],
            answers={"q2": {"0": True, "1": False, "2": True, "3": False}},
            text_answers={},
            scoring={"part2": {"fourCorrect": 1}},
        )

        self.assertEqual(result["score"], 1)
        self.assertEqual(result["wrongCount"], 0)


if __name__ == "__main__":
    unittest.main()
