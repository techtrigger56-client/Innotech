import { useState } from 'react';
import { api } from '../lib/api.js';
import styles from './LoginPage.module.css';

export default function OfflineAccessPage({ mode, user, profiles = [], initialError = '', onContinue }) {
  const [selectedUserId, setSelectedUserId] = useState(profiles[0]?.userId || '');
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  const offlineProfile = profiles.find((profile) => String(profile.userId) === String(selectedUserId));
  const requiresSelection = mode === 'offline-unlock' && profiles.length > 1;
  const title = mode === 'offline-unlock'
    ? 'Desbloquear cofre offline'
    : mode === 'offline-setup'
      ? 'Activar acesso offline protegido'
      : 'Preparar acesso sem ligação';
  const description = mode === 'offline-unlock'
    ? 'Os dados deste dispositivo estão cifrados. Desbloqueie o cofre para os consultar localmente.'
    : 'Uma frase-passe independente protegerá localmente os dados em cache e os registos por sincronizar.';

  const handleUnlock = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'offline-setup') {
        if (passphrase !== confirmation) {
          throw new Error('As frases-passe não coincidem.');
        }
        await api.createOfflineVault(user, passphrase);
        onContinue(user);
      } else {
        const profile = await api.unlockOfflineVault(
          mode === 'online-unlock' ? user.id : Number(selectedUserId),
          passphrase
        );
        if (mode === 'online-unlock') {
          if (
            profile.email !== user.email ||
            profile.role !== user.role ||
            profile.astronautId !== user.astronautId
          ) {
            api.lockOfflineVault();
            throw new Error('Este cofre pertence a outra conta.');
          }
          onContinue(user);
        } else {
          onContinue({ ...profile, offline: true });
        }
      }
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível desbloquear o cofre.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.screen}>
      <section className={styles.hero} aria-labelledby="offline-title">
        <div className={styles.heroTopline}>
          <span className={styles.projectMark}>AHMS</span>
          <span className={styles.separator} aria-hidden="true" />
          <span>Innotech · acesso local protegido</span>
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>MODO OFFLINE / DADOS CIFRADOS</p>
          <h1 id="offline-title">A missão continua sem ligação.</h1>
          <p className={styles.lead}>
            A informação fica neste dispositivo cifrada. As credenciais do servidor não são guardadas
            no navegador; a sincronização exige uma sessão autenticada quando a ligação regressar.
          </p>
        </div>
        <div className={styles.heroFooter}>
          <span>ARMAZENAMENTO LOCAL CIFRADO</span>
          <span>SEM DIAGNÓSTICO MÉDICO</span>
        </div>
      </section>

      <section className={styles.accessPanel} aria-labelledby="access-title">
        <div className={styles.accessHeading}>
          <span className={styles.accessIndex}>02 / COFRE LOCAL</span>
          <span className={styles.secureLabel}>
            <span className={styles.liveDot} />
            {mode === 'offline-unlock' ? 'Ligação indisponível' : 'Frase-passe necessária'}
          </span>
        </div>

        <div className={styles.formIntro}>
          <p className={styles.eyebrow}>Acesso offline</p>
          <h2 id="access-title">{title}</h2>
          <p>{description}</p>
        </div>

        <form className={styles.form} onSubmit={handleUnlock}>
          {requiresSelection && (
            <div className={styles.field}>
              <label htmlFor="offline-profile">Conta guardada neste dispositivo</label>
              <select
                id="offline-profile"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                required
              >
                {profiles.map((profile) => (
                  <option key={profile.userId} value={profile.userId}>
                    {profile.email} · {profile.role === 'mission-control' ? 'Mission Control' : 'Astronauta'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.field}>
            <label htmlFor="offline-passphrase">
              {mode === 'offline-setup' ? 'Nova frase-passe offline' : 'Frase-passe offline'}
            </label>
            <input
              id="offline-passphrase"
              type="password"
              autoComplete="new-password"
              minLength="12"
              maxLength="256"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              required
            />
          </div>

          {mode === 'offline-setup' && (
            <div className={styles.field}>
              <label htmlFor="offline-passphrase-confirm">Confirmar frase-passe</label>
              <input
                id="offline-passphrase-confirm"
                type="password"
                autoComplete="new-password"
                minLength="12"
                maxLength="256"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </div>
          )}

          {error && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
            </div>
          )}

          <button
            className={styles.submit}
            type="submit"
            disabled={busy || (mode === 'offline-unlock' && !offlineProfile)}
          >
            <span>
              {busy
                ? 'A proteger dados…'
                : mode === 'offline-setup'
                  ? 'Activar cofre offline'
                  : 'Desbloquear e continuar'}
            </span>
            <span aria-hidden="true">↗</span>
          </button>
        </form>

        {mode !== 'offline-unlock' && (
          <button
            className={styles.skipOffline}
            type="button"
            disabled={busy}
            onClick={() => onContinue(user)}
          >
            Continuar sem activar acesso offline
          </button>
        )}

        <p className={styles.disclaimer}>
          Se perder a frase-passe offline, os dados cifrados não podem ser recuperados. Os registos
          locais só são considerados sincronizados depois de confirmação do servidor.
        </p>
      </section>
    </main>
  );
}
