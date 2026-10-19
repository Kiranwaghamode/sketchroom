import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

// Two people on the same document in two separate browser contexts (separate
// sessions). Uses the users created by `pnpm db:seed`. The test creates its own
// documents (owned by demo@, shared with friend@ through links) and deletes them
// at the end, so the seeded demo data is never changed.

type DocWindow = Window & {
  doc: { getXmlFragment(name: "content"): { toString(): string } };
  provider: { synced: boolean; hasUnsyncedChanges: boolean };
};

async function logIn(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(process.env["DEMO_PASSWORD"]!);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
  return { context, page };
}

/** The document's content as stored in the Y.Doc. */
function content(page: Page) {
  return page.evaluate(() =>
    (window as unknown as DocWindow).doc.getXmlFragment("content").toString(),
  );
}

async function waitSynced(page: Page) {
  await page.waitForFunction(() => {
    const { provider } = window as unknown as DocWindow;
    return provider?.synced === true && !provider.hasUnsyncedChanges;
  });
}

async function newDocument(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("menuitem", { name: "Document" }).click();
  await page.waitForURL(/\/doc\/[^/]+$/);
  await page.locator(".doc-content").waitFor();
  await waitSynced(page);
  return page.url().split("/").pop()!;
}

/** The owner copies the document's edit or view link from the Share dialog. */
async function copyLink(
  context: BrowserContext,
  page: Page,
  verb: "edit" | "view",
) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share" }).click();
  await page
    .getByRole("dialog")
    .locator("div", { hasText: `can ${verb} this document` })
    .last()
    .getByRole("button", { name: "Copy link" })
    .click();
  await expect(page.getByText("Link copied")).toBeVisible();
  await page.keyboard.press("Escape");
  return page.evaluate(() => navigator.clipboard.readText());
}

async function openLink(page: Page, link: string, docId: string) {
  await page.goto(link);
  await page.waitForURL(`**/doc/${docId}`);
  await page.locator(".doc-content").waitFor();
  await waitSynced(page);
}

/** Puts the caret at the start or end of the first paragraph. */
async function caretAt(page: Page, where: "Home" | "End") {
  await page.locator(".doc-content p").first().click();
  await page.keyboard.press(where);
  // ProseMirror reads native selection changes asynchronously.
  await page.waitForTimeout(150);
}

test("two users write the same document in real time, including offline edits", async ({
  browser,
}) => {
  expect(
    process.env["DEMO_PASSWORD"],
    "run `pnpm db:seed` and set DEMO_PASSWORD",
  ).toBeTruthy();
  const a = await logIn(browser, "demo@whiteboard.dev");
  const b = await logIn(browser, "friend@whiteboard.dev");
  const created: string[] = [];

  try {
    const docId = await newDocument(a.page);
    created.push(docId);
    await openLink(b.page, await copyLink(a.context, a.page, "edit"), docId);

    // 1. User A types "Hello" → user B sees "Hello".
    await a.page.locator(".doc-content").click();
    await a.page.keyboard.type("Hello");
    await expect.poll(() => content(b.page)).toContain("Hello");

    // 2. Both type at the same time in the same paragraph → both end up with
    //    the same text, containing both inputs. (Different spots in the
    //    paragraph: see docs/decisions.md on carets at the identical position.)
    await caretAt(a.page, "End");
    await caretAt(b.page, "Home");
    await Promise.all([
      a.page.keyboard.type(" from Alice", { delay: 30 }),
      b.page.keyboard.type("Bob says ", { delay: 35 }),
    ]);
    await expect
      .poll(async () => (await content(a.page)) === (await content(b.page)))
      .toBe(true);
    const together = await content(a.page);
    expect(together).toContain("<paragraph>Bob says Hello from Alice");

    // 3. User B makes a word bold → user A sees it bold.
    await b.page.locator(".doc-content p").first().click();
    await b.page.keyboard.press("Home");
    await b.page.waitForTimeout(150);
    await b.page.keyboard.press("Shift+End");
    await b.page.waitForTimeout(150);
    await b.page.keyboard.press("Control+b");
    await expect
      .poll(() => content(a.page))
      .toContain("<bold>Bob says Hello from Alice</bold>");

    // 4. A goes offline, types a sentence, comes back online → B sees it.
    await a.context.setOffline(true);
    await expect(a.page.getByText("You’re offline")).toBeVisible();
    await caretAt(a.page, "End");
    await a.page.keyboard.press("Enter");
    await a.page.keyboard.type("Written while offline.");
    await b.page.waitForTimeout(1000);
    expect(await content(b.page)).not.toContain("Written while offline.");
    await a.context.setOffline(false);
    await expect
      .poll(() => content(b.page), { timeout: 60_000 })
      .toContain("Written while offline.");
    await expect(a.page.getByText("You’re offline")).toBeHidden();

    // 5. A viewer (view link) can't type.
    const viewDocId = await newDocument(a.page);
    created.push(viewDocId);
    await a.page.locator(".doc-content").click();
    await a.page.keyboard.type("Read only for Bob");
    await waitSynced(a.page);
    await openLink(
      b.page,
      await copyLink(a.context, a.page, "view"),
      viewDocId,
    );
    await expect(b.page.getByText("View only")).toBeVisible();
    await expect(b.page.getByRole("button", { name: "Bold" })).toHaveCount(0);
    await expect(b.page.locator(".doc-content")).toHaveAttribute(
      "contenteditable",
      "false",
    );
    const before = await content(b.page);
    await b.page.locator(".doc-content").click();
    await b.page.keyboard.type("Bob tries to type");
    await b.page.waitForTimeout(500);
    expect(await content(b.page)).toBe(before);
  } finally {
    // Delete the documents this test created.
    for (const id of created) {
      await a.page.goto("/dashboard");
      const card = a.page.locator("li", {
        has: a.page.locator(`a[href="/doc/${id}"]`),
      });
      await card.getByRole("button", { name: "Document options" }).click();
      await a.page.getByRole("menuitem", { name: "Delete" }).click();
      await a.page.getByRole("button", { name: "Delete" }).click();
      await expect(card).toHaveCount(0);
    }
    await a.context.close();
    await b.context.close();
  }
});
