"""
Symmetric encryption for stored credentials.
Uses Fernet (AES-128-CBC) with a key derived from JWT_SECRET.
Shares the same encryption key as the GPS module for consistency.
"""
from __future__ import annotations
import base64
import hashlib
from cryptography.fernet import Fernet
from ..config import settings


def _get_key() -> bytes:
    """Derive a 32-byte Fernet key from JWT_SECRET."""
    digest = hashlib.sha256(settings.JWT_SECRET.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_token(plaintext: str) -> str:
    """Encrypt a string and return base64-encoded ciphertext."""
    f = Fernet(_get_key())
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_token(ciphertext: str) -> str:
    """Decrypt a base64-encoded ciphertext to plaintext."""
    f = Fernet(_get_key())
    return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
