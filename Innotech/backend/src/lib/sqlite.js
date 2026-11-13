import { getDb } from '../db.js';

export function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

export function execute(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}
