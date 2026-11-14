import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'ahms-baseline-test-'));
process.env.AHMS_DATABASE_PATH = path.join(temporaryDirectory, 'test.db');

const [database, sqlite, summaries] = await Promise.all([
  import('../src/db.js'),
  import('../src/lib/sqlite.js'),
  import('../src/features/measurements/measurements.service.js'),
]);
const { analyzeMeasurements } = await import('../src/features/alerts/alerts.service.js');
const { analyzeCachedMeasurements } = await import('../../frontend/shared/health-analysis.js');

test('establishes a fixed median baseline and flags only sustained post-baseline changes', async () => {
  try {
    await database.initializeDatabase();
    await sqlite.queryAll('SELECT id FROM astronauts LIMIT 1');

    const initial = await summaries.getHealthSummary('astro-01');
    assert.equal(initial.baseline.status, 'ready');
    assert.equal(initial.baseline.minimumSamples, 5);
    assert.equal(initial.baseline.metrics.heartRate.value, 69);
    assert.equal(initial.baseline.metrics.sleepHours.value, 6.7);
    assert.equal(initial.alert.level, 'Não avaliado');

    const stablePostBaselineRows = [
      '2026-11-13T08:00:00.000Z',
      '2026-11-12T08:00:00.000Z',
      '2026-11-11T08:00:00.000Z',
    ].map((timestamp) => ({
      timestamp,
      heart_rate: 69,
      oxygen_saturation: 98,
      respiratory_rate: 16,
      sleep_hours: 6.7,
      stress_level: 4,
      fatigue_level: 3,
    }));
    const stableResult = analyzeMeasurements(stablePostBaselineRows, initial.baseline);
    assert.equal(stableResult.level, 'Não avaliado');
    assert.equal(stableResult.signals.length, 0);

    const localResult = analyzeCachedMeasurements([
      { date: '2026-11-11T08:00:00.000Z', heartRate: 80 },
      { date: '2026-11-12T08:00:00.000Z', heartRate: 81 },
    ], [{
      createdAt: '2026-11-13T08:00:00.000Z',
      payload: { heartRate: 82 },
    }], initial.baseline);
    assert.equal(localResult.level, 'Atenção');
    assert.equal(localResult.signals[0].metric, 'heartRate');
    assert.equal(localResult.signals[0].latestValue, 82);
    assert.match(localResult.description, /não um limiar clínico/);

    const incomplete = await summaries.getHealthSummary('astro-02');
    assert.equal(incomplete.baseline.status, 'collecting');
    assert.equal(incomplete.baseline.metrics.heartRate.sampleCount, 1);
    assert.equal(incomplete.alert.level, 'Não avaliado');
    assert.match(incomplete.alert.description, /5 registos válidos/);

    const dates = [
      '2026-11-11T08:00:00.000Z',
      '2026-11-12T08:00:00.000Z',
      '2026-11-13T08:00:00.000Z',
    ];
    for (const [index, timestamp] of dates.entries()) {
      await sqlite.execute(
        `INSERT INTO health_measurements (
          astronaut_id, timestamp, heart_rate, oxygen_saturation,
          respiratory_rate, sleep_hours, stress_level, fatigue_level, mood
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['astro-01', timestamp, 80 + index, 98, 16, 6.7, 4, 3, 'Normal']
      );

      const current = await summaries.getHealthSummary('astro-01');
      if (index < 2) {
        assert.equal(current.alert.level, 'Não avaliado');
      } else {
        assert.equal(current.alert.level, 'Atenção');
        assert.deepEqual(current.alert.signals.map((signal) => signal.metric), ['heartRate']);
        assert.equal(current.alert.signals[0].baselineValue, 69);
        assert.equal(current.alert.signals[0].latestValue, 82);
        assert.match(current.alert.description, /não um limiar clínico/);
        assert.equal(current.alert.recommendations.length, 1);
      }

      assert.equal(current.baseline.metrics.heartRate.value, 69);
    }

    await sqlite.execute(
      `INSERT INTO health_measurements (
        astronaut_id, timestamp, heart_rate, oxygen_saturation,
        respiratory_rate, sleep_hours, stress_level, fatigue_level, mood
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['astro-01', '2026-11-14T08:00:00.000Z', 85, 99, 17, 7.5, 6, 5, 'Razoável']
    );
    await sqlite.execute(
      `INSERT INTO health_measurements (
        astronaut_id, timestamp, heart_rate, oxygen_saturation,
        respiratory_rate, sleep_hours, stress_level, fatigue_level, mood
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['astro-01', '2026-11-15T08:00:00.000Z', 86, 99, 17, 7.5, 6, 5, 'Razoável']
    );
    await sqlite.execute(
      `INSERT INTO health_measurements (
        astronaut_id, timestamp, heart_rate, oxygen_saturation,
        respiratory_rate, sleep_hours, stress_level, fatigue_level, mood
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['astro-01', '2026-11-16T08:00:00.000Z', 87, 99, 17, 7.5, 6, 5, 'Razoável']
    );

    const multipleSignals = await summaries.getHealthSummary('astro-01');
    assert.equal(multipleSignals.alert.level, 'Prioridade');
    assert.ok(multipleSignals.alert.signals.some((signal) => signal.metric === 'heartRate'));
    assert.ok(multipleSignals.alert.signals.some((signal) => signal.metric === 'stressLevel'));
  } finally {
    await new Promise((resolve, reject) => {
      database.getDb().close((error) => error ? reject(error) : resolve());
    });
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
