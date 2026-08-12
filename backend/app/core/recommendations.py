import re


RECOMMENDATION_FIELDS = ("interests", "world", "persona", "surface", "age")
_TERM_SEPARATOR = re.compile(r"[\s,./·|;:!?()\[\]{}\"'…—_-]+")


def normalize_recommendation_terms(values: list[object], limit: int = 32) -> list[str]:
    terms: list[str] = []
    seen: set[str] = set()
    for value in values:
        for token in _TERM_SEPARATOR.split(str(value or "").lower()):
            term = "".join(character for character in token if character.isalnum())
            if len(term) < 2 or term in seen:
                continue
            seen.add(term)
            terms.append(term)
            if len(terms) == limit:
                return terms
    return terms


def character_recommendation_terms(character: dict[str, object], limit: int = 32) -> list[str]:
    values = [character.get(field) for field in RECOMMENDATION_FIELDS]
    return normalize_recommendation_terms(values, limit)
