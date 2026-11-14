export class TursoSqliteAdapter {
  constructor(client) {
    this.client = client;
    this.queue = Promise.resolve();
  }

  serialize(callback) {
    callback();
  }

  all(sql, params, callback) {
    const request = normalizeRequest(params, callback);
    this.enqueue(sql, request.args, request.callback, (result) => {
      if (request.callback) request.callback(null, result.rows);
    });
  }

  run(sql, params, callback) {
    const request = normalizeRequest(params, callback);
    this.enqueue(sql, request.args, request.callback, (result) => {
      const context = {
        lastID: result.lastInsertRowid === undefined
          ? 0
          : Number(result.lastInsertRowid),
        changes: result.rowsAffected,
      };
      if (request.callback) request.callback.call(context, null);
    });
  }

  close(callback) {
    const close = this.queue.then(() => this.client.close());
    this.queue = close.catch(() => undefined);
    if (callback) {
      close.then(() => callback(null), callback);
    }
    return close;
  }

  enqueue(sql, args, callback, onSuccess) {
    const request = this.queue.then(() => this.client.execute({ sql, args }));
    this.queue = request.catch(() => undefined);
    request.then(
      onSuccess,
      (error) => {
        if (callback) callback(error);
        else process.nextTick(() => { throw error; });
      }
    );
  }
}

function normalizeRequest(params, callback) {
  if (typeof params === 'function') {
    return { args: [], callback: params };
  }
  return {
    args: params === undefined ? [] : params,
    callback,
  };
}
