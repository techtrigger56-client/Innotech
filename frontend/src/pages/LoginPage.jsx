import { useState } from 'react';
import { api } from '../lib/api.js';
import styles from './LoginPage.module.css';

export default function LoginPage({ onEnter, onOfflineAccess, canAccessOffline, initialError }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(initialError || '');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const result = await api.login(email.trim(), password);
      setPassword('');
      onEnter(result.user);
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível iniciar sessão.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.screen}>
      <section className={styles.hero} aria-labelledby="login-title">
        <div className={styles.heroTopline}>
          <span className={styles.projectMark}>AHMS</span>
          <span className={styles.separator} aria-hidden="true" />
          <span>Projeto da startup Innotech</span>
        </div>

        <div className={styles.orbitGraphic} aria-hidden="true">
          <span className={`${styles.orbit} ${styles.orbitOne}`} />
          <span className={`${styles.orbit} ${styles.orbitTwo}`} />
          <span className={styles.planet} />
          <span className={`${styles.signal} ${styles.signalOne}`} />
          <span className={`${styles.signal} ${styles.signalTwo}`} />
          <span className={styles.graphicLabel}>HEALTH · MISSION · CREW</span>
        </div>

        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Human exploration / 01</p>
          <h1 id="login-title">A saúde da missão começa com uma visão clara.</h1>
          <p className={styles.lead}>
            Acompanhe sinais, rotinas e alterações ao longo do tempo, com informação
            organizada para a tripulação e para a equipa em Terra.
          </p>
        </div>

        <div className={styles.heroFooter}>
          <span>ASTRONAUT HEALTH MONITORING SYSTEM</span>
          <span>MISSÃO · LONGA DURAÇÃO</span>
        </div>
      </section>

      <section className={styles.accessPanel} aria-labelledby="access-title">
        <div className={styles.accessHeading}>
          <span className={styles.accessIndex}>01 / ACESSO</span>
          <span className={styles.secureLabel}>
            <span className={styles.liveDot} />
            Sessão protegida
          </span>
        </div>

        <div className={styles.formIntro}>
          <p className={styles.eyebrow}>Bem-vindo ao AHMS</p>
          <h2 id="access-title">Inicie sessão</h2>
          <p>As permissões da conta determinam a área e os dados disponíveis.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              maxLength="254"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="login-password">Palavra-passe</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              maxLength="256"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <p>{error}</p>
            </div>
          )}

          <button className={styles.submit} type="submit" disabled={submitting}>
            <span>{submitting ? 'A validar credenciais…' : 'Iniciar sessão'}</span>
            <span aria-hidden="true">↗</span>
          </button>
        </form>

        {canAccessOffline && (
          <button
            className={styles.skipOffline}
            type="button"
            onClick={onOfflineAccess}
            disabled={submitting}
          >
            Desbloquear cofre offline neste dispositivo
          </button>
        )}

        <p className={styles.disclaimer}>
          Protótipo com dados simulados. A autenticação controla o acesso à demonstração;
          o AHMS não fornece diagnósticos médicos nem substitui profissionais de saúde.
        </p>
      </section>
    </main>
  );
}
