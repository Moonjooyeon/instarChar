from app.core.recommendations import character_recommendation_terms, normalize_recommendation_terms


def test_recommendation_terms_normalize_delimiters_and_duplicates() -> None:
    actual = normalize_recommendation_terms(["마법, 홍차 / 밤·산책", "마법", "SF-판타지"])
    assert actual == ["마법", "홍차", "산책", "sf", "판타지"]


def test_character_recommendation_terms_include_world_and_persona() -> None:
    character = {"interests": "홍차", "world": "마법 학교", "persona": "조용한 관찰자", "surface": "차분함", "age": "20대"}
    assert character_recommendation_terms(character) == ["홍차", "마법", "학교", "조용한", "관찰자", "차분함", "20대"]


def test_recommendation_terms_apply_a_stable_limit() -> None:
    assert normalize_recommendation_terms(["하나 둘셋 넷다섯 여섯"], 3) == ["하나", "둘셋", "넷다섯"]
