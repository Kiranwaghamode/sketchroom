import { expect, test, type Browser, type Page } from "@playwright/test";

// Two people on the same board in two separate browser contexts (separate sessions).
// Uses the users created by `pnpm db:seed`: demo@ owns "Demo board", friend@ can edit it.

type Shape = { id: string; type: string; color: string };
type BoardWindow = Window & {
  doc: {
    getMap(name: "shapes"): {
      get(id: string): { toJSON(): Shape } | undefined;
    };
    getArray(name: "order"): { toArray(): string[] };
  };
  provider: { synced: boolean };
};

const RED = "#e03131";

async function openDemoBoard(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(process.env["DEMO_PASSWORD"]!);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("link", { name: /Demo board/ }).click();
  await page.waitForFunction(
    () => (window as unknown as BoardWindow).provider?.synced === true,
  );
  return { context, page };
}

function shapeIds(page: Page) {
  return page.evaluate(() =>
    (window as unknown as BoardWindow).doc.getArray("order").toArray(),
  );
}

function shape(page: Page, id: string) {
  return page.evaluate(
    (shapeId) =>
      (window as unknown as BoardWindow).doc
        .getMap("shapes")
        .get(shapeId)
        ?.toJSON() ?? null,
    id,
  );
}

/** Drags on the canvas (screen coordinates relative to the canvas area). */
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator("main canvas").first().boundingBox())!;
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 8 });
  await page.mouse.up();
}

/** The id of the shape that appeared on `page` after `before`. */
async function newShapeId(page: Page, before: string[]) {
  await expect
    .poll(async () => (await shapeIds(page)).length)
    .toBe(before.length + 1);
  return (await shapeIds(page)).find((id) => !before.includes(id))!;
}

test("two users edit the same board in real time, including offline edits", async ({
  browser,
}) => {
  expect(
    process.env["DEMO_PASSWORD"],
    "run `pnpm db:seed` and set DEMO_PASSWORD",
  ).toBeTruthy();
  const a = await openDemoBoard(browser, "demo@whiteboard.dev");
  const b = await openDemoBoard(browser, "friend@whiteboard.dev");
  const created: string[] = [];

  try {
    // 1. User A draws a rectangle → user B sees it.
    let before = await shapeIds(a.page);
    await a.page.keyboard.press("r");
    await drag(a.page, [200, 200], [360, 300]);
    const rectId = await newShapeId(a.page, before);
    created.push(rectId);
    await expect
      .poll(() => shape(b.page, rectId))
      .toMatchObject({ type: "rect" });

    // 2. User B changes its color → user A sees the new color.
    await b.page.mouse.click(
      (await b.page.locator("main canvas").first().boundingBox())!.x + 280,
      (await b.page.locator("main canvas").first().boundingBox())!.y + 250,
    );
    await b.page.getByRole("button", { name: "Red", exact: true }).click();
    await expect
      .poll(async () => (await shape(a.page, rectId))?.color)
      .toBe(RED);

    // 3. A goes offline, draws a shape, comes back online → B sees it.
    await a.context.setOffline(true);
    await expect(a.page.getByText("You’re offline")).toBeVisible();
    before = await shapeIds(a.page);
    await a.page.keyboard.press("Escape");
    await a.page.keyboard.press("o");
    await drag(a.page, [500, 200], [620, 290]);
    const ellipseId = await newShapeId(a.page, before);
    created.push(ellipseId);
    expect(await shape(b.page, ellipseId)).toBeNull(); // not synced while offline

    await a.context.setOffline(false);
    await expect
      .poll(() => shape(b.page, ellipseId), { timeout: 60_000 })
      .toMatchObject({
        type: "ellipse",
      });
    await expect(a.page.getByText("You’re offline")).toBeHidden();
  } finally {
    // Leave the demo board as it was.
    if (created.length > 0) {
      await a.page.evaluate((ids) => {
        const w = window as unknown as BoardWindow & {
          doc: {
            transact(fn: () => void, origin: string): void;
            getMap(n: "shapes"): { delete(id: string): void };
          };
        };
        const order = w.doc.getArray("order") as unknown as {
          toArray(): string[];
          delete(i: number, n: number): void;
        };
        w.doc.transact(() => {
          for (const id of ids) w.doc.getMap("shapes").delete(id);
          const all = order.toArray();
          for (let i = all.length - 1; i >= 0; i--)
            if (ids.includes(all[i]!)) order.delete(i, 1);
        }, "local");
      }, created);
      await a.page.waitForTimeout(1000);
    }
    await a.context.close();
    await b.context.close();
  }
});
