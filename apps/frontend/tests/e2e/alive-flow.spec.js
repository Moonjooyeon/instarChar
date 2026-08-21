import { expect, test } from "@playwright/test";

async function mockAliveApi(page) {
  const rewards = { firstCharacter: false, firstDm: false };
  await mockCreditsApi(page, rewards);
  await page.route("**/api/characters/handle-availability?**", async (route) => {
    const handle = new URL(route.request().url()).searchParams.get("handle") || "";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ handle, available: true }) });
  });
  await page.route("**/api/characters/*/posts/generate", async (route) => {
    const post = { id: Date.now(), text: "확인했습니다. 지금 상황은 제가 정리하죠.", mood: "지금 기분", time: new Date().toISOString(), likes: 0, liked: false };
    const state = { auto_post_enabled: false, auto_post_failure_count: 0, auto_post_interval_seconds: 3600, last_auto_post_at: post.time, last_auto_post_error: "", next_auto_post_at: null, posts: [post], revision: 1 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ post, state }) });
  });
  await page.route("**/api/characters/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "PUT" || !/\/api\/characters\/[^/]+$/.test(path)) {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON();
    const sourceAccountId = decodeURIComponent(path.split("/").pop() || "");
    const handle = String(body.handle || "").toLowerCase().replace(/^@+/, "");
    const character = { ...(body.character || {}), name: body.name, handle };
    rewards.firstCharacter = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...body, source_account_id: sourceAccountId, handle, character }) });
  });
  await page.route("**/api/ai/generate", async (route) => {
    const body = route.request().postDataJSON();
    if (String(body?.flow || "").startsWith("direct_dm")) rewards.firstDm = true;
    const system = body?.system || "";
    const isAnalysis = system.includes("character-analysis-v2") || body?.flow === "character-analysis-v2";
    const text = isAnalysis
      ? JSON.stringify({
          name: "테스트린",
          id: "assistant_testerin",
          age: "24세",
          surface: "침착한 마법학교 조교",
          inner: "학생을 지키려는 책임감이 강함",
          situational: "평소에는 차분하고 위기에는 단호함",
          triggers: "학생이 위험해지는 상황",
          interests: "고대 마법 서적",
          persona: "달빛 마법학교의 조교. 짧은 존댓말을 쓴다.",
          world: "달빛 마법학교",
          speech: "짧고 차분한 존댓말",
          catchphrase: "확인했습니다.",
          relations: "",
          tone: "calm",
        })
      : "확인했습니다. 지금 상황은 제가 정리하죠.";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ content: [{ type: "text", text }] }),
    });
  });
}

async function mockCreditsApi(page, rewards) {
  const flows = [
    ["direct_dm_basic", "기본 대화", 1, 8, 0, 0], ["direct_dm_context", "기억 반영", 3, 15, 0, 0], ["direct_dm_pro", "중요한 답장", 9, 25, 20, 0],
    ["feed_post", "피드 글 생성", 3, 20, 0, 0], ["auto_feed_post", "혼자 남기는 근황", 2, 25, 24, 0], ["character_analysis", "캐릭터 분석", 10, 0, 3, 1],
  ].map(([code, label, credits, energy_percent, hard_daily_limit, intro_free_uses]) => ({ code, label, credits, energy_percent, hard_daily_limit, intro_free_uses, energy_eligible: !["direct_dm_pro", "character_analysis"].includes(String(code)), bonus_eligible: !["direct_dm_pro", "character_analysis"].includes(String(code)) }));
  const offers = [{ id: "credit-5000", price_krw: 5390, base_credits: 500, product_bonus_credits: 0, first_purchase_bonus_percent: 10, total_credits: 500, first_purchase_total_credits: 550, label: "가볍게 이어가기", payment_available: false }];
  await page.route("**/api/credits/catalog", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ credit_policy_version: "v1", energy_policy_version: "v1", offers, flows }) }));
  await page.route("**/api/credits/usage", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) }));
  await page.route("**/api/credits", (route) => {
    const reward_missions = [{ code: "signup", credits: 50, completed: true }, { code: "first_character", credits: 50, completed: rewards.firstCharacter }, { code: "first_dm", credits: 50, completed: rewards.firstDm }];
    const total_credits = 50 + (rewards.firstCharacter ? 50 : 0) + (rewards.firstDm ? 50 : 0);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ purchased_credits: 0, bonus_credits: total_credits, total_credits, energy_percent: 100, energy_max_percent: 100, next_energy_recovery_at: null, credit_policy_version: "v1", energy_policy_version: "v1", reward_missions }) });
  });
}

async function createCharacter(page) {
  await reachCharacterConfirmation(page);
  await page.getByRole("button", { name: "테스트린의 SNS 시작하기" }).click();
  await expect(page).toHaveURL(/\/app\/feed$/);
  await expect(page.getByRole("heading", { name: "테스트린" })).toBeVisible();
}

async function createFirstPost(page) {
  await page.getByRole("button", { name: "첫 글의 장면 고르기" }).click();
  await page.getByRole("button", { name: "지금 기분" }).click();
  await expect(page.locator(".al-post")).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "테스트린 피드 도움말" })).toBeVisible();
  await page.getByRole("button", { name: "도움말 닫기" }).click();
  await expect(page.getByRole("dialog", { name: "테스트린 피드 도움말" })).toBeHidden();
}

async function reachCharacterConfirmation(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "첫 캐릭터 만들기" }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
  await page.locator(".al-dump").fill("이름은 테스트린. 24살 마법학교 조교. 차분하지만 위험할 때 단호함.");
  await page.getByRole("button", { name: "다음: 어떤 사람인지 적기" }).click();
  await page.locator(".al-dump").fill("학생이 위험하면 평소와 다르게 단호해진다.");
  await page.getByRole("button", { name: "다음: 말투 남기기" }).click();
  await page.locator(".al-rp-box").fill("테스트린: 확인했습니다. 제가 정리하죠.");
  await page.getByRole("button", { name: "이제 프로필로 정리하기" }).click();
  await expect(page.getByRole("heading", { name: "이대로 시작할까요?" })).toBeVisible();
  await page.getByRole("button", { name: "틀린 부분 수정" }).click();
  await expect(page.getByPlaceholder("@id")).toHaveValue("assistant_testerin");
}

async function mockPersistentPostLikes(page) {
  const likes = new Map();
  await page.route("**/api/post-likes/query", async (route) => {
    const body = route.request().postDataJSON();
    const items = (body?.targets || []).map((target) => ({ ...target, available: true, liked: likes.get(`${body.liker_account_id}:${target.target_character_id}:${target.post_id}`) || false, likes: likes.get(`${body.liker_account_id}:${target.target_character_id}:${target.post_id}`) ? 1 : 0 }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items }) });
  });
  await page.route("**/api/post-likes", async (route) => {
    const body = route.request().postDataJSON();
    likes.set(`${body.liker_account_id}:${body.target_character_id}:${body.post_id}`, body.liked);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ target_character_id: body.target_character_id, post_id: body.post_id, available: true, liked: body.liked, likes: body.liked ? 1 : 0 }) });
  });
}

test.beforeEach(async ({ page }) => {
  await mockAliveApi(page);
});

test("taken character handle blocks creation before submit", async ({ page }) => {
  await page.route("**/api/characters/handle-availability?**", async (route) => {
    const handle = new URL(route.request().url()).searchParams.get("handle") || "";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ handle, available: handle !== "taken" }) });
  });
  await reachCharacterConfirmation(page);
  await page.getByPlaceholder("@id").fill("taken");
  await expect(page.getByText("이미 사용 중인 아이디야.")).toBeVisible();
  await expect(page.getByRole("button", { name: "필수 항목을 확인해줘" })).toBeDisabled();
});

test("PUT handle conflict keeps the draft on the confirmation screen", async ({ page }) => {
  await page.route("**/api/characters/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "PUT" && /\/api\/characters\/[^/]+$/.test(path)) {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "CHARACTER_HANDLE_TAKEN", message: "이미 사용 중인 아이디야." }) });
      return;
    }
    await route.fallback();
  });
  await reachCharacterConfirmation(page);
  await page.getByRole("button", { name: "테스트린의 SNS 시작하기" }).click();
  await expect(page).toHaveURL(/\/app\/new\/confirm$/);
  await expect(page.getByRole("alert")).toContainText("이미 사용 중인 아이디야");
  const accountCount = await page.evaluate(() => JSON.parse(localStorage.getItem("alive_app_state_v1") || "{}").accounts?.length || 0);
  expect(accountCount).toBe(0);
});

test("availability outage still allows the authoritative PUT", async ({ page }) => {
  await page.route("**/api/characters/handle-availability?**", (route) => route.abort());
  await reachCharacterConfirmation(page);
  await expect(page.getByText("미리 확인하지 못했어. 저장할 때 다시 확인할게.")).toBeVisible();
  await page.getByRole("button", { name: "테스트린의 SNS 시작하기" }).click();
  await expect(page).toHaveURL(/\/app\/feed$/);
});

test("failed PUT retry reuses the stable character source id", async ({ page }) => {
  const sourceIds = [];
  await page.route("**/api/characters/*", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== "PUT" || !/\/api\/characters\/[^/]+$/.test(path)) {
      await route.fallback();
      return;
    }
    sourceIds.push(decodeURIComponent(path.split("/").pop() || ""));
    if (sourceIds.length === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "잠시 후 다시 시도해줘." }) });
      return;
    }
    await route.fallback();
  });
  await reachCharacterConfirmation(page);
  await page.getByRole("button", { name: "테스트린의 SNS 시작하기" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "테스트린의 SNS 시작하기" }).click();
  await expect(page).toHaveURL(/\/app\/feed$/);
  expect(sourceIds).toHaveLength(2);
  expect(sourceIds[0]).toBe(sourceIds[1]);
});

test("character setup keeps each step when returning from confirmation", async ({ page }) => {
  await reachCharacterConfirmation(page);
  await page.getByRole("button", { name: "다시 입력" }).click();
  await expect(page.locator(".al-dump")).toHaveValue("이름은 테스트린. 24살 마법학교 조교. 차분하지만 위험할 때 단호함.");
  await page.getByRole("button", { name: "다음: 어떤 사람인지 적기" }).click();
  await expect(page.locator(".al-dump")).toHaveValue("학생이 위험하면 평소와 다르게 단호해진다.");
});

test("failed first-post generation explains the failure and offers retry", async ({ page }) => {
  await createCharacter(page);
  await page.route("**/api/characters/*/posts/generate", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "잠시 사용할 수 없습니다." }) });
  });
  await page.getByRole("button", { name: "첫 글의 장면 고르기" }).click();
  await page.getByRole("button", { name: "지금 기분" }).click();
  await expect(page.getByRole("alert")).toContainText("글을 완성하지 못했어요");
  await page.getByRole("button", { name: "다시 장면 고르기" }).click();
  await expect(page.getByText("테스트린의 첫 글은 어떤 장면일까요?")).toBeVisible();
});

test("phase 1B hides user personas and feed test controls", async ({ page }) => {
  await createCharacter(page);
  await page.waitForTimeout(800);
  await expect(page.locator(".al-post")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "대화", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "테스트 즉시 생성" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /빠름\(30초\)/ })).toHaveCount(0);
  await createFirstPost(page);
  await page.getByRole("button", { name: "대화", exact: true }).click();
  await expect(page.getByRole("button", { name: /내 페르소나로 캐릭터에게 말 걸기/ })).toHaveCount(0);
  await page.getByRole("button", { name: "피드로 돌아가기" }).click();
  await page.getByRole("button", { name: "내 캐릭터 목록으로" }).click();
  await expect(page.getByText("내 페르소나")).toHaveCount(0);
  await expect(page.locator(".al-build")).toHaveCount(0);
});

test("first-post picker hides the duplicate empty state and post management opens upward", async ({ page }) => {
  await createCharacter(page);
  await page.getByRole("button", { name: "첫 글의 장면 고르기" }).click();
  await expect(page.locator(".al-first-feed")).toHaveCount(0);
  await page.getByRole("button", { name: "지금 기분" }).click();
  await expect(page.locator(".al-post")).toHaveCount(1);
  await page.getByRole("button", { name: "도움말 닫기" }).click();
  const summary = page.locator(".al-post-more summary");
  await summary.scrollIntoViewIfNeeded();
  await summary.click();
  await expect(page.getByRole("button", { name: "수정", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "삭제", exact: true })).toBeVisible();
  const summaryBox = await summary.boundingBox();
  const menuBox = await page.locator(".al-post-more > div").boundingBox();
  if (!summaryBox || !menuBox) throw new Error("게시물 관리 메뉴 위치를 측정하지 못했습니다.");
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(summaryBox.y + 1);
});

test("first profile offers a direct scene instead of another setup task", async ({ page }) => {
  await createCharacter(page);
  await expect(page.getByText("첫 장면의 단서")).toBeVisible();
  await expect(page.getByText("첫인상")).toBeVisible();
  await expect(page.getByText("프로필은 준비됐어요")).toHaveCount(0);
  await page.getByRole("button", { name: /방금 있었던 일/ }).click();
  await expect(page.locator(".al-post")).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "테스트린 피드 도움말" })).toBeVisible();
});

test("credit center explains every flow and returns without starting a payment", async ({ page }) => {
  await createCharacter(page);
  await page.getByRole("button", { name: /크레딧.*충전 화면 열기/ }).click();
  await expect(page).toHaveURL(/\/app\/credits$/);
  await expect(page.getByRole("heading", { name: "크레딧", exact: true })).toBeVisible();
  await expect(page.locator(".al-starter-journey")).toContainText("2 / 3");
  await page.locator("details").filter({ hasText: "기능별 사용량" }).locator("summary").click();
  await page.locator("details").filter({ hasText: "이용 안내" }).locator("summary").click();
  await expect(page.getByRole("heading", { name: "무료부터 차례대로 사용해요" })).toBeVisible();
  await expect(page.getByText("기본 대화", { exact: true })).toBeVisible();
  await expect(page.getByText("중요한 답장", { exact: true })).toBeVisible();
  await expect(page.getByText("캐릭터 상호작용", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /가볍게 이어가기/ }).click();
  await expect(page.getByRole("button", { name: "결제 준비 중" })).toBeDisabled();
  await page.getByRole("button", { name: "이전 화면으로" }).click();
  await expect(page).toHaveURL(/\/app\/feed$/);
});

test("starter missions guide the first character and conversation without a help overlay", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("시작의 세 장면 · 1 / 3")).toBeVisible();
  await expect(page.getByRole("button", { name: /주인공 만들기/ })).toBeVisible();
  await createCharacter(page);
  await expect(page.getByText("시작의 세 장면 · 2 / 3")).toBeVisible();
  await page.getByRole("button", { name: /첫 대화 열기/ }).click();
  await expect(page).toHaveURL(/\/app\/dm$/);
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  await page.getByRole("textbox", { name: /메시지/ }).fill("우리의 첫 장면을 시작하자");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(page.getByText("확인했습니다. 지금 상황은 제가 정리하죠.").last()).toBeVisible();
  await page.getByRole("button", { name: /크레딧.*충전 화면 열기/ }).click();
  await expect(page.locator(".al-starter-journey")).toContainText("3 / 3");
  await expect(page.locator(".al-starter-journey")).toContainText("세 장면을 모두 열었어요.");
});

test("comment composer keeps the active speaker clear and prevents blank sends", async ({ page }) => {
  await createCharacter(page);
  await createFirstPost(page);
  await page.getByRole("button", { name: "댓글 달기" }).click();
  const composer = page.locator(".al-cmtbox");
  await expect(composer).toContainText("테스트린 계정으로 댓글");
  const input = page.getByRole("textbox", { name: "테스트린 계정으로 댓글 입력" });
  const send = page.getByRole("button", { name: "댓글 보내기" });
  await expect(send).toBeDisabled();
  await input.fill("오늘 장면 좋다.");
  await expect(send).toBeEnabled();
  await send.click();
  await expect(composer).toHaveCount(0);
  await expect(page.getByText("오늘 장면 좋다.")).toBeVisible();
});

test("character, follow, DM world modal, back and forward stay consistent", async ({ page }) => {
  await createCharacter(page);
  await createFirstPost(page);

  await page.getByRole("button", { name: "기억·관계·공개 설정" }).click();
  await page.getByRole("button", { name: "새 캐릭터 만나기" }).click();
  await expect(page).toHaveURL(/\/app\/discover$/);
  await page.getByRole("button", { name: "타임라인에 추가" }).first().click();
  await expect(page.getByRole("button", { name: "추가됨" }).first()).toBeVisible();

  await page.getByRole("button", { name: "피드로 돌아가기" }).click();
  await expect(page).toHaveURL(/\/app\/feed$/);
  await page.getByRole("button", { name: "기억·관계·공개 설정" }).click();
  await page.getByRole("button", { name: "1 추가한 캐릭터" }).click();
  await expect(page.getByRole("heading", { name: "추가한 캐릭터" })).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "대화", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/dm$/);
  await page.getByRole("button", { name: /테스트린과 다른 캐릭터 만나게 하기/ }).click();
  await page.getByRole("button", { name: /세인.*타임라인에 추가됨/ }).click();
  await expect(page.getByRole("heading", { name: "어디에서 만나게 할까요?" })).toBeVisible();
  await page.getByRole("button", { name: /세인의 이야기 속/ }).click();
  await expect(page.getByRole("heading", { name: "첫 장면을 더할까요?" })).toBeVisible();
  await page.locator(".al-world-note").fill("테스트린은 사건 조사를 위해 세인의 세계에 들어왔다.");

  await page.goBack();
  await expect(page.getByRole("heading", { name: "어디에서 만나게 할까요?" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "첫 장면을 더할까요?" })).toBeVisible();
  await expect(page.locator(".al-world-note")).toHaveValue("테스트린은 사건 조사를 위해 세인의 세계에 들어왔다.");

  await page.getByRole("button", { name: "다듬고 시작" }).click();
  await expect(page.getByRole("heading", { name: "이 대화를 누구와 공유할까요?" })).toBeVisible();
  await page.getByRole("button", { name: /나만 보는 대화/ }).click();
  await expect(page).toHaveURL(/\/app\/dm\/thread$/);
  await page.getByRole("button", { name: "장면 설정" }).click();
  await expect(page.getByRole("heading", { name: "이 대화의 장면 설정" })).toBeVisible();
  await page.getByRole("button", { name: /둘만의 중립 공간/ }).click();
  await page.locator(".al-world-note").fill("테스트린과 세인은 중립 DM 공간에서 만난다.");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("heading", { name: "이 대화의 장면 설정" })).toBeHidden();
  const dmInput = page.getByRole("textbox", { name: /메시지/ });
  await dmInput.fill("세인에게만 남긴 초안");
  await page.getByRole("button", { name: "대화 목록으로" }).click();
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  await expect(dmInput).toHaveValue("");
  await page.getByRole("button", { name: "대화 목록으로" }).click();
  await page.locator(".al-convmain").filter({ hasText: "세인" }).click();
  await expect(dmInput).toHaveValue("세인에게만 남긴 초안");
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("alive_app_state_v1");
    if (!raw) return false;
    const state = JSON.parse(raw);
    return Array.isArray(state.accounts) && state.accounts.length > 0;
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "내 캐릭터들" })).toBeVisible();
  await expect(page.getByRole("button", { name: "테스트린 계정 열기" })).toBeVisible();
  await page.getByRole("button", { name: "테스트린 계정 열기" }).click();
  await expect(page.getByRole("heading", { name: "테스트린" })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/feed$/);
});

test("DM send ignores rapid duplicate clicks while request is pending", async ({ page }) => {
  await createCharacter(page);
  await createFirstPost(page);
  await page.getByRole("button", { name: "대화", exact: true }).click();
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  await expect(page).toHaveURL(/\/app\/dm\/thread$/);
  await expect(page.getByText("무료 에너지 100%", { exact: true })).toBeVisible();
  await expect(page.getByText("이번 답장에 에너지 8% 사용 예상", { exact: true })).toBeVisible();

  const input = page.getByRole("textbox", { name: /메시지/ });
  await input.fill("지금 확인해줘");
  const send = page.getByRole("button", { name: "메시지 보내기" });
  await send.click();
  await send.click({ force: true });

  await expect(page.getByText("지금 확인해줘")).toHaveCount(1);
  await expect(page.getByText("확인했습니다. 지금 상황은 제가 정리하죠.")).toBeVisible();
});

test("DM response mode sends the selected quality flow", async ({ page }) => {
  await createCharacter(page);
  await createFirstPost(page);
  await page.getByRole("button", { name: "대화", exact: true }).click();
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  await page.locator(".al-dm-response-mode summary").click();
  await page.getByRole("radio", { name: /중요한 답장/ }).click();
  await expect(page.locator(".al-dm-response-mode summary")).toContainText("9C");
  await page.getByRole("textbox", { name: /메시지/ }).fill("우리가 처음 만난 날을 천천히 떠올려줘");
  const request = page.waitForRequest((candidate) => candidate.url().includes("/api/ai/generate") && candidate.postDataJSON()?.flow === "direct_dm_pro");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  const selectedRequest = await request;
  expect(selectedRequest.postDataJSON()).toMatchObject({ flow: "direct_dm_pro", max_tokens: 1280 });
  expect(selectedRequest.postDataJSON()?.system).toContain("2~5문장");
  await page.getByRole("button", { name: "대화 목록으로" }).click();
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  await expect(page.locator(".al-dm-response-mode summary")).toContainText("9C");
  await page.reload();
  await expect(page).toHaveURL(/\/app\/dm$/);
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  await expect(page.locator(".al-dm-response-mode summary")).toContainText("9C");
});

test("an empty DM offers editable first-scene prompts", async ({ page }) => {
  await createCharacter(page);
  await createFirstPost(page);
  await page.getByRole("button", { name: "대화", exact: true }).click();
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  const starter = page.getByRole("button", { name: "지금 잠깐 이야기할 수 있어?" });
  await expect(page.getByText("첫 장면의 단서")).toBeVisible();
  await starter.click();
  await expect(page.getByRole("textbox", { name: /메시지/ })).toHaveValue("지금 잠깐 이야기할 수 있어?");
});

test("a failed DM reply restores the unsent draft without leaving an error as dialogue", async ({ page }) => {
  await createCharacter(page);
  await createFirstPost(page);
  await page.getByRole("button", { name: "대화", exact: true }).click();
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  await page.route("**/api/ai/generate", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "잠시 응답할 수 없습니다." }) }));
  const input = page.getByRole("textbox", { name: /메시지/ });
  await input.fill("이어서 이야기해줘");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(page.getByRole("alert")).toContainText("답장을 받지 못했어요");
  await page.getByRole("button", { name: "입력창에 다시 담기" }).click();
  await expect(input).toHaveValue("이어서 이야기해줘");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a new DM send discards the previous failed turn before generating again", async ({ page }) => {
  await createCharacter(page);
  await createFirstPost(page);
  await page.getByRole("button", { name: "대화", exact: true }).click();
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  let attempts = 0;
  await page.route("**/api/ai/generate", (route) => {
    attempts += 1;
    if (attempts === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "잠시 응답할 수 없습니다." }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ content: [{ type: "text", text: "새 메시지에만 답장했어요." }] }) });
  });
  const input = page.getByRole("textbox", { name: /메시지/ });
  await input.fill("이전 요청은 실패할 거야");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await input.fill("이 메시지로 다시 이어가자");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(page.getByText("새 메시지에만 답장했어요.")).toBeVisible();
  await expect(page.getByText("이전 요청은 실패할 거야")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a DM credit shortage offers the credit screen from the failed reply", async ({ page }) => {
  await createCharacter(page);
  await createFirstPost(page);
  await page.getByRole("button", { name: "대화", exact: true }).click();
  await page.getByRole("button", { name: /테스트린과 바로 대화하기/ }).click();
  await page.route("**/api/ai/generate", (route) => route.fulfill({ status: 402, contentType: "application/json", body: JSON.stringify({ error: "CREDIT_INSUFFICIENT" }) }));
  await page.getByRole("textbox", { name: /메시지/ }).fill("계속 이야기하고 싶어");
  await page.getByRole("button", { name: "메시지 보내기" }).click();
  await expect(page.getByRole("button", { name: "크레딧 확인" })).toBeVisible();
  await page.getByRole("button", { name: "크레딧 확인" }).click();
  await expect(page).toHaveURL(/\/app\/credits$/);
});

test("followed post like survives a page reload", async ({ page }) => {
  await mockPersistentPostLikes(page);
  await createCharacter(page);
  await createFirstPost(page);
  await page.getByRole("button", { name: "기억·관계·공개 설정" }).click();
  await page.getByRole("button", { name: "새 캐릭터 만나기" }).click();
  await page.getByRole("button", { name: "타임라인에 추가" }).first().click();
  await page.getByRole("button", { name: "피드로 돌아가기" }).click();
  await page.getByRole("button", { name: /타임라인/ }).click();
  const followedPost = page.locator(".al-post").filter({ has: page.locator(".al-post-extbadge") }).first();
  await expect(followedPost).toBeVisible();
  await followedPost.locator(".al-like").click();
  await expect(followedPost.locator(".al-like")).toHaveClass(/on/);
  await page.reload();
  const restoredPost = page.locator(".al-post").filter({ has: page.locator(".al-post-extbadge") }).first();
  await expect(restoredPost.locator(".al-like")).toHaveClass(/on/);
});

test("manual long-term memory can be added, pinned and marked important", async ({ page }) => {
  await createCharacter(page);
  await createFirstPost(page);
  await page.getByRole("button", { name: "기억·관계·공개 설정" }).click();
  await page.getByRole("button", { name: /0 기억/ }).click();
  await page.getByRole("button", { name: "기억 직접 남기기" }).click();
  await page.getByPlaceholder("감정 변화와 원인, 약속, 사건 같은 핵심만 추가").fill("테스트린은 밤 순찰 전에 기록실을 확인한다.");
  await page.getByRole("button", { name: "기억 남기기", exact: true }).click();

  await page.getByRole("button", { name: /전체 설정 1개/ }).click();
  await expect(page.getByText("테스트린은 밤 순찰 전에 기록실을 확인한다.")).toBeVisible();
  await page.getByRole("button", { name: "고정" }).click();
  await expect(page.getByRole("button", { name: "해제" })).toBeVisible();
  await page.getByRole("button", { name: "수정" }).click();
  await page.locator(".al-mem-editbox select").selectOption("5");
  await expect(page.locator(".al-mem-kind")).toHaveText("핵심");
});
