import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";
import { tag } from "../../helpers/e2e-tag";

test.describe("Módulo Feedback", () => {
  let headers: Record<string, string>;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test("GET /api/feedback/ lista feedbacks", async ({ request }) => {
    const response = await request.get("/api/feedback/", { headers });

    expect(response.ok()).toBeTruthy();

    const feedbacks = await response.json();
    expect(Array.isArray(feedbacks)).toBeTruthy();
  });

  test("POST /api/feedback/ cria feedback de sugestão", async ({ request }) => {
    const feedback = {
      type: "sugestao",
      title: tag(`Sugestão ${Date.now()}`),
      description: tag("Teste automatizado de criação de feedback"),
      module: "financeiro",
      priority: "media",
    };

    const response = await request.post("/api/feedback/", {
      headers,
      data: feedback,
    });

    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    expect(created.type).toBe("sugestao");
    expect(created.title).toBe(feedback.title);
    expect(created.status).toBe("aberto");
  });

  test("POST /api/feedback/ cria report de erro", async ({ request }) => {
    const feedback = {
      type: "erro",
      title: tag(`Erro ${Date.now()}`),
      description: tag("Report de erro via teste automatizado"),
      module: "membros",
      priority: "alta",
    };

    const response = await request.post("/api/feedback/", {
      headers,
      data: feedback,
    });

    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    expect(created.type).toBe("erro");
    expect(created.priority).toBe("alta");
  });
});
