/**
 * Tag única por execução de testes.
 *
 * TODOS os dados criados pelos testes E2E DEVEM conter este prefixo no
 * campo principal (description / name / title / email).
 *
 * O global-teardown SÓ apaga registros que contenham esta string EXATA.
 * Isso impede que cleanup acidente apague dados legítimos.
 */
const RUN_ID =
  process.env.E2E_RUN_ID ||
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const E2E_TAG = `[E2E-${RUN_ID}]`;

/** Prefixa um texto com a tag única do run atual. */
export function tag(label: string): string {
  return `${E2E_TAG} ${label}`;
}

/** Email com a tag (válido como local-part de e-mail). */
export function tagEmail(local: string): string {
  // colchetes não são válidos em e-mail; usamos formato e2e-<runId>-<local>@
  const safe = E2E_TAG.replace(/[\[\]\s]/g, "").toLowerCase();
  return `${safe}-${local}@e2e.iers.test`;
}

/** Verifica se um valor textual contém a tag deste run (para asserts/cleanup). */
export function isOwnedByThisRun(text: string | null | undefined): boolean {
  return !!text && text.includes(E2E_TAG);
}

/**
 * Detecta se a URL aponta para um ambiente de produção conhecido.
 * Usado por guard de seguranca em teardown e em suites destrutivas.
 */
export function looksLikeProduction(url: string | undefined): boolean {
  if (!url) return false;
  return /onrender\.com|vercel\.app|herokuapp\.com|railway\.app|fly\.dev|neon\.tech|amazonaws\.com|azurewebsites\.net|appspot\.com/i.test(
    url
  );
}

export const RUN_INFO = {
  runId: RUN_ID,
  tag: E2E_TAG,
};
