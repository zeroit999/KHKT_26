def normalize_output(value):
    """
    So sánh theo từng dòng:
    - chuẩn hóa CRLF -> LF
    - bỏ khoảng trắng cuối mỗi dòng
    - bỏ dòng trống ở cuối output
    """
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")

    lines = [
        line.rstrip()
        for line in text.split("\n")
    ]

    while lines and lines[-1] == "":
        lines.pop()

    return "\n".join(lines)


def outputs_equal(actual, expected):
    return normalize_output(actual) == normalize_output(expected)
