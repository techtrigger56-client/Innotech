import styles from './Navbar.module.css';

export default function Navbar({ role, onLogout }) {
  const isMissionControl = role === 'mission-control';

  return (
    <nav className={styles.navbar} aria-label="Navegação principal">
      <div className={styles.brand} aria-label="AHMS">
        <span className={styles.brandMark} aria-hidden="true">A</span>
        <span className={styles.brandText}>
          <span className={styles.brandName}>Astronaut Health Monitoring System</span>
          <span className={styles.brandSubtitle}>AHMS <span aria-hidden="true">/</span> Startup Innotech</span>
        </span>
      </div>
      <div className={styles.navEnd}>
        <div className={styles.links}>
          {isMissionControl ? (
            <span className={`${styles.navLink} ${styles.active}`} aria-current="page">
              Mission Control · Equipa em Terra
            </span>
          ) : (
            <span className={`${styles.navLink} ${styles.active}`} aria-current="page">
              Painel do astronauta
            </span>
          )}
        </div>
        <button type="button" className={styles.logout} onClick={onLogout}>
          Sair da conta
        </button>
      </div>
    </nav>
  );
}
