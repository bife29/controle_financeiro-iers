Set-Location $PSScriptRoot
$env:E2E_ENV = 'production'
$env:ALLOW_PROD_CLEANUP = 'true'
# Reusa cleanup standalone — limpa TUDO com prefixo [E2E- (qualquer run anterior)
node -e "
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve('.env.production') });
const { request } = require('@playwright/test');
const API = process.env.API_URL;
const EMAIL = process.env.ADMIN_EMAIL;
const PASS = process.env.ADMIN_PASSWORD;
const TAG_PREFIX = '[E2E-';

(async () => {
  const ctx = await request.newContext({ baseURL: API });
  const login = await ctx.post('/api/auth/login', { data: { email: EMAIL, password: PASS } });
  const { access_token } = await login.json();
  const H = { Authorization: 'Bearer ' + access_token };

  async function clean(label, list, del, fields) {
    try {
      const r = await ctx.get(list, { headers: H });
      if (!r.ok()) { console.log('skip', label, r.status()); return; }
      const body = await r.json();
      const arr = Array.isArray(body) ? body : (body.items || []);
      const owned = arr.filter(it => fields.some(f => typeof it[f] === 'string' && it[f].includes(TAG_PREFIX)));
      console.log(label + ': ' + owned.length + ' encontrados com tag E2E');
      for (const it of owned) {
        const d = await ctx.delete(del(it.id), { headers: H });
        console.log(' -', d.ok() ? 'OK' : 'FAIL '+d.status(), label, it.id, (it[fields[0]]||'').slice(0,70));
      }
    } catch (e) { console.log('erro', label, e.message); }
  }

  await clean('Retiro', '/api/retreats/', id => '/api/retreats/' + id, ['name']);
  await clean('Transacao', '/api/financial/transactions?limit=500', id => '/api/financial/transactions/' + id, ['description']);
  await clean('Projeto', '/api/financial/projects', id => '/api/financial/projects/' + id, ['name']);
  await clean('Membro', '/api/members/', id => '/api/members/' + id, ['name']);
  await clean('Feedback', '/api/feedback/', id => '/api/feedback/' + id, ['title','message']);
  await clean('Patrimonio', '/api/patrimony', id => '/api/patrimony/' + id, ['name']);
  await clean('CategoriaPatrimonio', '/api/patrimony/categories', id => '/api/patrimony/categories/' + id, ['name']);

  // usuarios: o e-mail tagueado nao tem o '[E2E-', usa 'e2e-' (helper desemoticonou)
  const usersR = await ctx.get('/api/auth/users', { headers: H });
  if (usersR.ok()) {
    const users = await usersR.json();
    const owned = users.filter(u => typeof u.email === 'string' && (u.email.includes('@iers-e2e.org') || u.email.includes('@e2e.iers.test')) && u.email !== EMAIL);
    console.log('Usuario: ' + owned.length + ' tagueados');
    for (const u of owned) {
      const d = await ctx.delete('/api/auth/users/' + u.id, { headers: H });
      console.log(' -', d.ok() ? 'OK' : 'FAIL '+d.status(), 'User', u.id, u.email);
    }
  }

  await ctx.dispose();
  console.log('FIM');
})().catch(e => { console.error(e); process.exit(1); });
"
