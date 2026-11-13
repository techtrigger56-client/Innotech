import { queryAll } from '../../lib/sqlite.js';
import { analyzeMeasurements } from '../alerts/alerts.service.js';
import { getIndividualBaseline } from '../baseline/baseline.service.js';

export async function getHealthSummary(astronautId) {
  const baseline = await getIndividualBaseline(astronautId);
  const rows = await queryAll(
    `SELECT *
     FROM health_measurements
     WHERE astronaut_id = ?
     ORDER BY timestamp DESC, id DESC
     LIMIT 90`,
    [astronautId]
  );

  if (!rows.length) {
    return {
      astronautId,
      latest: null,
      baseline,
      alert: analyzeMeasurements(rows, baseline),
      trend: [],
    };
  }

  const latest = rows[0];
  const toHours = (value) => typeof value === 'number' ? Number(value.toFixed(1)) : null;

  return {
    astronautId,
    latest: {
      timestamp: latest.timestamp,
      heartRate: latest.heart_rate,
      oxygenSaturation: latest.oxygen_saturation,
      respiratoryRate: latest.respiratory_rate,
      sleepHours: toHours(latest.sleep_hours),
      stressLevel: latest.stress_level,
      fatigueLevel: latest.fatigue_level,
      isolationLevel: latest.isolation_level,
      concentrationLevel: latest.concentration_level,
      motivationLevel: latest.motivation_level,
      sleepQuality: latest.sleep_quality,
      mood: latest.mood
    },
    baseline,
    alert: analyzeMeasurements(rows, baseline),
    trend: rows.slice().reverse().map((item) => ({
      date: item.timestamp,
      oxygenSaturation: item.oxygen_saturation,
      respiratoryRate: item.respiratory_rate,
      sleepHours: toHours(item.sleep_hours),
      heartRate: item.heart_rate,
      stressLevel: item.stress_level,
      fatigueLevel: item.fatigue_level,
      isolationLevel: item.isolation_level,
      concentrationLevel: item.concentration_level,
      motivationLevel: item.motivation_level,
      sleepQuality: item.sleep_quality,
      mood: item.mood,
    }))
  };
}
