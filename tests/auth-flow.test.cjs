const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual page functions with controlled Supabase responses.
function load(file, names, context) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const functions = names.map(name => {
    const start = html.indexOf(`        async function ${name}(`);
    assert.ok(start >= 0, name);
    const end = html.indexOf('\n        }', start) + '\n        }'.length;
    return html.slice(start, end);
  }).join('\n');
  vm.createContext(context);
  vm.runInContext(functions, context);
  return context;
}

test('admin gate denies non-admin and RPC errors without initializing panel', async () => {
  for (const response of [{ data: false }, { data: null, error: new Error('offline') }]) {
    let initialized = false, signedOut = false, hidden = false;
    const ctx = load('admin.html', ['sesionTieneRolAdmin', 'mostrarPanelSiEsAdmin'], {
      _supabase: { rpc: async name => { assert.equal(name, 'is_admin'); return response; },
        auth: { signOut: async () => { signedOut = true; } } },
      mostrarErrorAdmin() {},
      document: { getElementById: () => ({ classList: { add: () => { hidden = true; } } }) },
      inicializarPanelCompleto: async () => { initialized = true; },
    });
    if (response.error) await assert.rejects(ctx.mostrarPanelSiEsAdmin(), /offline/);
    else { assert.equal(await ctx.mostrarPanelSiEsAdmin(), false); assert.equal(signedOut, true); }
    assert.equal(initialized, false);
    assert.equal(hidden, false);
  }
});

test('verified admin role initializes panel', async () => {
  let initialized = false;
  const ctx = load('admin.html', ['sesionTieneRolAdmin', 'mostrarPanelSiEsAdmin'], {
    _supabase: { rpc: async () => ({ data: true }) },
    document: { getElementById: () => ({ classList: { add() {} } }) },
    inicializarPanelCompleto: async () => { initialized = true; },
  });
  assert.equal(await ctx.mostrarPanelSiEsAdmin(), true);
  assert.equal(initialized, true);
});

test('student lookup uses authenticated identity and rejects unlinked accounts', async () => {
  for (const student of [null, { id: 'student-1' }]) {
    let signedOut = false;
    const query = { select() { return this; }, eq(field, value) {
      assert.equal(field, 'auth_user_id'); assert.equal(value, 'auth-1'); return this;
    }, async maybeSingle() { return { data: student }; } };
    const ctx = load('alumnos.html', ['cargarAtletaDeSesion'], {
      _supabase: { from(name) { assert.equal(name, 'usuarios_alumnos'); return query; },
        auth: { signOut: async () => { signedOut = true; } } },
    });
    if (student) assert.equal(await ctx.cargarAtletaDeSesion({ user: { id: 'auth-1' } }), student);
    else await assert.rejects(ctx.cargarAtletaDeSesion({ user: { id: 'auth-1' } }), /no está asociada/);
    assert.equal(signedOut, !student);
  }
});

test('magic link returns to alumnos.html and handles send failure', async () => {
  for (const fail of [false, true]) {
    let success = false, errorShown = false;
    const loading = [];
    const ctx = load('alumnos.html', ['intentarIniciarSesion'], {
      URL, window: { location: { href: 'https://vitalcore-tienda.github.io/vitalcoretrainer/alumnos.html' } },
      document: { getElementById: () => ({ value: ' ATHLETE@example.com ', classList: { add() {} } }) },
      establecerCargaLogin: value => loading.push(value),
      mostrarMensajeLogin: () => { success = true; }, mostrarError: () => { errorShown = true; },
      console: { error() {} },
      _supabase: { auth: { signInWithOtp: async args => {
        assert.equal(args.email, 'athlete@example.com');
        assert.equal(args.options.emailRedirectTo, 'https://vitalcore-tienda.github.io/vitalcoretrainer/alumnos.html');
        return { error: fail ? new Error('send failed') : null };
      } } },
    });
    await ctx.intentarIniciarSesion();
    assert.equal(success, !fail); assert.equal(errorShown, fail);
    assert.deepEqual(loading, [true, false]);
  }
});

test('password recovery uses the dedicated return URL', async () => {
  let requested = false;
  const elements = {
    'admin-email': { value: ' ADMIN@example.com ', reportValidity: () => true },
    'recover-password-button': {}, 'recovery-message': {},
  };
  const ctx = load('admin.html', ['solicitarRecuperacion'], {
    URL, window: { location: { href: 'https://vitalcore-tienda.github.io/vitalcoretrainer/admin.html' } },
    document: { getElementById: id => elements[id] },
    _supabase: { auth: { resetPasswordForEmail: async (email, options) => {
      assert.equal(email, 'admin@example.com');
      assert.equal(options.redirectTo, 'https://vitalcore-tienda.github.io/vitalcoretrainer/admin.html?recuperar=1');
      requested = true; return { error: null };
    } } },
  });
  await ctx.solicitarRecuperacion();
  assert.equal(requested, true);
  assert.equal(elements['recover-password-button'].disabled, false);
});

test('password reset rejects mismatches and handles expired sessions', async () => {
  for (const mismatch of [true, false]) {
    let called = false;
    const elements = { 'new-password': { value: 'example-test-password' },
      'confirm-password': { value: mismatch ? 'different' : 'example-test-password' },
      'recovery-message': {}, 'save-password-button': {} };
    const ctx = load('admin.html', ['guardarNuevaClave'], {
      document: { getElementById: id => elements[id] },
      _supabase: { auth: { updateUser: async () => { called = true; return { error: new Error('expired') }; } } },
    });
    await ctx.guardarNuevaClave({ preventDefault() {} });
    assert.equal(called, !mismatch);
    assert.match(elements['recovery-message'].textContent, mismatch ? /coincidir/ : /vencido/);
    if (!mismatch) assert.equal(elements['save-password-button'].disabled, false);
  }
});
