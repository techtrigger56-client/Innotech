import * as offlineVault from './offlineVault.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
let offlineOnly = false;
let queueSyncPromise = null;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request(path, options = {}) {
  const {
    allowOfflineQueue = true,
    allowCachedResponse = true,
    ...fetchOptions
  } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();
  const isAstronautWrite = method === 'POST' && path.startsWith('/api/astronauts/');
  const operationId = isAstronautWrite
    ? fetchOptions.headers?.['Idempotency-Key'] || crypto.randomUUID()
    : null;
  const headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
    ...(operationId ? { 'Idempotency-Key': operationId } : {}),
  };

  if (offlineOnly) {
    if (method === 'GET') {
      const cached = await offlineVault.readCachedResponse(path);
      if (cached === undefined) {
        throw new ApiError('Este dado não está guardado no cofre offline deste dispositivo.', 0);
      }
      return offlineVault.overlayOfflineRecords(path, cached);
    }

    if (isAstronautWrite && allowOfflineQueue) {
      try {
        return await offlineVault.enqueueOfflineWrite(
          path,
          JSON.parse(fetchOptions.body || '{}'),
          operationId
        );
      } catch (error) {
        throw new ApiError(error.message, 0);
      }
    }

    throw new ApiError('Esta operação não está disponível sem ligação.', 0);
  }

  const url = `${API_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 && !path.startsWith('/api/auth/')) {
        window.dispatchEvent(new CustomEvent('ahms:unauthorized'));
      }
      let errorMessage = `Erro ${response.status}`;
      try {
        const body = await response.json();
        errorMessage = body.error || errorMessage;
      } catch {
        // Ignore JSON parse errors on error responses
      }
      throw new ApiError(errorMessage, response.status);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const result = await response.json();
      if (method === 'GET' && !path.startsWith('/api/auth/')) {
        try {
          await offlineVault.cacheResponse(path, result);
        } catch (error) {
          window.dispatchEvent(new CustomEvent('ahms:offline-error', { detail: error.message }));
        }
      }
      return result;
    }

    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      if (isAstronautWrite && allowOfflineQueue && offlineVault.isOfflineVaultUnlocked()) {
        try {
          return await offlineVault.enqueueOfflineWrite(
            path,
            JSON.parse(fetchOptions.body || '{}'),
            operationId
          );
        } catch (queueError) {
          throw new ApiError(queueError.message, 0);
        }
      }
      if (method === 'GET' && allowCachedResponse && offlineVault.isOfflineVaultUnlocked()) {
        try {
          const cached = await offlineVault.readCachedResponse(path);
          if (cached !== undefined) {
            window.dispatchEvent(new CustomEvent('ahms:offline-cache', { detail: path }));
            return await offlineVault.overlayOfflineRecords(path, cached);
          }
        } catch (cacheError) {
          throw new ApiError(cacheError.message, 0);
        }
      }
      throw new ApiError('Tempo limite da requisição excedido.', 408);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    if (isAstronautWrite && allowOfflineQueue && offlineVault.isOfflineVaultUnlocked()) {
      try {
        return await offlineVault.enqueueOfflineWrite(
          path,
          JSON.parse(fetchOptions.body || '{}'),
          operationId
        );
      } catch (queueError) {
        throw new ApiError(queueError.message, 0);
      }
    }
    if (method === 'GET' && allowCachedResponse && offlineVault.isOfflineVaultUnlocked()) {
      try {
        const cached = await offlineVault.readCachedResponse(path);
        if (cached !== undefined) {
          window.dispatchEvent(new CustomEvent('ahms:offline-cache', { detail: path }));
          return await offlineVault.overlayOfflineRecords(path, cached);
        }
      } catch (cacheError) {
        throw new ApiError(cacheError.message, 0);
      }
    }
    throw new ApiError('Não foi possível ligar à API. Verifique a ligação à rede.', 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function performOfflineQueueSync() {
  if (offlineOnly || !offlineVault.isOfflineVaultUnlocked() || navigator.onLine === false) {
    return { synced: 0, pending: (await offlineVault.getOfflineQueue()).length };
  }

  let synced = 0;
  const queue = await offlineVault.getOfflineQueue();
  for (const item of queue) {
    if (item.status !== 'queued') continue;
    try {
      await request(item.path, {
        method: 'POST',
        body: JSON.stringify(item.payload),
        headers: { 'Idempotency-Key': item.operationId },
        allowOfflineQueue: false,
      });
      await offlineVault.removeOfflineQueueItem(item.operationId);
      synced += 1;
    } catch (error) {
      if (error.status === 400 || error.status === 403 || error.status === 404) {
        await offlineVault.updateOfflineQueueItem(
          item.operationId,
          'blocked',
          error.message || 'O servidor recusou este registo; requer revisão.',
          error.status
        );
        continue;
      }
      if (error.status === 409) {
        await offlineVault.updateOfflineQueueItem(
          item.operationId,
          'blocked',
          error.message || 'A operação precisa de reconciliação antes de repetir.',
          error.status
        );
        continue;
      }
      break;
    }
  }

  if (synced > 0) {
    await offlineVault.clearCachedResponses();
    window.dispatchEvent(new CustomEvent('ahms:offline-synced', { detail: { synced } }));
  }
  return {
    synced,
    pending: Math.max(0, queue.length - synced),
  };
}

function syncOfflineQueue() {
  if (!queueSyncPromise) {
    queueSyncPromise = performOfflineQueueSync().finally(() => {
      queueSyncPromise = null;
    });
  }
  return queueSyncPromise;
}

export const api = {
  setOfflineOnly(value) {
    offlineOnly = value;
  },
  isOfflineOnly: () => offlineOnly,
  flushOfflineQueue: syncOfflineQueue,
  getOfflineQueue: offlineVault.getOfflineQueue,
  removeOfflineQueueItem: offlineVault.removeOfflineQueueItem,
  async reconcileOfflineQueueItem(operationId) {
    const item = (await offlineVault.getOfflineQueue())
      .find((entry) => entry.operationId === operationId);
    if (!item || item.status !== 'blocked' || item.failureStatus !== 409) {
      throw new ApiError('Só é possível reconciliar operações bloqueadas por conflito 409.', 400);
    }
    await offlineVault.updateOfflineQueueItem(operationId, 'queued');
    return syncOfflineQueue();
  },
  lockOfflineVault: offlineVault.lockOfflineVault,
  isOfflineVaultUnlocked: offlineVault.isOfflineVaultUnlocked,
  hasOfflineVault: offlineVault.hasOfflineVault,
  listOfflineProfiles: offlineVault.listOfflineProfiles,
  createOfflineVault: offlineVault.createOfflineVault,
  unlockOfflineVault: offlineVault.unlockOfflineVault,
  health: () => request('/api/health', { allowCachedResponse: false }),
  currentUser: () => request('/api/auth/me'),
  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  listAstronauts: () => request('/api/astronauts'),
  getSummary: (id) => request(`/api/astronauts/${id}/summary`),
  getMissionHistory: (id, page = 1, pageSize = 20) =>
    request(`/api/astronauts/${id}/history?page=${page}&pageSize=${pageSize}`),
  getAlerts: (id) => request(`/api/astronauts/${id}/alerts`),
  getSymptoms: (id) => request(`/api/astronauts/${id}/symptoms`),
  getExercises: (id) => request(`/api/astronauts/${id}/exercises`),
  getExerciseSummary: (id, days = 7) =>
    request(`/api/astronauts/${id}/exercises/summary?days=${days}`),
  postSymptom: (id, payload) =>
    request(`/api/astronauts/${id}/symptoms`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  postExercise: (id, payload) =>
    request(`/api/astronauts/${id}/exercises`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  postCheckin: (id, payload) =>
    request(`/api/astronauts/${id}/checkin`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  postMeasurements: (id, payload) =>
    request(`/api/astronauts/${id}/measurements`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
