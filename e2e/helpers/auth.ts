import { APIRequestContext } from "@playwright/test";

const API_URL = process.env.API_URL || "http://127.0.0.1:8001";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@iers.org";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export interface AuthToken {
  access_token: string;
  token_type: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
}

/**
 * Faz login via API e retorna o token JWT
 */
export async function getAuthToken(
  request: APIRequestContext,
  email = ADMIN_EMAIL,
  password = ADMIN_PASSWORD
): Promise<AuthToken> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login falhou: ${response.status()} ${await response.text()}`);
  }

  return response.json();
}

/**
 * Retorna headers de autenticação prontos para uso
 */
export async function getAuthHeaders(
  request: APIRequestContext,
  email?: string,
  password?: string
): Promise<Record<string, string>> {
  const auth = await getAuthToken(request, email, password);
  return {
    Authorization: `Bearer ${auth.access_token}`,
  };
}
