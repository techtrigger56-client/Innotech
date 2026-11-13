import LoadingSpinner from './LoadingSpinner.jsx';
import styles from './AstronautSelector.module.css';

export default function AstronautSelector({ astronauts, selectedId, onSelect, loading }) {
  if (loading) {
    return <LoadingSpinner message="A carregar lista de astronautas…" />;
  }

  if (!astronauts || astronauts.length === 0) {
    return <div className={styles.selector}><p>Nenhum astronauta encontrado.</p></div>;
  }

  return (
    <div className={styles.selector}>
      <label htmlFor="astronaut-select" className={styles.label}>
        Selecionar astronauta
      </label>
      <select
        id="astronaut-select"
        className={styles.select}
        value={selectedId || ''}
        onChange={(e) => onSelect(e.target.value)}
        aria-label="Selecionar astronauta"
      >
        <option value="">— Escolha um astronauta —</option>
        {astronauts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.mission})
          </option>
        ))}
      </select>
    </div>
  );
}
