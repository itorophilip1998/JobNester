import { test, expect } from "@playwright/test";
test("dashboard and mobile navigation render without overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Your next chapter starts here/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Interactive demo", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Discover Jobs" }).click();
  await expect(
    page.getByRole("heading", { name: "An opportunity worth your time." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("search and filters change recommendations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Discover Jobs" }).click();
  await page.getByRole("textbox", { name: "Search jobs" }).fill("Vercel");
  await expect(page.locator(".job-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Eligibility", exact: true })
    .selectOption("Eligible");
  await expect(page.getByText("No jobs match these filters")).toBeVisible();
});
test("generate and approve a CV; confirm submission with immutable version", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Discover Jobs" }).click();
  await page
    .locator(".job-card")
    .filter({ hasText: "Vercel" })
    .getByRole("button", { name: "Tailor CV" })
    .click();
  await page
    .getByRole("button", { name: "Generate CV & cover letter" })
    .click();
  await page.locator(".resume-card").first().click();
  await expect(page.locator(".document-preview")).toContainText(
    "Example Technology Co.",
  );
  await page.getByRole("button", { name: "I reviewed this CV" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  await page.locator(".kanban-card").filter({ hasText: "Vercel" }).click();
  await page
    .getByRole("combobox", { name: "Application stage" })
    .selectOption("Applied");
  await page
    .getByRole("combobox", { name: "CV version submitted" })
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  await expect(
    page
      .locator(".kanban-col")
      .filter({
        has: page.getByRole("heading", { name: "Applied", exact: true }),
      })
      .locator(".kanban-card")
      .filter({ hasText: "Vercel" }),
  ).toBeVisible();
});
test("duplicate imports are blocked and scan cannot fabricate results", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add job", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Application URL" })
    .fill("https://vercel.com/careers?utm_source=test");
  await page
    .getByRole("textbox", { name: "Company", exact: true })
    .fill("Vercel");
  await page
    .getByRole("textbox", { name: "Job title", exact: true })
    .fill("Senior Software Engineer");
  await page
    .getByRole("textbox", { name: "Full job description" })
    .fill("Build software with TypeScript and React");
  await page.getByRole("button", { name: "Import job", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("already");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Scan for jobs", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "requires the API and worker",
  );
});
test("portfolio publishes a browser-local snapshot and contact explicitly stays demo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Portfolio", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Display name", exact: true })
    .fill("Test Portfolio");
  await page.getByRole("button", { name: "Save portfolio draft" }).click();
  await page
    .getByRole("button", { name: "Publish portfolio", exact: true })
    .click();
  await page.goto("/portfolio/");
  await expect(page.locator(".portfolio-brand")).toContainText(
    "Test Portfolio",
  );
  await page.getByRole("textbox", { name: "Your name" }).fill("Recruiter");
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill("recruiter@example.com");
  await page
    .getByRole("textbox", { name: "What would you like to talk about?" })
    .fill("We would like to discuss an engineering role.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("status")).toContainText("no message was sent");
  await page.screenshot({ path: "test-results/portfolio.png", fullPage: true });
});

test("batch CV generation creates reviewed-fact drafts for each selected job", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Discover Jobs" }).click();
  await page
    .getByRole("checkbox", {
      name: "Select Vercel Senior Full-Stack Engineer",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "Select GitLab Senior Full-Stack Developer",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: "Tailor selected CVs" }).click();
  await expect(page.locator(".resume-card")).toHaveCount(2);
  await expect(
    page.locator(".resume-card").filter({ hasText: "Vercel" }),
  ).toBeVisible();
  await expect(
    page.locator(".resume-card").filter({ hasText: "GitLab" }),
  ).toBeVisible();
});

test("country onboarding separates eligible worldwide jobs from US-only roles", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Personal workspace Just for you" })
    .click();
  await page
    .getByRole("textbox", { name: "Actual work country" })
    .fill("Canada");
  await page
    .getByRole("button", { name: "Save profile & refresh matches" })
    .click();
  await page.getByRole("button", { name: "Discover Jobs" }).click();
  await expect(
    page.locator(".job-card").filter({ hasText: "Vercel" }),
  ).toContainText("Eligible");
  await page
    .getByRole("button", {
      name: "AI & Machine Learning Engineer",
      exact: true,
    })
    .click();
  await expect(
    page.locator(".job-card").filter({ hasText: "Anthropic" }),
  ).toContainText("Ineligible");
});
