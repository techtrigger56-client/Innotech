import { useEffect, useState } from 'react';
import styles from './App.module.css';
import Navbar from './components/Navbar.jsx';
import ConnectionStatus from './components/ConnectionStatus.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MissionControlPage from './pages/MissionControlPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import OfflineAccessPage from './pages/OfflineAccessPage.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import { api } from './lib/api.js';
import './index.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState('');
  const [accessMode, setAccessMode] = useState('checking');
  const [offlineProfiles, setOfflineProfiles] = useState([]);

  useEffect(() => {
    let cancelled = false;

    api.currentUser()
      .then((result) => {
        if (!cancelled) {
          api.setOfflineOnly(false);
          setUser(result.user);
          setAccessMode('checking');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (error.status === 0 || error.status === 408 || error.status === 401) {
          api.listOfflineProfiles()
            .then((profiles) => {
              if (cancelled) return;
              setOfflineProfiles(profiles);
              const unavailable = error.status === 0 || error.status === 408;
              if (profiles.length) {
                setAccessMode(unavailable ? 'offline-unlock' : 'login');
                setAuthError('');
              } else {
                setAccessMode('login');
                setAuthError(unavailable
                  ? 'Sem ligação e sem cofre offline configurado neste dispositivo.'
                  : '');
              }
            })
            .catch((storageError) => {
              if (!cancelled) {
                setAccessMode('login');
                setAuthError(error.status === 0 || error.status === 408
                  ? storageError.message || 'Não foi possível abrir o armazenamento offline.'
                  : '');
              }
            });
        } else {
          setAccessMode('login');
          if (error.status !== 401) {
            setAuthError('Não foi possível validar a sessão. Verifique a ligação à API e inicie sessão novamente.');
          }
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });

    const handleUnauthorized = () => {
      api.setOfflineOnly(false);
      api.lockOfflineVault();
      setUser(null);
      setAccessMode('login');
      setAuthError('A sessão terminou. Inicie sessão novamente.');
    };
    window.addEventListener('ahms:unauthorized', handleUnauthorized);

    return () => {
      cancelled = true;
      window.removeEventListener('ahms:unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (!user || user.offline || accessMode !== 'checking') return undefined;
    let cancelled = false;

    api.hasOfflineVault(user.id)
      .then((exists) => {
        if (!cancelled) setAccessMode(exists ? 'online-unlock' : 'offline-setup');
      })
      .catch((error) => {
        if (!cancelled) {
          setAccessMode('offline-setup');
          setAuthError(error.message || 'Não foi possível verificar o cofre offline.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, accessMode]);

  useEffect(() => {
    if (!user || user.offline || accessMode !== 'dashboard') return undefined;

    const sync = () => {
      api.flushOfflineQueue().catch((error) => {
        window.dispatchEvent(new CustomEvent('ahms:offline-error', { detail: error.message }));
      });
    };
    const intervalId = window.setInterval(sync, 30000);
    window.addEventListener('online', sync);
    sync();
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', sync);
    };
  }, [user, accessMode]);

  const handleLogin = (authenticatedUser) => {
    setAuthError('');
    api.setOfflineOnly(false);
    setUser(authenticatedUser);
    setAccessMode('checking');
  };

  const handleOfflineAccess = async () => {
    try {
      const profiles = await api.listOfflineProfiles();
      if (!profiles.length) {
        setAuthError('Não existe um cofre offline configurado neste dispositivo.');
        return;
      }
      setOfflineProfiles(profiles);
      setAuthError('');
      setAccessMode('offline-unlock');
    } catch (error) {
      setAuthError(error.message || 'Não foi possível abrir o armazenamento offline.');
    }
  };

  const handleLogout = async () => {
    const wasOffline = user?.offline;
    api.setOfflineOnly(false);
    api.lockOfflineVault();
    setUser(null);
    setAccessMode('login');
    setAuthError('');
    if (wasOffline) return;

    try {
      await api.logout();
    } catch (error) {
      setAuthError(error.message || 'Não foi possível terminar a sessão.');
    }
  };

  if (!authChecked) {
    return <LoadingSpinner message="A validar sessão…" />;
  }

  if (user && accessMode === 'checking') {
    return <LoadingSpinner message="A verificar o cofre offline…" />;
  }

  if (user && accessMode && accessMode !== 'dashboard') {
    return (
      <OfflineAccessPage
        mode={accessMode}
        user={user}
        initialError={authError}
        onContinue={(nextUser) => {
          const offline = Boolean(nextUser.offline);
          api.setOfflineOnly(offline);
          setAuthError('');
          setUser(nextUser);
          setAccessMode('dashboard');
        }}
      />
    );
  }

  if (!user) {
    if (accessMode === 'offline-unlock') {
      return (
        <OfflineAccessPage
          mode="offline-unlock"
          profiles={offlineProfiles}
          initialError={authError}
          onContinue={(offlineUser) => {
            api.setOfflineOnly(true);
            setUser(offlineUser);
            setAccessMode('dashboard');
            setAuthError('');
          }}
        />
      );
    }
    return (
      <LoginPage
        onEnter={handleLogin}
        onOfflineAccess={handleOfflineAccess}
        canAccessOffline={offlineProfiles.length > 0}
        initialError={authError}
      />
    );
  }

  const isMissionControl = user.role === 'mission-control';

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <Navbar
          role={user.role}
          onLogout={handleLogout}
        />
        <ConnectionStatus />
      </header>

      <main className={styles.main}>
        {isMissionControl ? (
          <MissionControlPage />
        ) : (
          <DashboardPage initialAstronautId={user.astronautId} />
        )}
      </main>
    </div>
  );
}
