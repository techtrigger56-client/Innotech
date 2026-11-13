import styles from './TrendChart.module.css';

const METRICS = {
  sleepHours: { label: 'Horas de sono', unit: 'h', precision: 1 },
  heartRate: { label: 'Frequência cardíaca', unit: 'bpm', precision: 0 },
  stressLevel: { label: 'Nível de stress', unit: '/10', precision: 1 },
  fatigueLevel: { label: 'Nível de fadiga', unit: '/10', precision: 1 },
  isolationLevel: { label: 'Sensação de isolamento', unit: '/10', precision: 1 },
  concentrationLevel: { label: 'Qualidade da concentração', unit: '/10', precision: 1 },
  motivationLevel: { label: 'Motivação', unit: '/10', precision: 1 },
  sleepQuality: { label: 'Qualidade do sono', unit: '/10', precision: 1 },
};

function formatValue(value, precision) {
  return Number(value).toLocaleString('pt-PT', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

function formatDate(value, options) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : date.toLocaleDateString('pt-PT', options);
}

export default function TrendChart({ data, metric }) {
  const metricInfo = METRICS[metric] || { label: metric, unit: '', precision: 1 };
  const points = (data || [])
    .filter((entry) =>
      entry[metric] !== null &&
      entry[metric] !== undefined &&
      entry[metric] !== '' &&
      Number.isFinite(Number(entry[metric])) &&
      entry.date
    )
    .slice()
    .sort((left, right) => new Date(left.date) - new Date(right.date));

  if (!points.length) {
    return (
      <section className={styles.card} aria-label={`Histórico de ${metricInfo.label}`}>
        <div className={styles.heading}>
          <h3>{metricInfo.label}</h3>
          <span className={styles.unit}>{metricInfo.unit || 'valor'}</span>
        </div>
        <div className={styles.emptyState} role="status">
          Ainda não há registos deste indicador para desenhar o gráfico.
        </div>
      </section>
    );
  }

  const values = points.map((point) => Number(point[metric]));
  const observedMin = Math.min(...values);
  const observedMax = Math.max(...values);
  const observedRange = observedMax - observedMin;
  const padding = observedRange === 0 ? Math.max(Math.abs(observedMax) * 0.08, 1) : observedRange * 0.18;
  const axisMin = observedMin - padding;
  const axisMax = observedMax + padding;

  const viewWidth = 720;
  const viewHeight = 250;
  const plot = { left: 58, right: 12, top: 16, bottom: 38 };
  const plotWidth = viewWidth - plot.left - plot.right;
  const plotHeight = viewHeight - plot.top - plot.bottom;
  const x = (index) => plot.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value) => plot.top + ((axisMax - value) / (axisMax - axisMin)) * plotHeight;
  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(2)} ${y(Number(point[metric])).toFixed(2)}`)
    .join(' ');

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount }, (_, index) => {
    const value = axisMax - ((axisMax - axisMin) * index) / (tickCount - 1);
    return { value, y: y(value) };
  });
  const dateLabelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const first = Number(points[0][metric]);
  const latest = Number(points[points.length - 1][metric]);
  const change = latest - first;
  const changeText = change === 0
    ? 'Sem variação entre o primeiro e o último registo'
    : `${change > 0 ? 'Subiu' : 'Desceu'} ${formatValue(Math.abs(change), metricInfo.precision)} ${metricInfo.unit} desde o primeiro registo`;
  const periodStart = formatDate(points[0].date, { day: '2-digit', month: 'short' });
  const periodEnd = formatDate(points[points.length - 1].date, { day: '2-digit', month: 'short' });
  const accessibleSummary = `${metricInfo.label}. ${points.length} registos entre ${periodStart} e ${periodEnd}. Primeiro valor ${formatValue(first, metricInfo.precision)} ${metricInfo.unit}; último valor ${formatValue(latest, metricInfo.precision)} ${metricInfo.unit}. ${changeText}.`;

  return (
    <section className={styles.card} aria-label={`Gráfico de ${metricInfo.label}`}>
      <div className={styles.heading}>
        <div>
          <h3>{metricInfo.label}</h3>
          <p>Registos disponíveis no período</p>
        </div>
        <span className={styles.unit}>{metricInfo.unit || 'valor'}</span>
      </div>

      <div className={styles.currentValue}>
        <strong>{formatValue(latest, metricInfo.precision)}</strong>
        <span>{metricInfo.unit}</span>
        <span className={styles.recordCount}>{points.length} {points.length === 1 ? 'registo' : 'registos'}</span>
      </div>

      <p className={styles.scaleNote}>
        A escala vertical adapta-se aos valores observados; não representa limites clínicos.
      </p>

      <svg
        className={styles.chart}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label={accessibleSummary}
      >
        {yTicks.map((tick) => (
          <g key={tick.value}>
            <line
              x1={plot.left}
              x2={viewWidth - plot.right}
              y1={tick.y}
              y2={tick.y}
              className={styles.gridLine}
            />
            <text x={plot.left - 10} y={tick.y + 4} textAnchor="end" className={styles.axisLabel}>
              {formatValue(tick.value, metricInfo.precision)}
            </text>
          </g>
        ))}

        <path d={linePath} className={styles.line} />

        {points.map((point, index) => (
          <g key={`${point.date}-${index}`}>
            <circle
              cx={x(index)}
              cy={y(Number(point[metric]))}
              r={index === points.length - 1 ? 7 : 4.5}
              className={index === points.length - 1 ? styles.latestPoint : styles.point}
            />
            <title>
              {formatDate(point.date, { day: '2-digit', month: 'long', year: 'numeric' })}: {formatValue(Number(point[metric]), metricInfo.precision)} {metricInfo.unit}
            </title>
          </g>
        ))}

        {dateLabelIndexes.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={viewHeight - 8}
            textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
            className={styles.axisLabel}
          >
            {formatDate(points[index].date, { day: '2-digit', month: 'short' })}
          </text>
        ))}
      </svg>

      <div className={styles.summary} aria-live="polite">
        <span className={`${styles.changeMark} ${change > 0 ? styles.increased : change < 0 ? styles.decreased : ''}`} aria-hidden="true">
          {change > 0 ? '↗' : change < 0 ? '↘' : '→'}
        </span>
        <p>{changeText}</p>
      </div>

      <p className={styles.disclaimer}>
        Histórico registado; comparação com baseline individual ainda não disponível.
      </p>
    </section>
  );
}
