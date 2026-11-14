import assert from 'node:assert/strict';
import test from 'node:test';
import { TursoSqliteAdapter } from '../src/lib/turso-adapter.js';

test('preserves queued SQLite callbacks and insert metadata for Turso', async () => {
  const statements = [];
  const client = {
    async execute(statement) {
      statements.push(statement);
      return statement.sql.startsWith('INSERT')
        ? { lastInsertRowid: 42n, rowsAffected: 1 }
        : { rows: [{ id: 42, name: 'Ava' }] };
    },
    close() {},
  };
  const database = new TursoSqliteAdapter(client);

  const insert = new Promise((resolve, reject) => {
    database.run('INSERT INTO astronauts (name) VALUES (?)', ['Ava'], function (error) {
      if (error) reject(error);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
  const select = new Promise((resolve, reject) => {
    database.all('SELECT id, name FROM astronauts WHERE id = ?', [42], (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });

  assert.deepEqual(await insert, { lastID: 42, changes: 1 });
  assert.deepEqual(await select, [{ id: 42, name: 'Ava' }]);
  assert.deepEqual(statements.map(({ sql }) => sql), [
    'INSERT INTO astronauts (name) VALUES (?)',
    'SELECT id, name FROM astronauts WHERE id = ?',
  ]);
});

test('reports Turso query failures through SQLite-style callbacks', async () => {
  const database = new TursoSqliteAdapter({
    async execute() {
      throw new Error('database unavailable');
    },
  });

  await new Promise((resolve) => {
    database.all('SELECT 1', (error) => {
      assert.match(error.message, /database unavailable/);
      resolve();
    });
  });
});
