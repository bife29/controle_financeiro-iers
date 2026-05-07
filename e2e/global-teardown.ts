import { request as playwrightRequest } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";
import { E2E_TAG, looksLikeProduction } from "./helpers/e2e-tag";

const envFile =
  process.env.E2E_ENV === "production" ? ".env.production" : ".env";
dotenv.config({ path: path.resolve(__dirname, envFile) });

const API_URL = process.env.API_URL || "http://127.0.0.1:8001";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@iers.org";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const IS_PROD = process.env.E2E_ENV === "production";

/**
 * Cleanup ESTRITO: apaga somente registros cujo campo principal contém
 * a tag única do run atual (E2E_TAG = "[E2E-<runId>]").
 *
 * Defesas contra exclusão acidental em produção:
 *  1. Detecta URL de produção
 *  2. Em produção exige ALLOW_PROD_CLEANUP=true
 *  3. Filtro EXATO por tag (não regex frouxo)
 *  4. Aborta se a tag estiver inválida
 */
async function globalTeardown() {
  const isProdUrl = looksLikeProduction(API_URL) || IS_PROD;

  if (isProdUrl && process.env.ALLOW_PROD_CLEANUP !== "true") {
    console.log(
      "\n⛔ [TEARDOWN] Ambiente parece PRODUÇÃO e ALLOW_PROD_CLEANUP != 'true'."
    );
    console.log("    Cleanup ABORTADO por segurança. Nada foi apagado.\n");
    return;
  }

  if (!E2E_TAG || !/^\[E2E-/.test(E2E_TAG)) {
    console.log(
      "\n⛔ [TEARDOWN] E2E_TAG inválida — cleanup abortado para evitar dano.\n"
    );
    return;
  }

  console.log(
    `\n🧹 Cleanup STRICT-MODE — somente registros com tag ${E2E_TAG}\n`
  );

  const context = await playwrightRequest.newContext({ baseURL: API_URL });

  const loginResp = await context.post("/api/auth/login", {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!loginResp.ok()) {
    console.error("❌ Falha no login para cleanup:", await loginResp.text());
    await context.dispose();
    return;
  }
  const { access_token } = await loginResp.json();
  const headers = { Authorization: `Bearer ${access_token}` };

  async function deleteByTag(
    label: string,
    listUrl: string,
    deleteUrl: (id: number) => string,
    fields: string[]
  ) {
    try {
      const resp = await context.get(listUrl, { headers });
      if (!resp.ok()) return;
      const items = await resp.json();
      const arr = Array.isArray(items) ? items : items.items || [];
      const owned = arr.filter((it: any) =>
        fields.some(
          (f) => typeof it[f] === "string" && it[f].includes(E2E_TAG)
        )
      );
      for (const it of owned) {
        const del = await context.delete(deleteUrl(it.id), { headers });
        if (del.ok()) {
          console.log(
            `  ✅ ${label} #${it.id} deletado: ${(it[fields[0]] || "").slice(0, 60)}`
          );
        } else {
          console.log(`  ⚠️ Falha ${label} #${it.id}: ${del.status()}`);
        }
      }
    } catch (e) {
      console.log(`  ⚠️ Erro em ${label}:`, e);
    }
  }

  // Ordem: filhos antes de pais (FK)
  await deleteByTag("Retiro", "/api/retreats/", (id) => `/api/retreats/${id}`, ["name"]);
  await deleteByTag(
    "Transação",
    "/api/financial/transactions?limit=500",
    (id) => `/api/financial/transactions/${id}`,
    ["description"]
  );
  await deleteByTag(
    "Projeto",
    "/api/financial/projects",
    (id) => `/api/financial/projects/${id}`,
    ["name"]
  );
  await deleteByTag("Membro", "/api/members/", (id) => `/api/members/${id}`, ["name"]);
  await deleteByTag(
    "Feedback",
    "/api/feedback/",
    (id) => `/api/feedback/${id}`,
    ["title", "message"]
  );
  await deleteByTag("Patrimônio", "/api/patrimony", (id) => `/api/patrimony/${id}`, ["name"]);
  await deleteByTag(
    "Evento Secretaria",
    "/api/secretaria/events",
    (id) => `/api/secretaria/events/${id}`,
    ["title", "name"]
  );
  await deleteByTag(
    "Template",
    "/api/secretaria/message-templates",
    (id) => `/api/secretaria/message-templates/${id}`,
    ["name"]
  );
  await deleteByTag(
    "Grupo WhatsApp",
    "/api/secretaria/whatsapp-groups",
    (id) => `/api/secretaria/whatsapp-groups/${id}`,
    ["name"]
  );

  // Usuários: nunca toca em ADMIN_EMAIL
  try {
    const r = await context.get("/api/auth/users", { headers });
    if (r.ok()) {
      const users = await r.json();
      const safeTag = E2E_TAG.replace(/[\[\]\s]/g, "").toLowerCase();
      const owned = users.filter(
        (u: any) =>
          typeof u.email === "string" &&
          u.email.toLowerCase().includes(safeTag) &&
          u.email !== ADMIN_EMAIL
      );
      for (const u of owned) {
        const del = await context.delete(`/api/auth/users/${u.id}`, { headers });
        if (del.ok()) console.log(`  ✅ Usuário deletado: ${u.email}`);
      }
    }
  } catch (e) {
    console.log("  ⚠️ Erro ao limpar usuários:", e);
  }

  await context.dispose();
  console.log("\n🧹 Cleanup STRICT-MODE concluído.\n");
}

export default globalTeardown;
