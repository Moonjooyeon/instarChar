import pytest

from app.core.character_handles import (
    CHARACTER_HANDLE_MAX_LENGTH,
    next_available_character_handle,
    normalize_character_handle,
    validate_character_handle,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (" @Hello.World ", "hello.world"),
        ("two words!", "twowords"),
        ("__hero__", "hero"),
        ("가나다", ""),
        ("a" * 30, "a" * CHARACTER_HANDLE_MAX_LENGTH),
    ],
)
def test_normalize_character_handle(raw: str, expected: str) -> None:
    assert normalize_character_handle(raw) == expected


@pytest.mark.parametrize("handle", ["admin", "@Alive", "support"])
def test_validate_character_handle_rejects_reserved_words(handle: str) -> None:
    with pytest.raises(ValueError, match="예약"):
        validate_character_handle(handle)


@pytest.mark.parametrize("handle", ["", "___", "가나다"])
def test_validate_character_handle_rejects_empty_normalized_value(handle: str) -> None:
    with pytest.raises(ValueError, match="1~24자"):
        validate_character_handle(handle)


def test_validate_character_handle_allows_reserved_word_as_substring() -> None:
    assert validate_character_handle("alive_story") == "alive_story"


def test_next_available_character_handle_adds_deterministic_suffix() -> None:
    used = {"hero", "hero-2"}
    assert next_available_character_handle("Hero", used) == "hero-3"


def test_next_available_character_handle_replaces_empty_and_reserved_values() -> None:
    assert next_available_character_handle("", set()) == "character"
    assert next_available_character_handle("admin", set()) == "admin-2"
