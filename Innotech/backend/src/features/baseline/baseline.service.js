import { execute, queryAll } from '../../lib/sqlite.js';
import {
  BASELINE_METRICS,
  MINIMUM_BASELINE_SAMPLES,
} from '../../../../shared/health-analysis.js';

export { BASELINE_METRICS, MINIMUM_BASELINE_SAMPLES };

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function getIndividualBaseline(astronautId) {
  const observedCounts = {};
  for (const [metric, { column }] of Object.entries(BASELINE_METRICS)) {
    const stored = await queryAll(
      `SELECT baseline_value AS value, sample_count AS sampleCount, based_on_until AS basedOnUntil
       FROM individual_baselines
       WHERE astronaut_id = ? AND metric = ?
       LIMIT 1`,
      [astronautId, metric]
    );
    if (stored.length) {
      observedCounts[metric] = stored[0].sampleCount;
      continue;
    }

    const observations = await queryAll(
      `SELECT timestamp, ${column} AS value
       FROM health_measurements
       WHERE astronaut_id = ? AND ${column} IS NOT NULL
       ORDER BY timestamp ASC, id ASC
       LIMIT ?`,
      [astronautId, MINIMUM_BASELINE_SAMPLES]
    );
    const validObservations = observations.filter((item) =>
      Number.isFinite(Number(item.value)) && item.timestamp
    );
    observedCounts[metric] = validObservations.length;

    if (validObservations.length < MINIMUM_BASELINE_SAMPLES) continue;

    await execute(
      `INSERT OR IGNORE INTO individual_baselines (
        astronaut_id, metric, baseline_value, sample_count, based_on_until
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        astronautId,
        metric,
        median(validObservations.map((item) => Number(item.value))),
        validObservations.length,
        validObservations[validObservations.length - 1].timestamp,
      ]
    );
  }

  const rows = await queryAll(
    `SELECT metric, baseline_value AS value, sample_count AS sampleCount,
            based_on_until AS basedOnUntil
     FROM individual_baselines
     WHERE astronaut_id = ?`,
    [astronautId]
  );
  const storedMetrics = Object.fromEntries(rows.map((row) => [row.metric, {
    value: Number(row.value),
    sampleCount: row.sampleCount,
    basedOnUntil: row.basedOnUntil,
  }]));
  const metrics = Object.fromEntries(
    Object.keys(BASELINE_METRICS).map((metric) => [
      metric,
      storedMetrics[metric] || {
        value: null,
        sampleCount: observedCounts[metric] || 0,
        basedOnUntil: null,
      },
    ])
  );
  const readyCount = Object.values(metrics).filter((item) => item.sampleCount >= MINIMUM_BASELINE_SAMPLES).length;
  const complete = readyCount === Object.keys(BASELINE_METRICS).length;

  return {
    status: complete ? 'ready' : 'collecting',
    minimumSamples: MINIMUM_BASELINE_SAMPLES,
    readyMetrics: readyCount,
    totalMetrics: Object.keys(BASELINE_METRICS).length,
    metrics,
  };
}
