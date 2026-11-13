import styles from './AlertBadge.module.css';

export default function AlertBadge({ level }) {
  const config = {
    Normal: {
      label: 'Normal',
      class: styles.normal,
      icon: '●',
    },
    Atenção: {
      label: 'Atenção',
      class: styles.atencao,
      icon: '▲',
    },
    Prioridade: {
      label: 'Prioridade',
      class: styles.prioridade,
      icon: '■',
    },
    'Não avaliado': {
      label: 'Não avaliado',
      class: styles.unassessed,
      icon: '—',
    },
    Indisponível: {
      label: 'Indisponível',
      class: styles.unassessed,
      icon: '!',
    },
  };

  const c = config[level] || config.Indisponível;

  return (
    <span className={c.class} aria-label={`Estado: ${c.label}`}>
      <span className={styles.icon} aria-hidden="true">{c.icon}</span>
      <span>{c.label}</span>
    </span>
  );
}
