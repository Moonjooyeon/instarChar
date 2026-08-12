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
        assert 'href="/legal.css?v=20260728-2"' in responses[path].text


def test_legal_styles_are_public_css() -> None:
    with TestClient(app) as client:
        response = client.get("/legal.css")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/css")
    assert 'font-family: "Apple SD Gothic Neo", sans-serif' in response.text
    assert "font-family: -apple-system" not in response.text
    assert "font-family: Pretendard" not in response.text


def test_public_responses_include_security_headers() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"
    assert response.headers["content-security-policy"].startswith("default-src 'self'")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"


def test_api_documentation_is_disabled_by_default() -> None:
    with TestClient(app) as client:
        responses = [client.get(path) for path in ("/docs", "/redoc", "/openapi.json")]
    assert [response.status_code for response in responses] == [404, 404, 404]
