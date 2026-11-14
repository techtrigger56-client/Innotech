import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'ahms-migration-test-'));
process.env.AHMS_DATABASE_PATH = path.join(temporaryDirectory, 'test.db');

const [database, sqlite] = await Promise.all([
  import('../src/db.js'),
  import('../src/lib/sqlite.js'),
]);

test('adds behavioral and symptom-category columns without losing existing rows', async () => {
  try {
    await sqlite.execute(`CREATE TABLE health_measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      heart_rate REAL,
      oxygen_saturation REAL,
      respiratory_rate REAL,
      sleep_hours REAL,
      stress_level REAL,
      fatigue_level REAL,
      mood TEXT
    )`);
    await sqlite.execute(`CREATE TABLE symptoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      astronaut_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT DEFAULT 'moderate'
    )`);
    await sqlite.execute(
      'INSERT INTO health_measurements (astronaut_id, timestamp, sleep_hours) VALUES (?, ?, ?)',
      ['astro-legacy', '2025-01-01T00:00:00.000Z', 7]
    );
    await sqlite.execute(
      'INSERT INTO symptoms (astronaut_id, timestamp, title) VALUES (?, ?, ?)',
      ['astro-legacy', '2025-01-01T00:00:00.000Z', 'Sintoma anterior']
    );

    await database.initializeDatabase();

    const measurementColumns = await sqlite.queryAll('PRAGMA table_info(health_measurements)');
    const symptomColumns = await sqlite.queryAll('PRAGMA table_info(symptoms)');
    assert.ok(measurementColumns.some((column) => column.name === 'isolation_level'));
    assert.ok(measurementColumns.some((column) => column.name === 'concentration_level'));
    assert.ok(measurementColumns.some((column) => column.name === 'motivation_level'));
    assert.ok(measurementColumns.some((column) => column.name === 'sleep_quality'));
    assert.ok(symptomColumns.some((column) => column.name === 'category'));

    await database.initializeDatabase();

    const seededMeasurements = await sqlite.queryAll(
      "SELECT id FROM health_measurements WHERE astronaut_id = 'astro-01'"
    );
    const seededSymptoms = await sqlite.queryAll(
      "SELECT id FROM symptoms WHERE astronaut_id = 'astro-01'"
    );
    const seededAlerts = await sqlite.queryAll(
      "SELECT id FROM alerts WHERE astronaut_id = 'astro-01'"
    );
    assert.equal(seededMeasurements.length, 5);
    assert.equal(seededSymptoms.length, 2);
    assert.equal(seededAlerts.length, 2);

    const preservedMeasurement = await sqlite.queryAll(
      'SELECT sleep_hours, isolation_level FROM health_measurements WHERE astronaut_id = ?',
      ['astro-legacy']
    );
    const preservedSymptom = await sqlite.queryAll(
      'SELECT title, category FROM symptoms WHERE astronaut_id = ?',
      ['astro-legacy']
    );
    assert.deepEqual(preservedMeasurement, [{ sleep_hours: 7, isolation_level: null }]);
    assert.deepEqual(preservedSymptom, [{ title: 'Sintoma anterior', category: 'other' }]);
  } finally {
    await new Promise((resolve, reject) => {
      database.getDb().close((error) => error ? reject(error) : resolve());
    });
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
