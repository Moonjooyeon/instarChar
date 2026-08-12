import re

from app.core.errors import BadRequestError


BLOCKED_PATTERNS = (
    re.compile(r"(아동|미성년).{0,12}(성적|나체|착취|음란)", re.IGNORECASE),
    re.compile(r"(강간|성폭행|몰카|리벤지\s*포르노)", re.IGNORECASE),
    re.compile(r"(자살해|죽어버려|살해하자)", re.IGNORECASE),
    re.compile(r"(child\s*(porn|sexual|nude)|minor\s*(porn|sexual|nude))", re.IGNORECASE),
    re.compile(r"(rape|revenge\s*porn|kill\s+yourself)", re.IGNORECASE),
)
AI_CREDENTIAL_PATTERNS = (
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"(?:sk|rk|pk)_(?:live|test)_[0-9A-Za-z]{16,}", re.IGNORECASE),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", re.IGNORECASE),
    re.compile(r"(?:api|secret)[_ -]?key\s*[:=]\s*[0-9A-Za-z_-]{20,}", re.IGNORECASE),
)


def require_safe_content(value: object) -> None:
    text = _searchable_text(value)
    if any(pattern.search(text) for pattern in BLOCKED_PATTERNS):
        raise BadRequestError("Content violates the community safety policy")


def is_safe_ai_content(value: object) -> bool:
    text = _searchable_text(value)
    return not any(pattern.search(text) for pattern in BLOCKED_PATTERNS + AI_CREDENTIAL_PATTERNS)


def _searchable_text(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return " ".join(_searchable_text(item) for item in value.values())
    if isinstance(value, list):
        return " ".join(_searchable_text(item) for item in value)
    return ""
