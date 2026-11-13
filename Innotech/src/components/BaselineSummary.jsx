import styles from './BaselineSummary.module.css';

const METRICS = {
  heartRate: { label: 'Frequência cardíaca', unit: 'bpm', precision: 0 },
  oxygenSaturation: { label: 'Saturação de oxigénio', unit: '%', precision: 0 },
  respiratoryRate: { label: 'Frequência respiratória', unit: '/min', precision: 0 },
  sleepHours: { label: 'Sono', unit: 'h', precision: 1 },
  stressLevel: { label: 'Stress', unit: '/10', precision: 1 },
  fatigueLevel: { label: 'Fadiga', unit: '/10', precision: 1 },
};

function formatValue(value, precision) {
  return Number(value).toLocaleString('pt-PT', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

function formatDate(value) {
  if (!value) return 'data indisponível';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'data indisponível'
    : date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BaselineSummary({ baseline }) {
  if (!baseline) {
    return (
      <section className={styles.card} aria-label="Baseline individual">
        <h3>Referência individual</h3>
        <p>Não foi possível carregar o estado da baseline.</p>
      </section>
    );
  }

  const ready = baseline.status === 'ready';

  return (
    <section className={styles.card} aria-label="Baseline individual">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>REFERÊNCIA INDIVIDUAL</span>
          <h3>{ready ? 'Baseline estabelecida' : 'Baseline em recolha'}</h3>
        </div>
        <span className={`${styles.status} ${ready ? styles.ready : ''}`}>
          {baseline.readyMetrics}/{baseline.totalMetrics} indicadores
        </span>
      </div>

      <p className={styles.description}>
        Mediana dos primeiros {baseline.minimumSamples} registos válidos de cada indicador.
        A referência é fixa após calculada e não representa um limite clínico.
      </p>

      <dl className={styles.metrics}>
        {Object.entries(METRICS).map(([key, info]) => {
          const item = baseline.metrics?.[key];
          const metricReady = item?.sampleCount >= baseline.minimumSamples;
          return (
            <div className={styles.metric} key={key}>
              <dt>{info.label}</dt>
              <dd>
                {metricReady ? `${formatValue(item.value, info.precision)} ${info.unit}` : 'A recolher'}
              </dd>
              <span>
                {metricReady
                  ? `Base: ${formatDate(item.basedOnUntil)}`
                  : `${item?.sampleCount || 0}/${baseline.minimumSamples} registos`}
              </span>
            </div>
          );
        })}
      </dl>

      <p className={styles.disclaimer}>
        Regra demonstrativa. Não utilizar para decisões clínicas; requer validação profissional.
      </p>
    </section>
  );
}
