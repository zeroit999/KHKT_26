"""SHA-256 integrity utilities for uploaded files."""

import hashlib


def calculate_file_sha256(file_storage, chunk_size=1024 * 1024):
    """Calculate SHA-256 without loading the entire file into RAM."""
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")

    stream = file_storage.stream
    digest = hashlib.sha256()

    stream.seek(0)

    try:
        while True:
            chunk = stream.read(chunk_size)

            if not chunk:
                break

            digest.update(chunk)

        return digest.hexdigest()

    finally:
        stream.seek(0)
