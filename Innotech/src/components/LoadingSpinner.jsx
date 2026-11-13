import styles from './LoadingSpinner.module.css';

export default function LoadingSpinner({ message = 'A carregar...' }) {
  return (
    <div className={styles.spinnerContainer} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true"></div>
      <p className={styles.text}>{message}</p>
    </div>
  );
}
