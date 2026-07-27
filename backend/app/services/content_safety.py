import re

from app.core.errors import BadRequestError


BLOCKED_PATTERNS = (
    re.compile(r"(아동|미성년).{0,12}(성적|나체|착취|음란)", re.IGNORECASE),
    re.compile(r"(강간|성폭행|몰카|리벤지\s*포르노)", re.IGNORECASE),
    re.compile(r"(자살해|죽어버려|살해하자)", re.IGNORECASE),
    re.compile(r"(child\s*(porn|sexual|nude)|minor\s*(porn|sexual|nude))", re.IGNORECASE),
    re.compile(r"(rape|revenge\s*porn|kill\s+yourself)", re.IGNORECASE),
)


def require_safe_content(value: object) -> None:
    text = _searchable_text(value)
    if any(pattern.search(text) for pattern in BLOCKED_PATTERNS):
        raise BadRequestError("Content violates the community safety policy")


def _searchable_text(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(_searchable_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(_searchable_text(item) for item in value)
    return ""
