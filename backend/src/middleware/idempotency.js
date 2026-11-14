import { createHash } from 'node:crypto';
import { execute, queryAll } from '../lib/sqlite.js';

const OPERATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requestHash(request) {
  return createHash('sha256')
    .update(JSON.stringify({ method: request.method, path: request.originalUrl, body: request.body }))
    .digest('hex');
}

export async function idempotencyMiddleware(request, response, next) {
  if (request.method !== 'POST' || !request.path.startsWith('/')) {
    next();
    return;
  }

  const operationId = request.get('Idempotency-Key');
  if (!operationId || !OPERATION_ID_PATTERN.test(operationId)) {
    response.status(400).json({ error: 'É necessária uma chave Idempotency-Key válida.' });
    return;
  }

  const userId = request.user.id;
  const hash = requestHash(request);
  const existing = await queryAll(
    `SELECT request_hash AS requestHash, response_status AS responseStatus,
            response_body AS responseBody
     FROM idempotency_requests
     WHERE user_id = ? AND operation_id = ?
     LIMIT 1`,
    [userId, operationId]
  );

  if (existing.length) {
    const record = existing[0];
    if (record.requestHash !== hash) {
      response.status(409).json({ error: 'A chave de operação já foi usada com dados diferentes.' });
      return;
    }
    if (record.responseStatus === null || record.responseBody === null) {
      response.status(409).json({ error: 'A operação está em processamento ou requer reconciliação.' });
      return;
    }
    response.status(record.responseStatus).json(JSON.parse(record.responseBody));
    return;
  }

  const inserted = await execute(
    `INSERT OR IGNORE INTO idempotency_requests (user_id, operation_id, request_hash)
     VALUES (?, ?, ?)`,
    [userId, operationId, hash]
  );
  if (!inserted.changes) {
    response.status(409).json({ error: 'A operação já está em processamento. Tente sincronizar novamente.' });
    return;
  }

  const sendJson = response.json.bind(response);
  let responseHandled = false;
  response.json = (body) => {
    if (responseHandled) return response;
    responseHandled = true;

    if (response.statusCode >= 500) {
      execute(
        'DELETE FROM idempotency_requests WHERE user_id = ? AND operation_id = ?',
        [userId, operationId]
      )
        .then(() => sendJson(body))
        .catch(next);
      return response;
    }

    execute(
      `UPDATE idempotency_requests
       SET response_status = ?, response_body = ?
       WHERE user_id = ? AND operation_id = ? AND request_hash = ?`,
      [response.statusCode, JSON.stringify(body), userId, operationId, hash]
    )
      .then(() => sendJson(body))
      .catch(next);
    return response;
  };

  next();
}
