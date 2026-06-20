import { expect, test } from "@playwright/test";

async function mockAliveApi(page) {
  await page.route("**/api/generate", async (route) => {
    const body = route.request().postDataJSON();
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

async function createCharacter(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "+ 새 캐릭터 깨우기" }).click();
  await expect(page).toHaveURL(/\/app\/new$/);
  await page.locator(".al-dump").fill("이름은 테스트린. 24살 마법학교 조교. 차분하지만 위험할 때 단호함.");
  await page.locator(".al-rp-box").fill("테스트린: 확인했습니다. 제가 정리하죠.");
  await page.getByRole("button", { name: "이대로 깨우기" }).click();
  await expect(page.getByRole("heading", { name: "이렇게 이해했어" })).toBeVisible();
  await expect(page.getByPlaceholder("@id")).toHaveValue("assistant_testerin");
  await page.getByRole("button", { name: "테스트린 깨우기" }).click();
  await expect(page).toHaveURL(/\/app\/feed$/);
  await expect(page.getByRole("heading", { name: "테스트린" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockAliveApi(page);
});

test("character, follow, DM world modal, back and forward stay consistent", async ({ page }) => {
  await createCharacter(page);

  await page.getByRole("button", { name: "🔍 탐색" }).click();
  await expect(page).toHaveURL(/\/app\/discover$/);
  await page.getByRole("button", { name: "+ 팔로우" }).first().click();
  await expect(page.getByRole("button", { name: "팔로잉 ✓" }).first()).toBeVisible();

  await page.getByRole("button", { name: "‹" }).click();
  await expect(page).toHaveURL(/\/app\/feed$/);
  await page.getByRole("button", { name: "1 팔로잉" }).click();
  await expect(page.getByRole("heading", { name: "팔로잉" })).toBeVisible();
  await page.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("button", { name: "✉ DM" }).click();
  await expect(page).toHaveURL(/\/app\/dm$/);
  await page.getByRole("button", { name: "💬 테스트린(으)로 다른 캐릭터에게 말 걸기" }).click();
  await page.getByRole("button", { name: /세인 팔로잉/ }).click();
  await expect(page.getByRole("heading", { name: "어느 세계관으로 들어갈까?" })).toBeVisible();
  await page.getByRole("button", { name: /상대 세계관/ }).click();
  await expect(page.getByRole("heading", { name: "설정을 조금 다듬을까요?" })).toBeVisible();
  await page.locator(".al-world-note").fill("테스트린은 사건 조사를 위해 세인의 세계에 들어왔다.");

  await page.goBack();
  await expect(page.getByRole("heading", { name: "어느 세계관으로 들어갈까?" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "설정을 조금 다듬을까요?" })).toBeVisible();
  await expect(page.locator(".al-world-note")).toHaveValue("테스트린은 사건 조사를 위해 세인의 세계에 들어왔다.");

  await page.getByRole("button", { name: "다듬고 시작" }).click();
  await expect(page.getByRole("heading", { name: "어떤 채팅방으로 만들까?" })).toBeVisible();
  await page.getByRole("button", { name: /NPC처럼 대화/ }).click();
  await expect(page).toHaveURL(/\/app\/dm\/thread$/);
  await page.getByRole("button", { name: "세계관" }).click();
  await expect(page.getByRole("heading", { name: "이 DM방 세계관 설정" })).toBeVisible();
  await page.getByRole("button", { name: /중간다리/ }).click();
  await page.locator(".al-world-note").fill("테스트린과 세인은 중립 DM 공간에서 만난다.");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByRole("heading", { name: "이 DM방 세계관 설정" })).toBeHidden();
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("alive_app_state_v1");
    if (!raw) return false;
    const state = JSON.parse(raw);
    return Array.isArray(state.accounts) && state.accounts.length > 0;
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "내 캐릭터들" })).toBeVisible();
  await expect(page.getByRole("button", { name: /테 테스트린/ })).toBeVisible();
  await page.getByRole("button", { name: /테 테스트린/ }).click();
  await expect(page.getByRole("heading", { name: "테스트린" })).toBeVisible();
  await expect(page).toHaveURL(/\/app\/feed$/);
});

test("DM send ignores rapid duplicate clicks while request is pending", async ({ page }) => {
  await createCharacter(page);
  await page.getByRole("button", { name: "✉ DM" }).click();
  await page.getByRole("button", { name: "🙋 나(오너)로서 테스트린에게 직접 말 걸기" }).click();
  await expect(page).toHaveURL(/\/app\/dm\/thread$/);

  const input = page.getByRole("textbox", { name: /메시지/ });
  await input.fill("지금 확인해줘");
  const send = page.getByRole("button", { name: "↑" });
  await send.click();
  await send.click({ force: true });

  await expect(page.getByText("지금 확인해줘")).toHaveCount(1);
  await expect(page.getByText("확인했습니다. 지금 상황은 제가 정리하죠.")).toBeVisible();
});

test("manual long-term memory can be added, pinned and marked important", async ({ page }) => {
  await createCharacter(page);
  await page.getByRole("button", { name: /0 장기기억/ }).click();
  await page.getByRole("button", { name: "+ 새 장기기억 추가" }).click();
  await page.getByPlaceholder("감정 변화와 원인, 약속, 사건 같은 핵심만 추가").fill("테스트린은 밤 순찰 전에 기록실을 확인한다.");
  await page.getByRole("button", { name: "장기기억 추가", exact: true }).click();

  await page.getByRole("button", { name: /전체 설정 1개/ }).click();
  await expect(page.getByText("테스트린은 밤 순찰 전에 기록실을 확인한다.")).toBeVisible();
  await page.getByRole("button", { name: "고정" }).click();
  await expect(page.getByRole("button", { name: "해제" })).toBeVisible();
  await page.getByRole("button", { name: "수정" }).click();
  await page.locator(".al-mem-editbox select").selectOption("5");
  await expect(page.locator(".al-mem-kind")).toHaveText("핵심");
});
