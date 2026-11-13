export const MINIMUM_BASELINE_SAMPLES = 5;

export const BASELINE_METRICS = {
  heartRate: { column: 'heart_rate', label: 'Frequência cardíaca', unit: 'bpm' },
  oxygenSaturation: { column: 'oxygen_saturation', label: 'Saturação de oxigénio', unit: '%' },
  respiratoryRate: { column: 'respiratory_rate', label: 'Frequência respiratória', unit: '/min' },
  sleepHours: { column: 'sleep_hours', label: 'Horas de sono', unit: 'h' },
  stressLevel: { column: 'stress_level', label: 'Stress', unit: '/10' },
  fatigueLevel: { column: 'fatigue_level', label: 'Fadiga', unit: '/10' },
};

const REQUIRED_CONSECUTIVE_READINGS = 3;

function getNumericValue(row, column) {
  const value = row[column];
  return value !== null && value !== undefined && Number.isFinite(Number(value))
    ? Number(value)
    : null;
}

export function analyzeMeasurements(rows, baseline) {
  if (!rows.length) {
    return {
      level: 'Não avaliado',
      title: 'Sem medições para análise',
      description: 'Ainda não existem medições. O sistema não consegue comparar tendências.',
      signals: [],
      recommendations: [],
    };
  }

  if (!baseline || baseline.status !== 'ready') {
    return {
      level: 'Não avaliado',
      title: 'Baseline individual em recolha',
      description: `São necessários pelo menos ${MINIMUM_BASELINE_SAMPLES} registos válidos por indicador para criar a referência demonstrativa. Nenhuma conclusão está disponível.`,
      signals: [],
      recommendations: [],
    };
  }

  const signals = [];
  let evaluatedMetrics = 0;

  for (const [metric, definition] of Object.entries(BASELINE_METRICS)) {
    const reference = baseline.metrics[metric];
    if (!reference || reference.sampleCount < MINIMUM_BASELINE_SAMPLES) continue;

    const postBaselineValues = rows
      .filter((row) => row.timestamp > reference.basedOnUntil)
      .map((row) => ({ timestamp: row.timestamp, value: getNumericValue(row, definition.column) }))
      .filter((row) => row.value !== null)
      .slice(0, REQUIRED_CONSECUTIVE_READINGS);

    if (postBaselineValues.length < REQUIRED_CONSECUTIVE_READINGS) continue;
    evaluatedMetrics += 1;

    const direction = postBaselineValues.every((row) => row.value > reference.value)
      ? 'acima'
      : postBaselineValues.every((row) => row.value < reference.value)
        ? 'abaixo'
        : null;

    if (direction) {
      signals.push({
        metric,
        label: definition.label,
        unit: definition.unit,
        direction,
        baselineValue: reference.value,
        latestValue: postBaselineValues[0].value,
        consecutiveReadings: REQUIRED_CONSECUTIVE_READINGS,
      });
    }
  }

  if (evaluatedMetrics === 0) {
    return {
      level: 'Não avaliado',
      title: 'A recolher registos posteriores à baseline',
      description: `A regra demonstrativa necessita de ${REQUIRED_CONSECUTIVE_READINGS} registos posteriores à referência para cada indicador avaliado. Isto não é uma avaliação clínica.`,
      signals: [],
      recommendations: [],
    };
  }

  if (!signals.length) {
    return {
      level: 'Não avaliado',
      title: 'Sem variação persistente sinalizada',
      description: `Os últimos ${REQUIRED_CONSECUTIVE_READINGS} registos não ficaram todos do mesmo lado da baseline nos indicadores avaliados. Isto não significa ausência de risco.`,
      signals: [],
      recommendations: [],
    };
  }

  const multipleSignals = signals.length > 1;
  return {
    level: multipleSignals ? 'Prioridade' : 'Atenção',
    title: multipleSignals
      ? 'Variações persistentes em vários indicadores'
      : 'Variação persistente num indicador',
    description: `${signals.length} indicador(es) apresentaram os últimos ${REQUIRED_CONSECUTIVE_READINGS} registos do mesmo lado da baseline individual. É uma sinalização demonstrativa, não um limiar clínico nem um diagnóstico.`,
    signals,
    recommendations: [
      'Reveja os registos e siga o protocolo da missão; esta sinalização não substitui avaliação profissional.',
    ],
  };
}

export function analyzeCachedMeasurements(trend, queuedMeasurements, baseline) {
  const toAnalysisRow = (source, timestamp) => {
    const row = { timestamp };
    for (const [metric, definition] of Object.entries(BASELINE_METRICS)) {
      row[definition.column] = source[metric] ?? null;
    }
    return row;
  };
  const rows = [
    ...trend.map((point) => toAnalysisRow(point, point.date)),
    ...queuedMeasurements.map(({ createdAt, payload }) => toAnalysisRow(payload, createdAt)),
  ].sort((left, right) => right.timestamp.localeCompare(left.timestamp));

  return analyzeMeasurements(rows, baseline);
}
