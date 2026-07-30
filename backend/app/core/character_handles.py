from __future__ import annotations

import re


CHARACTER_HANDLE_MAX_LENGTH = 24
CHARACTER_HANDLE_RESERVED = frozenset(
    {
        "admin",
        "administrator",
        "alive",
        "help",
        "mod",
        "moderator",
        "official",
        "staff",
        "support",
        "system",
    }
)
CHARACTER_HANDLE_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9._-]{0,22}[a-z0-9])?$")
_INVALID_CHARACTER_HANDLE = re.compile(r"[^a-z0-9._-]")


def normalize_character_handle(value: str) -> str:
    normalized = value.strip().lower().lstrip("@")
    normalized = _INVALID_CHARACTER_HANDLE.sub("", normalized)
    normalized = normalized.strip("._-")[:CHARACTER_HANDLE_MAX_LENGTH]
    return normalized.rstrip("._-")


def is_reserved_character_handle(value: str) -> bool:
    return value in CHARACTER_HANDLE_RESERVED


def validate_character_handle(value: str) -> str:
    normalized = normalize_character_handle(value)
    if not CHARACTER_HANDLE_PATTERN.fullmatch(normalized):
        raise ValueError("아이디는 영문 소문자, 숫자, 점, 밑줄, 하이픈으로 1~24자여야 합니다.")
    if is_reserved_character_handle(normalized):
        raise ValueError("사용할 수 없는 예약 아이디입니다.")
    return normalized


def next_available_character_handle(value: str, used: set[str]) -> str:
    base = normalize_character_handle(value) or "character"
    if base not in used and not is_reserved_character_handle(base):
        return base
    suffix = 2
    while True:
        tail = f"-{suffix}"
        candidate = f"{base[:CHARACTER_HANDLE_MAX_LENGTH - len(tail)].rstrip('._-')}{tail}"
        if candidate not in used and not is_reserved_character_handle(candidate):
            return candidate
        suffix += 1
