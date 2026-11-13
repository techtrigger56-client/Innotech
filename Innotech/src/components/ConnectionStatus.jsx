import { useEffect, useState } from 'react';
import styles from './ConnectionStatus.module.css';
import { api } from '../lib/api.js';

export default function ConnectionStatus() {
  const [status, setStatus] = useState('checking');
  const [queue, setQueue] = useState([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [syncError, setSyncError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const refreshQueue = async () => {
      try {
        const items = await api.getOfflineQueue();
        if (!cancelled) {
          setQueue(items);
        }
      } catch (error) {
        if (!cancelled) {
          window.dispatchEvent(new CustomEvent('ahms:offline-error', { detail: error.message }));
        }
      }
    };

    const checkConnection = async () => {
      if (api.isOfflineOnly() || navigator.onLine === false) {
        if (!cancelled) setStatus('offline');
        await refreshQueue();
        return;
      }

      try {
        await api.health();
        if (!cancelled) setStatus('online');
      } catch {
        if (!cancelled) setStatus('offline');
      }
      await refreshQueue();
    };

    const handleOffline = () => {
      setStatus('offline');
      refreshQueue();
    };
    const handleSyncError = (event) => {
      setSyncError(typeof event.detail === 'string' ? event.detail : 'Falha ao sincronizar registos locais.');
    };
    const handleSynced = () => {
      setSyncError('');
      checkConnection();
    };
    const intervalId = window.setInterval(checkConnection, 30000);
    window.addEventListener('online', checkConnection);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ahms:offline-update', refreshQueue);
    window.addEventListener('ahms:offline-synced', handleSynced);
    window.addEventListener('ahms:offline-error', handleSyncError);
    checkConnection();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('online', checkConnection);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ahms:offline-update', refreshQueue);
      window.removeEventListener('ahms:offline-synced', handleSynced);
      window.removeEventListener('ahms:offline-error', handleSyncError);
    };
  }, []);

  const label = status === 'online'
    ? 'Ligado'
    : status === 'offline'
      ? 'Offline'
      : 'A verificar ligação';
  const queuedCount = queue.filter((item) => item.status === 'queued').length;
  const blockedCount = queue.filter((item) => item.status === 'blocked').length;

  const handleReconcile = async (operationId) => {
    setSyncError('');
    try {
      await api.reconcileOfflineQueueItem(operationId);
      await refreshCurrentQueue();
    } catch (error) {
      setSyncError(error.message || 'Não foi possível reconciliar a operação.');
    }
  };

  const handleRemove = async (operationId) => {
    const confirmed = window.confirm(
      'Remover apenas a cópia local deste registo bloqueado? Isto não altera dados que possam já ter chegado ao servidor. Verifique o histórico online antes de remover.'
    );
    if (!confirmed) return;
    try {
      await api.removeOfflineQueueItem(operationId);
      await refreshCurrentQueue();
    } catch (error) {
      setSyncError(error.message || 'Não foi possível remover a cópia local.');
    }
  };

  async function refreshCurrentQueue() {
    try {
      setQueue(await api.getOfflineQueue());
    } catch (error) {
      setSyncError(error.message || 'Não foi possível actualizar a fila offline.');
    }
  }

  const categoryLabels = {
    checkin: 'Check-in',
    exercise: 'Actividade física',
    measurement: 'Medições',
    symptom: 'Sintoma',
  };

  return (
    <div className={styles.statusWrap}>
      <div
        className={`${styles.connectionStatus} ${styles[status]}`}
        data-status={status}
        role="status"
        aria-live="polite"
      >
        <span className={styles.dot} aria-hidden="true"></span>
        <span className={styles.label}>{label}</span>
        {queue.length > 0 && (
          <button
            type="button"
            className={styles.queueToggle}
            aria-expanded={queueOpen}
            aria-controls="offline-queue-panel"
            onClick={() => setQueueOpen((open) => !open)}
          >
            {queuedCount > 0 && `${queuedCount} por sincronizar`}
            {queuedCount > 0 && blockedCount > 0 && ' · '}
            {blockedCount > 0 && `${blockedCount} requer revisão`}
            {queuedCount === 0 && blockedCount === 0 && 'Fila local'}
          </button>
        )}
        {syncError && (
          <span className={styles.queueStatus} title={syncError}>
            Sincronização com erro
          </span>
        )}
      </div>
      {queueOpen && queue.length > 0 && (
        <section className={styles.queuePanel} id="offline-queue-panel" aria-label="Fila offline">
          <div className={styles.queueHeading}>
            <h2>Sincronização offline</h2>
            <button type="button" onClick={() => setQueueOpen(false)} aria-label="Fechar fila offline">
              ×
            </button>
          </div>
          <p className={styles.queueExplanation}>
            Os registos pendentes permanecem cifrados neste dispositivo até serem confirmados pelo servidor.
          </p>
          <ul className={styles.queueList}>
            {queue.map((item) => (
              <li className={styles.queueItem} key={item.operationId}>
                <div className={styles.queueItemHeading}>
                  <strong>{categoryLabels[item.category] || 'Registo'}</strong>
                  <span>{item.status === 'blocked' ? 'Requer revisão' : 'Por sincronizar'}</span>
                </div>
                <time dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleString('pt-PT')}
                </time>
                {item.status === 'queued' ? (
                  <p>A aguardar uma sessão autenticada e uma ligação ao servidor.</p>
                ) : (
                  <>
                    <p>{item.error || 'O servidor não confirmou esta operação.'}</p>
                    <div className={styles.queueActions}>
                      {item.failureStatus === 409 && (
                        <button type="button" onClick={() => handleReconcile(item.operationId)}>
                          Tentar reconciliação segura
                        </button>
                      )}
                      <button type="button" onClick={() => handleRemove(item.operationId)}>
                        Remover cópia local…
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
