import { request as playwrightRequest } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env") });

const API_URL = process.env.API_URL || "http://127.0.0.1:8001";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@iers.org";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

/**
 * Global teardown: apaga todos os dados criados pelos testes E2E em produção.
 * Ordem correta: retiros → transações → projetos → membros → feedbacks → usuários
 */
async function globalTeardown() {
  console.log("\n🧹 Limpando dados de teste em produção...\n");

  const context = await playwrightRequest.newContext({ baseURL: API_URL });

  // Login
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

  // Padrão para identificar dados de teste
  const TEST_PATTERN = /e2e|teste|test|ui.?test|playwright|p[1-6]\s*-|para remover|retirante|convidado|visitante|criança|duplicado|busca.?teste|contato|fallback|detalhe/i;

  // 1. Limpar retiros de teste PRIMEIRO (cascateia participantes e pagamentos via API)
  try {
    const retreatsResp = await context.get("/api/retreats/", { headers });
    if (retreatsResp.ok()) {
      const retreats = await retreatsResp.json();
      const testRetreats = retreats.filter((r: any) => TEST_PATTERN.test(r.name));
      for (const retreat of testRetreats) {
        const del = await context.delete(`/api/retreats/${retreat.id}`, { headers });
        if (del.ok()) {
          console.log(`  ✅ Retiro deletado: ${retreat.name}`);
        } else {
          console.log(`  ⚠️ Falha ao deletar retiro ${retreat.id}: ${del.status()}`);
        }
      }
    }
  } catch (e) {
    console.log("  ⚠️ Erro ao limpar retiros:", e);
  }

  // 2. Limpar transações de teste (limit alto para pegar todas)
  try {
    const txResp = await context.get("/api/financial/transactions?limit=500", { headers });
    if (txResp.ok()) {
      const transactions = await txResp.json();
      const testTx = transactions.filter((t: any) =>
        TEST_PATTERN.test(t.description || "")
      );
      for (const tx of testTx) {
        const del = await context.delete(`/api/financial/transactions/${tx.id}`, { headers });
        if (del.ok()) {
          console.log(`  ✅ Transação deletada: ${tx.description}`);
        } else {
          console.log(`  ⚠️ Falha ao deletar transação ${tx.id}: ${del.status()}`);
        }
      }
    }
  } catch (e) {
    console.log("  ⚠️ Erro ao limpar transações:", e);
  }

  // 3. Limpar projetos financeiros de teste (após transações)
  try {
    const projResp = await context.get("/api/financial/projects", { headers });
    if (projResp.ok()) {
      const projects = await projResp.json();
      const testProjects = projects.filter((p: any) =>
        TEST_PATTERN.test(p.name) && !/geral|d[ií]zimos/i.test(p.name)
      );
      for (const project of testProjects) {
        const del = await context.delete(`/api/financial/projects/${project.id}`, { headers });
        if (del.ok()) {
          console.log(`  ✅ Projeto deletado: ${project.name}`);
        } else {
          console.log(`  ⚠️ Falha ao deletar projeto ${project.id}: ${del.status()}`);
        }
      }
    }
  } catch (e) {
    console.log("  ⚠️ Erro ao limpar projetos:", e);
  }

  // 4. Limpar membros de teste
  try {
    const membersResp = await context.get("/api/members/", { headers });
    if (membersResp.ok()) {
      const members = await membersResp.json();
      const testMembers = members.filter((m: any) => TEST_PATTERN.test(m.name));
      for (const member of testMembers) {
        const del = await context.delete(`/api/members/${member.id}`, { headers });
        if (del.ok()) {
          console.log(`  ✅ Membro deletado: ${member.name}`);
        } else {
          console.log(`  ⚠️ Falha ao deletar membro ${member.id}: ${del.status()}`);
        }
      }
    }
  } catch (e) {
    console.log("  ⚠️ Erro ao limpar membros:", e);
  }

  // 5. Limpar feedbacks de teste
  try {
    const fbResp = await context.get("/api/feedback/", { headers });
    if (fbResp.ok()) {
      const feedbacks = await fbResp.json();
      const testFb = feedbacks.filter((f: any) =>
        TEST_PATTERN.test(f.title || f.message || "")
      );
      for (const fb of testFb) {
        const del = await context.delete(`/api/feedback/${fb.id}`, { headers });
        if (del.ok()) {
          console.log(`  ✅ Feedback deletado: ${fb.title || fb.id}`);
        } else {
          console.log(`  ⚠️ Falha ao deletar feedback ${fb.id}: ${del.status()}`);
        }
      }
    }
  } catch (e) {
    console.log("  ⚠️ Erro ao limpar feedbacks:", e);
  }

  // 6. Limpar usuários de teste
  try {
    const usersResp = await context.get("/api/auth/users", { headers });
    if (usersResp.ok()) {
      const users = await usersResp.json();
      const testUsers = users.filter((u: any) =>
        /e2e|test|uitest/i.test(u.email) && u.email !== ADMIN_EMAIL
      );
      for (const user of testUsers) {
        const del = await context.delete(`/api/auth/users/${user.id}`, { headers });
        if (del.ok()) {
          console.log(`  ✅ Usuário deletado: ${user.email}`);
        } else {
          console.log(`  ⚠️ Falha ao deletar usuário ${user.id}: ${del.status()}`);
        }
      }
    }
  } catch (e) {
    console.log("  ⚠️ Erro ao limpar usuários:", e);
  }

  await context.dispose();
  console.log("\n🧹 Cleanup concluído!\n");
}

export default globalTeardown;
