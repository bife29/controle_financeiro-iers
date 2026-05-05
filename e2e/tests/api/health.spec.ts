import { test, expect } from "@playwright/test";

test.describe("Health Check", () => {
  test("GET /health deve retornar status OK", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe("ok");
  });
});
