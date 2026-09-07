"""Symmetric encryption for AWS credentials at rest (register mode).

A single Fernet key (settings.encryption_key) protects secret material. Guest-mode
credentials are never persisted and never pass through here.
"""

from functools import lru_cache

from cryptography.fernet import Fernet

from app.config import settings


@lru_cache
def _fernet() -> Fernet:
    key = settings.encryption_key
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set. Generate one with: "
            'python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
