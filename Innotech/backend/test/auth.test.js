import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'ahms-auth-test-'));
process.env.AHMS_DATABASE_PATH = path.join(temporaryDirectory, 'test.db');
process.env.NODE_ENV = 'test';

const [{ default: app }, database, sqlite, auth] = await Promise.all([
  import('../src/app.js'),
  import('../src/db.js'),
  import('../src/lib/sqlite.js'),
  import('../src/features/auth/auth.service.js'),
]);

let server;

test('authenticates, scopes astronaut access, and limits Mission Control to reads', async () => {
  try {
    await database.initializeDatabase();
    await sqlite.queryAll('SELECT id FROM astronauts LIMIT 1');
    await sqlite.execute(
      'INSERT INTO users (email, password_hash, role, astronaut_id) VALUES (?, ?, ?, ?)',
      ['ava@example.test', await auth.hashPassword('correct-horse-battery-01'), 'astronaut', 'astro-01']
    );
    await sqlite.execute(
      'INSERT INTO users (email, password_hash, role, astronaut_id) VALUES (?, ?, ?, ?)',
      ['control@example.test', await auth.hashPassword('correct-horse-battery-02'), 'mission-control', null]
    );

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const request = (route, options = {}) => fetch(`${baseUrl}${route}`, options);
    const jsonPost = (route, body, cookie, operationId = randomUUID()) => request(route, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': operationId,
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    });

    const unauthenticated = await request('/astronauts');
    assert.equal(unauthenticated.status, 401);

    const invalidLogin = await jsonPost('/auth/login', {
      email: 'ava@example.test',
      password: 'wrong-password',
    });
    assert.equal(invalidLogin.status, 401);

    const astronautLogin = await jsonPost('/auth/login', {
      email: 'AVA@example.test',
      password: 'correct-horse-battery-01',
    });
    assert.equal(astronautLogin.status, 200);
    const astronautSetCookie = astronautLogin.headers.get('set-cookie');
    assert.match(astronautSetCookie, /HttpOnly/i);
    assert.match(astronautSetCookie, /SameSite=Strict/i);
    const astronautCookie = astronautSetCookie.split(';')[0];

    const currentUser = await request('/auth/me', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal((await currentUser.json()).user.astronautId, 'astro-01');

    const astronautList = await request('/astronauts', {
      headers: { Cookie: astronautCookie },
    });
    assert.deepEqual((await astronautList.json()).map((person) => person.id), ['astro-01']);

    const ownSummary = await request('/astronauts/astro-01/summary', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(ownSummary.status, 200);

    const symptomOperationId = randomUUID();
    const symptomPayload = {
      title: 'Teste autorizado',
      severity: 'mild',
    };
    const ownWrite = await jsonPost('/astronauts/astro-01/symptoms', symptomPayload, astronautCookie, symptomOperationId);
    assert.equal(ownWrite.status, 201);
    const firstWriteBody = await ownWrite.json();
    const duplicateWrite = await jsonPost('/astronauts/astro-01/symptoms', symptomPayload, astronautCookie, symptomOperationId);
    assert.equal(duplicateWrite.status, 201);
    assert.deepEqual(await duplicateWrite.json(), firstWriteBody);
    const conflictingReplay = await jsonPost(
      '/astronauts/astro-01/symptoms',
      { ...symptomPayload, severity: 'severe' },
      astronautCookie,
      symptomOperationId
    );
    assert.equal(conflictingReplay.status, 409);
    const symptomRows = await sqlite.queryAll(
      "SELECT id FROM symptoms WHERE astronaut_id = 'astro-01' AND title = 'Teste autorizado'"
    );
    assert.equal(symptomRows.length, 1);

    const categorizedSymptom = await jsonPost('/astronauts/astro-01/symptoms', {
      category: 'dizziness',
      severity: 'mild',
      description: 'Registo categorizado',
    }, astronautCookie);
    assert.equal(categorizedSymptom.status, 201);
    const categorizedRows = await sqlite.queryAll(
      'SELECT title, category FROM symptoms WHERE id = ?',
      [(await categorizedSymptom.json()).id]
    );
    assert.deepEqual(categorizedRows, [{ title: 'Tontura', category: 'dizziness' }]);

    const invalidSymptomCategory = await jsonPost('/astronauts/astro-01/symptoms', {
      title: 'Categoria inválida',
      category: 'unknown',
    }, astronautCookie);
    assert.equal(invalidSymptomCategory.status, 400);

    const legacyCheckin = await jsonPost('/astronauts/astro-01/checkin', {
      sleepHours: 7,
      stressLevel: 3,
      fatigueLevel: 2,
    }, astronautCookie);
    assert.equal(legacyCheckin.status, 201);
    const legacyCheckinRow = await sqlite.queryAll(
      'SELECT isolation_level, concentration_level, motivation_level, sleep_quality FROM health_measurements WHERE id = ?',
      [(await legacyCheckin.json()).id]
    );
    assert.deepEqual(legacyCheckinRow, [{
      isolation_level: null,
      concentration_level: null,
      motivation_level: null,
      sleep_quality: null,
    }]);

    const behavioralCheckin = await jsonPost('/astronauts/astro-01/checkin', {
      sleepHours: 7.5,
      stressLevel: 2,
      fatigueLevel: 1,
      isolationLevel: 0,
      concentrationLevel: 8,
      motivationLevel: 9,
      sleepQuality: 7,
    }, astronautCookie);
    assert.equal(behavioralCheckin.status, 201);
    const behavioralRow = await sqlite.queryAll(
      `SELECT isolation_level, concentration_level, motivation_level, sleep_quality
       FROM health_measurements WHERE id = ?`,
      [(await behavioralCheckin.json()).id]
    );
    assert.deepEqual(behavioralRow, [{
      isolation_level: 0,
      concentration_level: 8,
      motivation_level: 9,
      sleep_quality: 7,
    }]);

    const invalidBehavioralCheckin = await jsonPost('/astronauts/astro-01/checkin', {
      sleepHours: 7.5,
      stressLevel: 2,
      fatigueLevel: 1,
      sleepQuality: 11,
    }, astronautCookie);
    assert.equal(invalidBehavioralCheckin.status, 400);

    const firstExerciseWrite = await jsonPost('/astronauts/astro-01/exercises', {
      activityType: 'Teste caminhada',
      durationMinutes: 30,
      intensity: 'moderate',
      fatigueAfter: 3,
    }, astronautCookie);
    assert.equal(firstExerciseWrite.status, 201);
    const secondExerciseWrite = await jsonPost('/astronauts/astro-01/exercises', {
      activityType: 'Teste bicicleta',
      durationMinutes: 45,
      intensity: 'high',
    }, astronautCookie);
    assert.equal(secondExerciseWrite.status, 201);
    const exerciseSummary = await request('/astronauts/astro-01/exercises/summary?days=7', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(exerciseSummary.status, 200);
    assert.deepEqual(await exerciseSummary.json(), {
      days: 7,
      sessions: 2,
      totalMinutes: 75,
      averageDurationMinutes: 37.5,
      activeDays: 1,
    });
    const firstHistoryPage = await request('/astronauts/astro-01/history?page=1&pageSize=2', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(firstHistoryPage.status, 200);
    const firstHistoryPageBody = await firstHistoryPage.json();
    assert.equal(firstHistoryPageBody.page, 1);
    assert.equal(firstHistoryPageBody.pageSize, 2);
    assert.equal(firstHistoryPageBody.items.length, 2);
    assert.ok(
      Date.parse(firstHistoryPageBody.items[0].occurredAt) >=
      Date.parse(firstHistoryPageBody.items[1].occurredAt)
    );
    assert.ok(firstHistoryPageBody.totalPages > 1);
    const secondHistoryPage = await request('/astronauts/astro-01/history?page=2&pageSize=2', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(secondHistoryPage.status, 200);
    const secondHistoryPageBody = await secondHistoryPage.json();
    assert.equal(secondHistoryPageBody.items.length, 2);
    assert.ok(
      !firstHistoryPageBody.items.some((first) =>
        secondHistoryPageBody.items.some((second) => first.kind === second.kind && first.id === second.id)
      )
    );

    const fullHistory = await request('/astronauts/astro-01/history?page=1&pageSize=100', {
      headers: { Cookie: astronautCookie },
    });
    const fullHistoryBody = await fullHistory.json();
    assert.equal(fullHistoryBody.total, fullHistoryBody.items.length);
    assert.deepEqual(
      [...new Set(fullHistoryBody.items.map((item) => item.kind))].sort(),
      ['alert', 'exercise', 'measurement', 'symptom']
    );
    assert.ok(fullHistoryBody.items.some((item) => item.description?.includes('Isolamento: 0')));
    const invalidHistoryPage = await request('/astronauts/astro-01/history?page=0', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(invalidHistoryPage.status, 400);
    const oversizedHistoryPage = await request('/astronauts/astro-01/history?pageSize=101', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(oversizedHistoryPage.status, 400);
    const crossAccountHistory = await request('/astronauts/astro-02/history', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(crossAccountHistory.status, 403);

    const invalidExerciseSummary = await request('/astronauts/astro-01/exercises/summary?days=14', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(invalidExerciseSummary.status, 400);
    const crossAccountExerciseSummary = await request('/astronauts/astro-02/exercises/summary?days=7', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(crossAccountExerciseSummary.status, 403);

    const missingIdempotencyKey = await request('/astronauts/astro-01/symptoms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: astronautCookie,
      },
      body: JSON.stringify({ title: 'Sem chave', severity: 'mild' }),
    });
    assert.equal(missingIdempotencyKey.status, 400);

    const crossAccountRead = await request('/astronauts/astro-02/summary', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(crossAccountRead.status, 403);

    const crossAccountWrite = await jsonPost('/astronauts/astro-02/symptoms', {
      title: 'Should be rejected',
      severity: 'mild',
    }, astronautCookie);
    assert.equal(crossAccountWrite.status, 403);

    const controlLogin = await jsonPost('/auth/login', {
      email: 'control@example.test',
      password: 'correct-horse-battery-02',
    });
    assert.equal(controlLogin.status, 200);
    const controlCookie = controlLogin.headers.get('set-cookie').split(';')[0];

    const crewList = await request('/astronauts', {
      headers: { Cookie: controlCookie },
    });
    assert.equal((await crewList.json()).length, 2);

    const controlRead = await request('/astronauts/astro-02/summary', {
      headers: { Cookie: controlCookie },
    });
    assert.equal(controlRead.status, 200);

    const controlHistory = await request('/astronauts/astro-02/history?page=1&pageSize=5', {
      headers: { Cookie: controlCookie },
    });
    assert.equal(controlHistory.status, 200);
    assert.equal((await controlHistory.json()).items.length, 1);

    const controlExerciseSummary = await request('/astronauts/astro-02/exercises/summary?days=7', {
      headers: { Cookie: controlCookie },
    });
    assert.equal(controlExerciseSummary.status, 200);
    assert.deepEqual(await controlExerciseSummary.json(), {
      days: 7,
      sessions: 0,
      totalMinutes: 0,
      averageDurationMinutes: null,
      activeDays: 0,
    });

    const controlWrite = await jsonPost('/astronauts/astro-01/checkin', {
      sleepHours: 8,
      stressLevel: 1,
      fatigueLevel: 1,
    }, controlCookie);
    assert.equal(controlWrite.status, 403);

    const logout = await jsonPost('/auth/logout', {}, astronautCookie);
    assert.equal(logout.status, 204);
    const revokedSession = await request('/astronauts', {
      headers: { Cookie: astronautCookie },
    });
    assert.equal(revokedSession.status, 401);
  } finally {
    if (server?.listening) {
      server.close();
      await once(server, 'close');
    }

    await new Promise((resolve, reject) => {
      database.getDb().close((error) => error ? reject(error) : resolve());
    });
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
