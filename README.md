# ALIVE — 배포 안내 (1단계: Gemini 키 숨김 + Vercel 배포)

이 단계의 목표: **API 키를 안전하게 숨긴 채로** Vercel에 배포한다.
브라우저는 직접 Gemini를 부르지 않고, 우리 서버 함수(`/api/generate`)를 통해서만 부른다. 키는 서버에만 있다.

## 구조

```
alive/
├── api/
│   └── generate.js     ← Gemini 호출 (키 숨김). 브라우저는 이것만 부른다.
├── src/
│   ├── App.jsx         ← 앱 본체 (호출 주소가 /api/generate 로 되어 있음)
│   └── main.jsx        ← React 진입점
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── .env.example        ← 환경변수 예시 (실제 키는 여기 쓰지 말 것)
```

## 배포 순서

### 1. Gemini 키 발급
- https://aistudio.google.com 접속 → "Get API key" → 키 복사.
- 무료 티어가 있어 테스트 단계에선 거의 비용 안 든다.

### 2. GitHub에 올리기
```bash
git init
git add .
git commit -m "ALIVE 1단계: Gemini 백엔드"
git branch -M main
git remote add origin https://github.com/<내계정>/alive.git
git push -u origin main
```

### 3. Vercel 연결
- https://vercel.com → "Add New Project" → 방금 만든 GitHub 레포 선택.
- Framework Preset 은 **Vite** 로 자동 인식된다. (안 되면 직접 Vite 선택)
- **Deploy 누르기 전에** 환경변수부터 넣는다 ↓

### 4. 환경변수 설정 (중요!)
Vercel 프로젝트 → **Settings → Environment Variables** 에서:

| 이름 | 값 |
|---|---|
| `GEMINI_API_KEY` | (1번에서 발급한 키) |
| `GEMINI_MODEL_FAST` | `gemini-2.5-flash` (선택) |
| `GEMINI_MODEL_GOOD` | `gemini-2.5-flash` (선택, 품질 올리려면 pro 계열로) |

→ 넣고 Deploy. 키는 서버에만 저장되고 브라우저로 안 내려간다.

### 5. 확인
- 배포된 주소 접속 → 자캐 만들고 글 생성이 되면 성공.
- 안 되면 Vercel → Deployments → 함수 로그(Functions 탭)에서 에러 확인.

## 자주 나는 문제
- **"GEMINI_API_KEY not set"** → 환경변수 안 넣었거나, 넣고 재배포 안 함. 환경변수 바꾸면 재배포 필요.
- **빈 응답** → 모델명이 틀렸을 수 있음. `GEMINI_MODEL_FAST`를 `gemini-2.5-flash`로 확인.
- **로컬 테스트** → `npm install` 후 `.env.local` 파일 만들어 `GEMINI_API_KEY=...` 넣고 `vercel dev` (vercel CLI 필요). 그냥 `npm run dev`로는 /api 함수가 안 돈다.

## 아직 안 된 것 (다음 단계)
- 저장(새로고침하면 날아감) → 2단계: Supabase 연결
- 로그인/유저 분별 → 3단계
- 사용량 한도(비용 상한) → 4단계
- 상대 캐릭터 데이터 역검증(맞팔) → DB 붙은 뒤

지금은 **"키 안전 + 배포"** 까지가 목표. 저장은 아직 브라우저 메모리라 새로고침하면 사라진다. (테스터에게 "아직 저장 안 됨"이라고 미리 알릴 것)
