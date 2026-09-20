LANGUAGES = {
    "CPP23": {
        "source_file": "main.cpp",
        "compile": [
            "g++",
            "-std=c++23",
            "-O2",
            "-pipe",
            "-o",
            "/workspace/main",
            "/workspace/main.cpp",
        ],
        "run": [
            "/workspace/main",
        ],
    },

    "PYTHON314": {
        "source_file": "main.py",
        "compile": None,
        "run": [
            "python3.14",
            "-I",
            "-B",
            "/workspace/main.py",
        ],
    },

    "JAVA21": {
        "source_file": "Main.java",
        "compile": [
            "javac",
            "-encoding",
            "UTF-8",
            "-d",
            "/workspace",
            "/workspace/Main.java",
        ],
        "run": [
            "java",
            "-Xss16m",
            "-cp",
            "/workspace",
            "Main",
        ],
    },
}


def get_language(language):
    return LANGUAGES.get(
        str(language or "").upper()
    )
