from fastapi.testclient import TestClient

from app.main import app


def test_legal_pages_are_public_html() -> None:
    expected = {
        "/privacy/": "개인정보처리방침",
        "/terms/": "이용약관",
        "/account-deletion/": "계정 삭제 안내",
    }
    with TestClient(app) as client:
        responses = {path: client.get(path) for path in expected}
    for path, title in expected.items():
        assert responses[path].status_code == 200
        assert "text/html" in responses[path].headers["content-type"]
        assert title in responses[path].text
        assert "(주)애쉬우드프렌즈" in responses[path].text
        assert "ashwoodfriends@ashwoodfriends.com" in responses[path].text


def test_legal_styles_are_public_css() -> None:
    with TestClient(app) as client:
        response = client.get("/legal.css")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/css")
