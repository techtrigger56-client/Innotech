import { analyzeCachedMeasurements } from '../../shared/health-analysis.js';

const DATABASE_NAME = 'ahms-encrypted-offline';
const DATABASE_VERSION = 1;
const VAULT_STORE = 'vaults';
const RECORD_STORE = 'records';
const PBKDF2_ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let activeVault = null;
let databasePromise = null;

function requireBrowserCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) {
    throw new Error('Este navegador não suporta o armazenamento offline protegido.');
  }
}

function openDatabase() {
  requireBrowserCrypto();
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(VAULT_STORE)) {
        database.createObjectStore(VAULT_STORE, { keyPath: 'userId' });
      }
      if (!database.objectStoreNames.contains(RECORD_STORE)) {
        const store = database.createObjectStore(RECORD_STORE, { keyPath: 'id' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('kind', 'kind', { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error || new Error('Não foi possível abrir o armazenamento offline.'));
    };
  });

  return databasePromise;
}

async function transactionRequest(storeName, mode, createRequest) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    let request;
    let result;
    try {
      request = createRequest(transaction.objectStore(storeName));
    } catch (error) {
      transaction.abort();
      reject(error);
      return;
    }

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error || new Error('Falha no armazenamento offline.'));
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error('Falha no armazenamento offline.'));
    transaction.onabort = () => reject(transaction.error || new Error('A operação offline foi cancelada.'));
  });
}

function transactionAll(storeName, indexName, value) {
  return transactionRequest(storeName, 'readonly', (store) =>
    store.index(indexName).getAll(value)
  );
}

async function deriveKey(passphrase, salt) {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(value, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(value))
  );
  return { iv: Array.from(iv), cipher: Array.from(new Uint8Array(cipher)) };
}

async function decrypt(record, key) {
  const cleartext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(record.iv) },
    key,
    new Uint8Array(record.cipher)
  );
  return JSON.parse(decoder.decode(cleartext));
}

function dispatchUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ahms:offline-update'));
  }
}

async function storeVault(userId, vault) {
  await transactionRequest(VAULT_STORE, 'readwrite', (store) => store.put({ userId, ...vault }));
}

async function storeRecord(record) {
  await transactionRequest(RECORD_STORE, 'readwrite', (store) => store.put(record));
}

export async function listOfflineProfiles() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(VAULT_STORE, 'readonly').objectStore(VAULT_STORE).getAll();
    request.onsuccess = () => resolve(request.result.map(({ userId, email, role }) => ({ userId, email, role })));
    request.onerror = () => reject(request.error || new Error('Não foi possível listar os perfis offline.'));
  });
}

export async function hasOfflineVault(userId) {
  const record = await transactionRequest(VAULT_STORE, 'readonly', (store) => store.get(userId));
  return Boolean(record);
}

export async function createOfflineVault(user, passphrase) {
  requireBrowserCrypto();
  if (!passphrase || passphrase.length < 12 || passphrase.length > 256) {
    throw new Error('A frase-passe offline deve ter entre 12 e 256 caracteres.');
  }

  const existing = await transactionRequest(VAULT_STORE, 'readonly', (store) => store.get(user.id));
  if (existing) {
    throw new Error('Já existe um cofre offline para esta conta. Desbloqueie-o ou use outra conta.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const profile = {
    id: user.id,
    email: user.email,
    role: user.role,
    astronautId: user.astronautId,
  };
  const profileRecord = await encrypt(profile, key);
  await storeVault(user.id, {
    email: user.email,
    role: user.role,
    salt: Array.from(salt),
    iterations: PBKDF2_ITERATIONS,
    createdAt: new Date().toISOString(),
  });
  try {
    await storeRecord({
      id: `profile:${user.id}`,
      userId: user.id,
      kind: 'profile',
      ...profileRecord,
    });
  } catch (error) {
    await transactionRequest(VAULT_STORE, 'readwrite', (store) => store.delete(user.id));
    throw error;
  }
  activeVault = { userId: user.id, key, profile };
}

export async function unlockOfflineVault(userId, passphrase) {
  const vault = await transactionRequest(VAULT_STORE, 'readonly', (store) => store.get(userId));
  if (!vault) throw new Error('Não existe um cofre offline para esta conta.');
  const key = await deriveKey(passphrase, new Uint8Array(vault.salt));
  const record = await transactionRequest(
    RECORD_STORE,
    'readonly',
    (store) => store.get(`profile:${userId}`)
  );

  try {
    const profile = await decrypt(record, key);
    if (profile.id !== userId || profile.email !== vault.email || profile.role !== vault.role) {
      throw new Error('Perfil offline inconsistente.');
    }
    activeVault = { userId, key, profile };
    return profile;
  } catch {
    throw new Error('Frase-passe incorrecta ou cofre offline danificado.');
  }
}

export function getActiveOfflineProfile() {
  return activeVault?.profile || null;
}

export function lockOfflineVault() {
  activeVault = null;
  dispatchUpdate();
}

export function isOfflineVaultUnlocked() {
  return Boolean(activeVault);
}

async function getActiveRecords() {
  if (!activeVault) return [];
  return transactionAll(RECORD_STORE, 'userId', activeVault.userId);
}

export async function readCachedResponse(path) {
  if (!activeVault) return undefined;
  const id = `cache:${activeVault.userId}:${path}`;
  const record = await transactionRequest(RECORD_STORE, 'readonly', (store) => store.get(id));
  if (!record) return undefined;
  return decrypt(record, activeVault.key);
}

export async function cacheResponse(path, value) {
  if (!activeVault) return;
  const encrypted = await encrypt(value, activeVault.key);
  await storeRecord({
    id: `cache:${activeVault.userId}:${path}`,
    userId: activeVault.userId,
    kind: 'cache',
    path,
    updatedAt: new Date().toISOString(),
    ...encrypted,
  });
}

function categoryFromPath(path) {
  if (path.endsWith('/symptoms')) return 'symptom';
  if (path.endsWith('/exercises')) return 'exercise';
  if (path.endsWith('/checkin')) return 'checkin';
  if (path.endsWith('/measurements')) return 'measurement';
  return null;
}

export async function enqueueOfflineWrite(path, body, operationId = crypto.randomUUID()) {
  if (!activeVault) {
    throw new Error('Desbloqueie o cofre offline para guardar registos sem ligação.');
  }
  if (activeVault.profile.role !== 'astronaut') {
    throw new Error('A conta Mission Control não pode criar registos offline.');
  }

  const category = categoryFromPath(path);
  if (!category) throw new Error('Este tipo de operação não pode ser colocado na fila offline.');
  const encrypted = await encrypt(body, activeVault.key);
  const record = {
    id: `outbox:${activeVault.userId}:${operationId}`,
    userId: activeVault.userId,
    kind: 'outbox',
    category,
    path,
    operationId,
    createdAt: new Date().toISOString(),
    status: 'queued',
    error: null,
    ...encrypted,
  };
  await storeRecord(record);
  dispatchUpdate();
  return { queued: true, operationId };
}

export async function getOfflineQueue() {
  if (!activeVault) return [];
  const records = (await getActiveRecords())
    .filter((record) => record.kind === 'outbox')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const queue = [];
  for (const record of records) {
    queue.push({
      ...record,
      payload: await decrypt(record, activeVault.key),
    });
  }
  return queue;
}

export async function updateOfflineQueueItem(operationId, status, error = null, failureStatus = null) {
  if (!activeVault) return;
  const id = `outbox:${activeVault.userId}:${operationId}`;
  const record = await transactionRequest(RECORD_STORE, 'readonly', (store) => store.get(id));
  if (!record) return;
  const payload = await decrypt(record, activeVault.key);
  const encrypted = await encrypt(payload, activeVault.key);
  await storeRecord({ ...record, ...encrypted, status, error, failureStatus });
  dispatchUpdate();
}

export async function removeOfflineQueueItem(operationId) {
  if (!activeVault) return;
  const id = `outbox:${activeVault.userId}:${operationId}`;
  await transactionRequest(RECORD_STORE, 'readwrite', (store) => store.delete(id));
  dispatchUpdate();
}

export async function clearCachedResponses() {
  if (!activeVault) return;
  const records = await getActiveRecords();
  await Promise.all(
    records
      .filter((record) => record.kind === 'cache')
      .map((record) =>
        transactionRequest(RECORD_STORE, 'readwrite', (store) => store.delete(record.id))
      )
  );
}

function pendingRecord(record, payload) {
  const id = `offline-${record.operationId}`;
  if (record.category === 'symptom' || (record.category === 'checkin' && payload.note)) {
    return {
      id,
      timestamp: record.createdAt,
      title: record.category === 'checkin' ? 'Observação do check-in' : payload.title,
      category: record.category === 'checkin' ? 'other' : payload.category || 'other',
      description: record.category === 'checkin' ? payload.note : payload.description,
      severity: record.category === 'checkin' ? 'moderate' : payload.severity,
      offlinePending: true,
    };
  }
  if (record.category === 'exercise') {
    return {
      id,
      timestamp: record.createdAt,
      activity_type: payload.activityType,
      duration_minutes: payload.durationMinutes,
      intensity: payload.intensity,
      fatigue_after: payload.fatigueAfter ?? null,
      notes: payload.notes,
      offlinePending: true,
    };
  }
  return null;
}

export async function overlayOfflineRecords(path, responseValue) {
  if (!activeVault || responseValue === null || responseValue === undefined) return responseValue;
  const queue = await getOfflineQueue();
  const pending = queue
    .filter((item) =>
      item.status === 'queued' &&
      path.includes(item.path.split('/').slice(0, -1).join('/'))
    )
    .map((item) => ({ item, record: pendingRecord(item, item.payload) }))
    .filter((entry) => entry.record);

  if (path.endsWith('/symptoms') && Array.isArray(responseValue)) {
    return [
      ...pending.filter(({ item }) => ['symptom', 'checkin'].includes(item.category)).map(({ record }) => record),
      ...responseValue,
    ];
  }
  if (path.endsWith('/exercises') && Array.isArray(responseValue)) {
    return [...pending.filter(({ item }) => item.category === 'exercise').map(({ record }) => record), ...responseValue];
  }
  if (path.includes('/exercises/summary') && typeof responseValue === 'object') {
    const days = Number(new URLSearchParams(path.split('?')[1] || '').get('days')) || 7;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const pendingExercises = queue.filter((item) =>
      item.status === 'queued' &&
      item.category === 'exercise' &&
      Date.parse(item.createdAt) >= cutoff
    );
    return {
      ...responseValue,
      pendingLocalSessions: pendingExercises.length,
      pendingLocalMinutes: pendingExercises.reduce(
        (total, item) => total + (Number(item.payload.durationMinutes) || 0),
        0
      ),
    };
  }
  if (path.endsWith('/summary')) {
    const measurementItems = queue.filter((item) =>
      item.status === 'queued' &&
      ['measurement', 'checkin'].includes(item.category) &&
      path === `/api/astronauts/${activeVault.profile.astronautId}/summary`
    );
    const trend = (responseValue.trend || []).slice();
    let latest = responseValue.latest || null;
    for (const item of measurementItems) {
      const payload = item.payload;
      const point = {
        date: item.createdAt,
        heartRate: payload.heartRate ?? null,
        oxygenSaturation: payload.oxygenSaturation ?? null,
        respiratoryRate: payload.respiratoryRate ?? null,
        sleepHours: payload.sleepHours ?? null,
        stressLevel: payload.stressLevel ?? null,
        fatigueLevel: payload.fatigueLevel ?? null,
        isolationLevel: payload.isolationLevel ?? null,
        concentrationLevel: payload.concentrationLevel ?? null,
        motivationLevel: payload.motivationLevel ?? null,
        sleepQuality: payload.sleepQuality ?? null,
        mood: payload.mood ?? null,
        offlinePending: true,
      };
      trend.push(point);
      if (!latest || item.createdAt > latest.timestamp) {
        latest = {
          ...latest,
          timestamp: item.createdAt,
          heartRate: payload.heartRate ?? latest?.heartRate ?? null,
          oxygenSaturation: payload.oxygenSaturation ?? latest?.oxygenSaturation ?? null,
          respiratoryRate: payload.respiratoryRate ?? latest?.respiratoryRate ?? null,
          sleepHours: payload.sleepHours ?? latest?.sleepHours ?? null,
          stressLevel: payload.stressLevel ?? latest?.stressLevel ?? null,
          fatigueLevel: payload.fatigueLevel ?? latest?.fatigueLevel ?? null,
          isolationLevel: payload.isolationLevel ?? latest?.isolationLevel ?? null,
          concentrationLevel: payload.concentrationLevel ?? latest?.concentrationLevel ?? null,
          motivationLevel: payload.motivationLevel ?? latest?.motivationLevel ?? null,
          sleepQuality: payload.sleepQuality ?? latest?.sleepQuality ?? null,
          mood: payload.mood ?? latest?.mood ?? null,
          offlinePending: true,
        };
      }
    }

    const sortedTrend = trend.sort((left, right) => left.date.localeCompare(right.date));
    const localAnalysis = measurementItems.length
      ? analyzeCachedMeasurements(responseValue.trend || [], measurementItems, responseValue.baseline)
      : null;

    return {
      ...responseValue,
      latest,
      trend: sortedTrend.slice(-90),
      alert: localAnalysis
        ? {
          ...localAnalysis,
          offline: true,
          title: `${localAnalysis.title} · análise local`,
          description: `${localAnalysis.description} Esta análise usa a baseline e o histórico cifrados disponíveis neste dispositivo, incluindo registos ainda não sincronizados; não é uma avaliação clínica nem um alerta confirmado pela equipa em Terra.`,
        }
        : {
          level: 'Não avaliado',
          title: 'Avaliação não atualizada offline',
          description: 'Não há novos registos locais suficientes para recalcular a análise. Os dados apresentados podem estar desatualizados; a avaliação só é atualizada após ligação ao servidor.',
          signals: [],
          recommendations: [],
        },
    };
  }
  return responseValue;
}
