/**
 * Suite de tests complète pour Lieko Express
 * Lance l'application et teste tous les endpoints
 */

const BASE_URL = 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m'
};

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logTest(name) {
  log(`\n→ ${name}`, 'blue');
}

function logSuccess(msg) {
  stats.passed++;
  log(`  ✓ ${msg}`, 'green');
}

function logError(msg, error) {
  stats.failed++;
  log(`  ✗ ${msg}`, 'red');
  if (error) {
    log(`    ${error}`, 'gray');
    stats.errors.push({ test: msg, error: error.toString() });
  }
}

async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');
    
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    return { response, data };
  } catch (error) {
    throw new Error(`Request failed: ${error.message}`);
  }
}

function assert(condition, message) {
  stats.total++;
  if (condition) {
    logSuccess(message);
  } else {
    logError(message, new Error('Assertion failed'));
  }
}

function assertEquals(actual, expected, message) {
  stats.total++;
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    logSuccess(message);
  } else {
    logError(message, new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`));
  }
}

// ============================================
// TESTS
// ============================================

async function runTests() {
  log('\n╔══════════════════════════════════════════╗', 'yellow');
  log('║     LIEKO EXPRESS TEST SUITE             ║', 'yellow');
  log('╚══════════════════════════════════════════╝', 'yellow');

  // Attendre que le serveur soit prêt
  await new Promise(resolve => setTimeout(resolve, 1000));

  // ============================================
  // TEST 1: Routes de base
  // ============================================
  logTest('Test 1: Routes de base');
  
  try {
    const { response, data } = await makeRequest(BASE_URL);
    assert(response.status === 200, 'GET / return 200');
    assert(data.message === 'Welcome to Lieko Express API', 'Message de bienvenue correct');
    assert(data.endpoints !== undefined, 'Endpoints listés');
  } catch (error) {
    logError('GET /', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/health`);
    assert(response.status === 200, 'GET /health return 200');
    assert(data.success === true, 'Health check successful');
    assert(data.data.status === 'healthy', 'Status est healthy');
  } catch (error) {
    logError('GET /health', error);
  }

  // ============================================
  // TEST 2: Gestion 404
  // ============================================
  logTest('Test 2: Gestion des erreurs 404');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/route-inexistante`);
    assert(response.status === 404, 'Route inexistante return 404');
    assert(data.success === false, 'Success = false pour 404');
    assert(data.error.code === 'NOT_FOUND', 'Code erreur NOT_FOUND');
  } catch (error) {
    logError('404 handling', error);
  }

  // ============================================
  // TEST 3: API Users - GET
  // ============================================
  logTest('Test 3: API Users - GET');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users`);
    assert(response.status === 200, 'GET /api/users return 200');
    assert(Array.isArray(data.data), 'return un tableau d\'utilisateurs');
    assert(data.data.length >= 2, 'Contient au moins 2 utilisateurs');
  } catch (error) {
    logError('GET /api/users', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users/1`);
    assert(response.status === 200, 'GET /api/users/1 return 200');
    assert(data.data.id === 1, 'Utilisateur a l\'ID correct');
    assert(data.data.username === 'john_doe', 'Username correct');
  } catch (error) {
    logError('GET /api/users/:id', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users/999`);
    assert(response.status === 404, 'Utilisateur inexistant return 404');
    assert(data.error.code === 'NOT_FOUND', 'Code erreur correct');
  } catch (error) {
    logError('GET /api/users/:id (not found)', error);
  }

  // ============================================
  // TEST 4: Query Parameters
  // ============================================
  logTest('Test 4: Query Parameters avec conversion automatique');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users?active=true&minAge=25`);
    assert(response.status === 200, 'Query params fonctionnent');
    assert(data.data.every(u => u.active === true), 'Filtre active=true fonctionne');
    assert(data.data.every(u => u.age >= 25), 'Filtre minAge fonctionne');
  } catch (error) {
    logError('Query params filtering', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/test/query?age=25&price=19.99&active=true&name=test`);
    assert(response.status === 200, 'GET /test/query return 200');
    assertEquals(typeof data.data.query.age, 'number', 'age converti en number');
    assertEquals(typeof data.data.query.price, 'number', 'price converti en number');
    assertEquals(typeof data.data.query.active, 'boolean', 'active converti en boolean');
    assertEquals(data.data.query.age, 25, 'Valeur age correcte');
    assertEquals(data.data.query.active, true, 'Valeur active correcte');
  } catch (error) {
    logError('Automatic type conversion', error);
  }

  // ============================================
  // TEST 5: Validation - POST Users (succès)
  // ============================================
  logTest('Test 5: Validation - POST Users (succès)');
  
  try {
    // Utiliser un username court pour respecter la limite de 20 caractères
    const timestamp = Date.now().toString().slice(-6); // 6 derniers chiffres
    const newUser = {
      username: `user${timestamp}`,
      email: `test${timestamp}@example.com`,
      age: 25,
      acceptTerms: true
    };

    const { response, data } = await makeRequest(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });

    console.log(response.status, data)

    assert(response.status === 201, `POST /api/users return 201 (got ${response.status})`);
    assert(data.success === true, `Création réussie (success=${data.success})`);
    assert(data.data && data.data.username === newUser.username, 'Username correct');
    assert(data.data && data.data.email === newUser.email, 'Email correct');
  } catch (error) {
    logError('POST /api/users (valid data)', error);
  }

  // ============================================
  // TEST 6: Validation - Erreurs
  // ============================================
  logTest('Test 6: Validation - Erreurs de validation');
  
  // Username trop court
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ab',
        email: 'test@example.com',
        age: 25,
        acceptTerms: true
      })
    });

    assert(response.status === 400, 'Username trop court return 400');
    assert(data.success === false, 'Validation échoue');
    assert(data.errors.some(e => e.type === 'minLength'), 'Erreur minLength présente');
  } catch (error) {
    logError('Username trop court', error);
  }

  // Email invalide
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'invalid-email',
        age: 25,
        acceptTerms: true
      })
    });

    assert(response.status === 400, 'Email invalide return 400');
    assert(data.errors.some(e => e.type === 'email'), 'Erreur email présente');
  } catch (error) {
    logError('Email invalide', error);
  }

  // Age trop jeune
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        age: 15,
        acceptTerms: true
      })
    });

    assert(response.status === 400, 'Age < 18 return 400');
    assert(data.errors.some(e => e.type === 'min'), 'Erreur min présente');
  } catch (error) {
    logError('Age trop jeune', error);
  }

  // Terms non acceptés
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        email: 'test@example.com',
        age: 25,
        acceptTerms: false
      })
    });

    assert(response.status === 400, 'Terms non acceptés return 400');
    assert(data.errors.some(e => e.type === 'mustBeTrue'), 'Erreur mustBeTrue présente');
  } catch (error) {
    logError('Terms non acceptés', error);
  }

  // Champs requis manquants
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert(response.status === 400, 'Champs manquants return 400');
    assert(data.errors.length >= 3, 'Plusieurs erreurs de validation');
  } catch (error) {
    logError('Champs requis manquants', error);
  }

  // ============================================
  // TEST 7: API Posts
  // ============================================
  logTest('Test 7: API Posts - GET');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/posts`);
    assert(response.status === 200, 'GET /api/posts return 200');
    assert(Array.isArray(data.data), 'return un tableau de posts');
  } catch (error) {
    logError('GET /api/posts', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/posts/1`);
    assert(response.status === 200, 'GET /api/posts/1 return 200');
    assert(data.data.id === 1, 'Post a l\'ID correct');
    assert(Array.isArray(data.data.comments), 'Post inclut les commentaires');
  } catch (error) {
    logError('GET /api/posts/:id', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/posts?userId=1&published=true`);
    assert(response.status === 200, 'Query params posts fonctionnent');
    assert(data.data.every(p => p.userId === 1), 'Filtre userId fonctionne');
    assert(data.data.every(p => p.published === true), 'Filtre published fonctionne');
  } catch (error) {
    logError('GET /api/posts with filters', error);
  }

  // ============================================
  // TEST 8: Authentification
  // ============================================
  logTest('Test 8: Authentification');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/protected`);
    assert(response.status === 401, 'Route protégée sans token return 401');
    assert(data.error.code === 'NO_TOKEN_PROVIDED', 'Code erreur correct');
  } catch (error) {
    logError('Protected route sans token', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/protected`, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    assert(response.status === 401, 'Token invalide return 401');
    assert(data.error.code === 'INVALID_TOKEN', 'Code erreur correct');
  } catch (error) {
    logError('Protected route avec token invalide', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/protected`, {
      headers: { 'Authorization': 'Bearer secret-token-123' }
    });
    assert(response.status === 200, 'Token valide return 200');
    assert(data.data.user.username === 'john_doe', 'User info disponible');
  } catch (error) {
    logError('Protected route avec token valide', error);
  }

  // ============================================
  // TEST 9: POST Posts avec auth
  // ============================================
  logTest('Test 9: POST Posts avec authentification');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Post',
        content: 'This is a test post'
      })
    });
    assert(response.status === 401, 'POST sans auth return 401');
  } catch (error) {
    logError('POST /api/posts sans auth', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer secret-token-123'
      },
      body: JSON.stringify({
        title: 'My Amazing Post',
        content: 'This is a longer content for my post that should pass validation',
        published: true
      })
    });
    assert(response.status === 201, 'POST avec auth return 201');
    assert(data.data.title === 'My Amazing Post', 'Title correct');
    assert(data.data.userId === 1, 'UserId assigné automatiquement');
  } catch (error) {
    logError('POST /api/posts avec auth', error);
  }

  // ============================================
  // TEST 10: Comments avec validation
  // ============================================
  logTest('Test 10: Comments avec validation');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Great article!',
        postId: 1
      })
    });
    assert(response.status === 201, 'POST comment valide return 201');
    assert(data.data.text === 'Great article!', 'Text correct');
    assert(data.data.postId === 1, 'PostId correct');
  } catch (error) {
    logError('POST /api/comments (valid)', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Comment',
        postId: 9999
      })
    });
    assert(response.status === 400, 'Post inexistant return 400');
    assert(data.errors.some(e => e.type === 'custom'), 'Validation custom fonctionne');
  } catch (error) {
    logError('POST /api/comments (invalid postId)', error);
  }

  // ============================================
  // TEST 11: Route params
  // ============================================
  logTest('Test 11: Route parameters');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/test/params/electronics/42`);
    assert(response.status === 200, 'Route avec params return 200');
    assertEquals(data.data.params.category, 'electronics', 'Param category correct');
    assertEquals(data.data.params.id, '42', 'Param id correct');
  } catch (error) {
    logError('Route params', error);
  }

  // ============================================
  // TEST 12: PUT et DELETE
  // ============================================
  logTest('Test 12: PUT et DELETE');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users/1`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newemail@example.com',
        age: 31
      })
    });
    assert(response.status === 200, 'PUT return 200');
    assert(data.data.email === 'newemail@example.com', 'Email mis à jour');
  } catch (error) {
    logError('PUT /api/users/:id', error);
  }

  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/users/2`, {
      method: 'DELETE'
    });
    assert(response.status === 200, 'DELETE return 200');
    assert(data.data.deleted === true, 'Confirmation de suppression');
  } catch (error) {
    logError('DELETE /api/users/:id', error);
  }

  // ============================================
  // TEST 13: PATCH
  // ============================================
  logTest('Test 13: PATCH - Publish post');
  
  try {
    const { response, data } = await makeRequest(`${BASE_URL}/api/posts/2/publish`, {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer secret-token-123' }
    });
    assert(response.status === 200, 'PATCH return 200');
    assert(data.data.published === true, 'Post publié');
  } catch (error) {
    logError('PATCH /api/posts/:id/publish', error);
  }

  // ============================================
  // TEST 14: URL-encoded form data
  // ============================================
  logTest('Test 14: Form URL-encoded');
  
  try {
    const formData = new URLSearchParams({
      title: 'Form Post',
      content: 'This is from URL-encoded form',
      published: 'true'
    });

    const { response, data } = await makeRequest(`${BASE_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Bearer secret-token-123'
      },
      body: formData.toString()
    });
    assert(response.status === 201, 'Form data accepté');
    assert(data.data.title === 'Form Post', 'Title depuis form correct');
  } catch (error) {
    logError('URL-encoded form data', error);
  }

  // ============================================
  // TEST 15: Redirection
  // ============================================
  logTest('Test 15: Redirection');
  
  try {
    const response = await fetch(`${BASE_URL}/redirect`, {
      redirect: 'manual'
    });
    assert(response.status === 302, 'Redirection return 302');
    assert(response.headers.get('location') === '/', 'Location header correct');
  } catch (error) {
    logError('Redirection', error);
  }

  log('\n╔══════════════════════════════════════════╗', 'yellow');
  log('║           TEST SUMMARY                   ║', 'yellow');
  log('╚══════════════════════════════════════════╝', 'yellow');
  
  log(`\nTotal tests: ${stats.total}`);
  log(`Passed: ${stats.passed}`, 'green');
  log(`Failed: ${stats.failed}`, stats.failed > 0 ? 'red' : 'green');
  log(`Success rate: ${((stats.passed / stats.total) * 100).toFixed(2)}%\n`);

  if (stats.failed > 0) {
    log('Failed tests:', 'red');
    stats.errors.forEach(({ test, error }) => {
      log(`  • ${test}`, 'red');
      log(`    ${error}`, 'gray');
    });
  }

  process.exit(stats.failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  log(`\n❌ Test suite crashed: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});