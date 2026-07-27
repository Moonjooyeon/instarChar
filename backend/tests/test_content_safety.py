import pytest

from app.core.errors import BadRequestError
from app.services.content_safety import require_safe_content


def test_content_safety_accepts_normal_character_content() -> None:
    require_safe_content({"text": "오늘은 친구와 카페에 다녀왔어.", "comments": ["좋다!"]})


def test_content_safety_rejects_child_exploitation_content() -> None:
    with pytest.raises(BadRequestError):
        require_safe_content({"text": "미성년 성적 착취물을 공유한다"})


def test_content_safety_checks_nested_comments() -> None:
    with pytest.raises(BadRequestError):
        require_safe_content({"posts": [{"comments": [{"text": "kill yourself"}]}]})
