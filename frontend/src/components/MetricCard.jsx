import styles from './MetricCard.module.css';

export default function MetricCard({ label, value, unit, trend, status }) {
  const trendDir = trend !== undefined && (trend >= 0 ? 'up' : 'down');
  const statusClass = status ? styles[status.toLowerCase().replace('ã', 'a').replace('ção', 'cao')] : null;

  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {trend !== undefined && (
        <div className={`${styles.trend} ${styles[trendDir]}`} aria-hidden="true">
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}
        </div>
      )}
      {status && statusClass && <span className={statusClass} aria-hidden="true">{status}</span>}
    </div>
  );
}
