import process from 'node:process';

const baseUrl = (process.env.QA_BASE_URL || 'http://127.0.0.1:3000').replace(
  /\/$/,
  '',
);

const routes = [
  '/',
  '/login',
  '/api/health',
  '/status',
  '/api/public/status',
  '/dashboard',
  '/dashboard/agenda',
  '/dashboard/clientes',
  '/dashboard/servicos',
  '/dashboard/equipa',
  '/dashboard/mensagens',
  '/dashboard/settings',
  '/dashboard/billing',
];

const expectedPrivateRedirects = new Set([
  '/dashboard',
  '/dashboard/agenda',
  '/dashboard/clientes',
  '/dashboard/servicos',
  '/dashboard/equipa',
  '/dashboard/mensagens',
  '/dashboard/settings',
  '/dashboard/billing',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkRoute(route) {
  const response = await fetch(`${baseUrl}${route}`, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Silentra-QA-Smoke/1.0' },
  });

  const location = response.headers.get('location');
  const allowedRedirect = expectedPrivateRedirects.has(route) && location;

  assert(response.status < 500, `${route}: respondeu ${response.status}`);

  assert(
    response.status === 200 ||
      allowedRedirect ||
      (response.status >= 300 && response.status < 400),
    `${route}: estado inesperado ${response.status}${location ? ` -> ${location}` : ''}`,
  );

  if (route === '/api/public/status') {
    assert(response.status === 200, '/api/public/status: esperado 200');
    const payload = await response.json();
    assert(payload?.ok === true, '/api/public/status: payload inválido');
    assert(Array.isArray(payload?.components), '/api/public/status: componentes em falta');
    assert(payload.components.length === 2, '/api/public/status: devem existir apenas dois componentes');
    assert(payload.components.some((item) => item.id === 'api'), '/api/public/status: APIs da Silentra em falta');
    assert(payload.components.some((item) => item.id === 'database'), '/api/public/status: base de dados em falta');
  }

  if (route === '/api/health') {
    assert(
      response.status === 200,
      `/api/health: esperado 200, recebido ${response.status}`,
    );
    const payload = await response.json();
    assert(payload?.ok === true, '/api/health: payload inválido');
    assert(payload?.status === 'healthy', '/api/health: status inválido');
  }

  return { route, status: response.status, location };
}

async function main() {
  console.log(`Smoke QA: ${baseUrl}`);

  const results = [];
  for (const route of routes) {
    try {
      results.push(await checkRoute(route));
      const result = results.at(-1);
      console.log(
        `✓ ${result.route} (${result.status})${result.location ? ` -> ${result.location}` : ''}`,
      );
    } catch (error) {
      console.error(
        `✕ ${route}: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    }
  }

  if (process.exitCode === 1) throw new Error('Smoke QA falhou.');

  console.log(`\n${results.length}/${routes.length} rotas verificadas.`);
}

await main();
