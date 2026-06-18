# ALIVE — 배포 안내

이 앱은 **Gemini API 키를 서버에 숨긴 채** Vercel에서 실행하고, Supabase Auth/DB로 계정별 앱 상태를 저장한다.
브라우저는 직접 Gemini를 부르지 않고, 우리 서버 함수(`/api/generate`)를 통해서만 부른다. 키는 서버에만 있다.

## 구조

```
alive/
├── api/
│   └── generate.js     ← Gemini 호출 (키 숨김). 브라우저는 이것만 부른다.
├── src/
│   ├── App.jsx         ← 앱 본체 (호출 주소가 /api/generate 로 되어 있음)
│   ├── supabaseClient.js ← Supabase Auth/DB 클라이언트
│   └── main.jsx        ← React 진입점
├── index.html
├── package.json
├── vite.config.js       ← 로컬 개발용 /api/generate shim 포함
├── vercel.json
├── supabase-schema.sql  ← Supabase SQL Editor에서 실행할 스키마
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
| `GEMINI_MODEL_FAST` | `gemini-3.1-flash-lite` (선택, 비우면 기본값) |
| `GEMINI_MODEL_GOOD` | `gemini-2.5-pro` (선택, 비우면 기본값) |
| `API_DAILY_LIMIT` | `50` (선택, IP 기준 일일 호출 한도) |
| `API_MONTHLY_COST_LIMIT_USD` | `60` (선택, 서버 인스턴스 메모리 기준 월 예상 비용 상한) |
| `API_ESTIMATED_CALL_COST_USD` | `0.003` (선택, 호출 1회당 보수적 추정 비용) |
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |

→ 넣고 Deploy. 키는 서버에만 저장되고 브라우저로 안 내려간다.

### 5. Supabase DB 준비
- Supabase 프로젝트 생성 → SQL Editor 열기.
- 이 저장소의 `supabase-schema.sql` 내용을 그대로 실행.
- Authentication → URL Configuration에서 Site URL을 Vercel 주소로 맞춘다.
- 로컬 테스트를 할 때는 Redirect URLs에 `http://localhost:5173`도 추가한다.

### 5-1. Supabase 소셜 로그인
앱에는 Google/Kakao/X 로그인 버튼이 준비되어 있다. 실제 사용하려면 Supabase Dashboard에서 provider 키를 켠다.

- Authentication → Providers → Google 활성화 → Google OAuth Client ID/Secret 입력.
- Authentication → Providers → Kakao 활성화 → Kakao REST API Key/Client Secret 입력.
- Authentication → Providers → Twitter/X 활성화 → X API Key/Secret 입력.
- 각 provider 콘솔의 redirect/callback URL에는 Supabase가 보여주는 callback URL을 등록한다.
- Supabase Authentication → URL Configuration:
  - Site URL: `https://instarcharacterbot.vercel.app`
  - Redirect URLs: `https://instarcharacterbot.vercel.app`, `http://localhost:5173`

### 5-2. 앱으로 열기
현재 React/Vite 화면을 Capacitor로 감싸서 iOS/Android 앱 프로젝트를 생성해둔 상태다.

```bash
npm run app:sync
npm run app:open:ios
npm run app:open:android
```

- `npm run app:sync`는 웹 빌드 후 `ios/`, `android/`에 최신 화면을 복사한다.
- iOS 빌드는 Xcode, Android 빌드는 Android Studio에서 실행한다.
- Gemini 호출은 앱 안에서도 계속 Vercel `/api/generate`를 탄다. API 키는 앱 번들에 들어가지 않는다.

### 6. 확인
- 배포된 주소 접속 → 캐릭터 만들고 글 생성이 되면 성공.
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`가 있으면 이메일 로그인 → 온보딩 → 계정 저장이 켜진다.
- Supabase 설정이 없으면 로컬 개발용으로 브라우저 `localStorage`에만 저장된다.
- 안 되면 Vercel → Deployments → 함수 로그(Functions 탭)에서 에러 확인.

## 자주 나는 문제
- **"GEMINI_API_KEY not set"** → 환경변수 안 넣었거나, 넣고 재배포 안 함. 환경변수 바꾸면 재배포 필요.
- **빈 응답 / MAX_TOKENS** → 서버가 JSON 모드 또는 MAX_TOKENS 빈 응답을 더 큰 토큰으로 한 번 재시도한다. 그래도 실패하면 화면에 finishReason이 표시된다.
- **429 Too Many Requests** → 서버가 429/503 응답에 짧은 exponential backoff 재시도를 한다. 무료 티어 한계가 계속 걸리면 Google Cloud 결제 연결로 Tier 1을 올려야 한다.
- **로그인 링크/비밀번호 재설정 메일이 안 옴** → Supabase Auth URL/Redirect URL 설정과 Vercel 환경변수 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 확인.
- **DB 저장 실패** → `supabase-schema.sql`을 실행했는지, RLS policy가 생겼는지 확인.
- **로컬 테스트** → `npm install` 후 `.env.local` 파일을 만들고 `GEMINI_API_KEY=...`, `VITE_SUPABASE_URL=...`, `VITE_SUPABASE_ANON_KEY=...`를 넣은 뒤 `npm run dev`. 현재 Vite 설정에 로컬 `/api/generate` shim이 있어 `vercel dev` 없이도 API가 돈다.
- **사용량 한도 주의** → 현재 한도는 Vercel 서버 인스턴스 메모리 기반이라 재시작/스케일아웃 시 리셋될 수 있다. 실제 과금 방어는 Supabase 같은 DB에 usage를 저장하는 4단계에서 강화한다.

## 현재 구현 상태
- 계정별 저장: Supabase `alive_profiles.app_state` JSON에 캐릭터/피드/DM/로어북/페르소나 저장.
- 캐릭터 공유: `alive_shared_characters`에 공개 캐릭터를 저장하고 링크 복사/탐색 검색 지원.
- 로그인: Supabase 이메일/비밀번호 회원가입·로그인, 이메일 링크 간편 로그인, 비밀번호 재설정, Google/Kakao/X OAuth 버튼.
- 온보딩: 첫 로그인 시 닉네임 입력.
- 탐색: 이미 팔로잉한 캐릭터는 숨기고, 다른 사용자가 공유한 캐릭터와 사용자명을 검색.
- 댓글: 자동 댓글은 댓글 작성자가 원글 작성자를 팔로잉하거나 맞팔로 판단될 때만 생성.
- 사용량 한도: 현재는 서버 메모리 기반 임시 한도만 있음. DB 기반 강제 한도는 다음 단계.
