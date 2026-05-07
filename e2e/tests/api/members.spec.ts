import { test, expect } from "@playwright/test";
import { getAuthHeaders } from "../../helpers/auth";

test.describe("Módulo Membros", () => {
  let headers: Record<string, string>;
  let createdMemberId: number;

  test.beforeAll(async ({ request }) => {
    headers = await getAuthHeaders(request);
  });

  test.describe.configure({ mode: "serial" });

  test("GET /api/members/ lista membros", async ({ request }) => {
    const response = await request.get("/api/members/", { headers });

    expect(response.ok()).toBeTruthy();

    const members = await response.json();
    expect(Array.isArray(members)).toBeTruthy();
  });

  test("POST /api/members/ cria membro com dados mínimos", async ({ request }) => {
    const member = {
      name: `Membro Teste E2E ${Date.now()}`,
      estado_civil: "Solteiro(a)",
    };

    const response = await request.post("/api/members/", {
      headers,
      data: member,
    });

    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    expect(created.name).toBe(member.name);
    expect(created.id).toBeDefined();
  });

  test("POST /api/members/ cria membro com todos os campos de contato", async ({ request }) => {
    const ts = Date.now();
    const member = {
      name: `Contato Teste E2E ${ts}`,
      cel: "(21) 99999-8888",
      tel: "(21) 3333-4444",
      email: `contato.${ts}@e2e.com`,
      cpf: `${String(ts).slice(-3)}.${String(ts).slice(-6,-3)}.${String(ts).slice(-9,-6)}-${String(ts).slice(-11,-9) || '00'}`,
      cidade: "Rio de Janeiro",
      bairro: "Centro",
      endereco: "Rua Teste 123",
      cep: "20000-000",
    };

    const response = await request.post("/api/members/", {
      headers,
      data: member,
    });

    expect(response.ok()).toBeTruthy();

    const created = await response.json();
    createdMemberId = created.id;
    expect(created.cel).toBe(member.cel);
    expect(created.tel).toBe(member.tel);
    expect(created.email).toBe(member.email);
    expect(created.cpf).toBe(member.cpf);
    expect(created.cidade).toBe(member.cidade);
    expect(created.bairro).toBe(member.bairro);
    expect(created.endereco).toBe(member.endereco);
    expect(created.cep).toBe(member.cep);
  });

  test("GET /api/members/:id retorna todos os campos do membro", async ({ request }) => {
    const response = await request.get(`/api/members/${createdMemberId}`, { headers });

    expect(response.ok()).toBeTruthy();

    const member = await response.json();
    expect(member.id).toBe(createdMemberId);
    expect(member.cel).toBe("(21) 99999-8888");
    expect(member.tel).toBe("(21) 3333-4444");
    expect(member.email).toContain("@e2e.com");
    expect(member.cpf).toBeTruthy();
    expect(member.cidade).toBe("Rio de Janeiro");
  });

  test("PUT /api/members/:id atualiza campos de contato", async ({ request }) => {
    const update = {
      cel: "(11) 98765-4321",
      tel: "(11) 2222-3333",
    };

    const response = await request.put(`/api/members/${createdMemberId}`, {
      headers,
      data: update,
    });

    expect(response.ok()).toBeTruthy();

    const updated = await response.json();
    expect(updated.cel).toBe(update.cel);
    expect(updated.tel).toBe(update.tel);
    // Campos não enviados devem permanecer inalterados
    expect(updated.email).toContain("@e2e.com");
  });

  test("GET /api/members/ retorna cel e tel na listagem", async ({ request }) => {
    const response = await request.get(
      `/api/members/?search=(11) 98765-4321`,
      { headers }
    );

    expect(response.ok()).toBeTruthy();

    const results = await response.json();
    expect(results.length).toBeGreaterThanOrEqual(1);

    const member = results.find((m: any) => m.id === createdMemberId);
    expect(member).toBeDefined();
    expect(member.cel).toBe("(11) 98765-4321");
    expect(member.tel).toBe("(11) 2222-3333");
  });

  test("GET /api/members/summary retorna lista resumida", async ({ request }) => {
    const response = await request.get("/api/members/summary", { headers });

    expect(response.ok()).toBeTruthy();

    const summary = await response.json();
    expect(Array.isArray(summary)).toBeTruthy();
    // Summary deve conter cel e email
    if (summary.length > 0) {
      expect(summary[0]).toHaveProperty("cel");
      expect(summary[0]).toHaveProperty("email");
    }
  });

  test("GET /api/members/?search= busca por nome", async ({ request }) => {
    // Cria um membro primeiro
    const uniqueName = `BuscaTeste${Date.now()}`;
    await request.post("/api/members/", {
      headers,
      data: { name: uniqueName, estado_civil: "Casado(a)" },
    });

    // Busca por nome
    const response = await request.get(`/api/members/?search=${uniqueName}`, { headers });

    expect(response.ok()).toBeTruthy();

    const results = await response.json();
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toContain(uniqueName);
  });

  test("GET /api/members/?search= busca por celular", async ({ request }) => {
    const response = await request.get(
      `/api/members/?search=(11) 98765`,
      { headers }
    );

    expect(response.ok()).toBeTruthy();

    const results = await response.json();
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].cel).toContain("(11) 98765");
  });

  test("GET /api/members/ sem auth retorna 401", async ({ request }) => {
    const response = await request.get("/api/members/");
    expect(response.status()).toBe(401);
  });

  // Regressão Bug 2: criar membro com CPF duplicado retornava 500
  // (IntegrityError não tratado). Deve responder 409 com mensagem amigável.
  test("POST /api/members/ com CPF duplicado retorna 409", async ({ request }) => {
    const ts = Date.now();
    const cpf = `${String(ts).slice(-3)}.${String(ts).slice(-6, -3)}.${String(ts).slice(-9, -6)}-99`;
    const base = {
      name: `Dup CPF E2E ${ts}`,
      cpf,
    };

    const first = await request.post("/api/members/", { headers, data: base });
    expect(first.ok()).toBeTruthy();

    const second = await request.post("/api/members/", {
      headers,
      data: { ...base, name: `${base.name} (clone)` },
    });
    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(typeof body.detail).toBe("string");
    expect(body.detail.toLowerCase()).toContain("cpf");
  });

  // Regressão Bug 2: criar membro com ficha_num duplicado também devolvia 500.
  test("POST /api/members/ com ficha_num duplicado retorna 409", async ({ request }) => {
    const ts = Date.now();
    // Pega o maior ficha existente para evitar colisão acidental
    const list = await request.get("/api/members/?limit=200", { headers });
    const members = await list.json();
    const maxFicha = members.reduce(
      (m: number, x: any) => (x.ficha_num && x.ficha_num > m ? x.ficha_num : m),
      0
    );
    const ficha = maxFicha + 5000 + (ts % 1000);

    const first = await request.post("/api/members/", {
      headers,
      data: { name: `Dup Ficha E2E ${ts}`, ficha_num: ficha },
    });
    expect(first.ok()).toBeTruthy();

    const second = await request.post("/api/members/", {
      headers,
      data: { name: `Dup Ficha 2 E2E ${ts}`, ficha_num: ficha },
    });
    expect(second.status()).toBe(409);
    const body = await second.json();
    expect(typeof body.detail).toBe("string");
  });

  // Regressão Bug 2: frontend enviava string vazia para data_nascimento,
  // causando 422 ("input is too short"). Schema deve coerce "" -> None.
  test("POST /api/members/ aceita strings vazias em datas opcionais", async ({ request }) => {
    const ts = Date.now();
    const resp = await request.post("/api/members/", {
      headers,
      data: {
        name: `Empty Dates E2E ${ts}`,
        data_nascimento: "",
        data_casamento: "",
        data_membresia: "",
        email: "",
        cpf: "",
      },
    });

    expect(resp.status()).toBe(200);
    const created = await resp.json();
    expect(created.data_nascimento).toBeNull();
    expect(created.data_casamento).toBeNull();
    expect(created.data_membresia).toBeNull();
    expect(created.email).toBeNull();
    expect(created.cpf).toBeNull();
  });
});
