"""Symmetric encryption for AWS credentials at rest (register mode).

A single Fernet key (settings.encryption_key) protects secret material. Guest-mode
credentials are never persisted and never pass through here.
"""

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from aws_openconsole.config import settings
from aws_openconsole.errors import ConfigurationError

_KEYGEN_HINT = (
    'Generate one with: python -c "from cryptography.fernet import Fernet; '
    'print(Fernet.generate_key().decode())" and put it in .env'
)


@lru_cache
def _fernet() -> Fernet:
    key = settings.encryption_key
    if not key or key == "change-me":
        raise ConfigurationError(f"ENCRYPTION_KEY is not set. {_KEYGEN_HINT}")
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (ValueError, TypeError) as exc:
        raise ConfigurationError(
            f"ENCRYPTION_KEY is not a valid Fernet key ({exc}). {_KEYGEN_HINT}"
        ) from exc


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ConfigurationError(
            "Stored credentials cannot be decrypted with the current ENCRYPTION_KEY. "
            "The key has changed since this profile was saved; delete and re-create the profile."
        ) from exc
