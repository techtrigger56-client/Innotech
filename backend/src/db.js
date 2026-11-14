import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDirectory = path.join(__dirname, '..', 'data');
const dbPath = process.env.AHMS_DATABASE_PATH
  ? path.resolve(process.env.AHMS_DATABASE_PATH)
  : path.join(dataDirectory, 'innotech.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new sqlite3.Database(dbPath);

export function initializeDatabase() {
  let migrationResolve;
  let migrationReject;
  const initialization = new Promise((resolve, reject) => {
    migrationResolve = resolve;
    migrationReject = reject;
  });

  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
      CREATE TABLE IF NOT EXISTS astronauts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mission TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'astronaut',
        status TEXT NOT NULL DEFAULT 'Normal',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('astronaut', 'mission-control')),
        astronaut_id TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id),
        CHECK (
          (role = 'astronaut' AND astronaut_id IS NOT NULL) OR
          (role = 'mission-control' AND astronaut_id IS NULL)
        )
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS idempotency_requests (
        user_id INTEGER NOT NULL,
        operation_id TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        response_status INTEGER,
        response_body TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, operation_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS health_measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        astronaut_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        heart_rate REAL,
        oxygen_saturation REAL,
        respiratory_rate REAL,
        sleep_hours REAL,
        stress_level REAL,
        fatigue_level REAL,
        isolation_level REAL,
        concentration_level REAL,
        motivation_level REAL,
        sleep_quality REAL,
        mood TEXT,
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS symptoms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        astronaut_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        description TEXT,
        severity TEXT DEFAULT 'moderate',
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        astronaut_id TEXT NOT NULL,
        level TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS exercise_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        astronaut_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        activity_type TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        intensity TEXT NOT NULL,
        fatigue_after INTEGER,
        notes TEXT,
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS individual_baselines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        astronaut_id TEXT NOT NULL,
        metric TEXT NOT NULL,
        baseline_value REAL NOT NULL,
        sample_count INTEGER NOT NULL,
        based_on_until TEXT NOT NULL,
        established_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (astronaut_id, metric),
        FOREIGN KEY (astronaut_id) REFERENCES astronauts(id) ON DELETE CASCADE
      )
    `);

    db.run(`
      INSERT OR IGNORE INTO astronauts (id, name, mission, role, status)
      VALUES
        ('astro-01', 'Ava Mendes', 'Luna-7', 'astronaut', 'Atenção'),
        ('astro-02', 'Noah Patel', 'Ares-12', 'astronaut', 'Normal'),
        ('mission-control', 'Mission Control', 'Earth Ops', 'mission_control', 'Normal')
    `);

    db.run(
      `UPDATE alerts
           SET title = 'Exemplo simulado: variação do sono',
           description = 'Alerta histórico pré-carregado para demonstração; não foi gerado por uma avaliação clínica.'
           WHERE title = 'Sono abaixo do padrão habitual'`
    );
    db.run(
      `UPDATE alerts
       SET title = 'Exemplo simulado: vários indicadores',
           description = 'Alerta histórico pré-carregado para demonstração; não foi gerado por uma avaliação clínica.'
       WHERE title = 'Indicadores em tendência de deterioração'`
    );

    const demoMeasurements = [
      ['astro-01', '2026-11-06T08:00:00.000Z', 64, 99, 15, 7.5, 3, 2, 'Normal'],
      ['astro-01', '2026-11-07T08:00:00.000Z', 66, 98, 16, 7.1, 3, 2, 'Normal'],
      ['astro-01', '2026-11-08T08:00:00.000Z', 69, 98, 16, 6.7, 4, 3, 'Atenção'],
      ['astro-01', '2026-11-09T08:00:00.000Z', 72, 97, 17, 6.1, 5, 4, 'Atenção'],
      ['astro-01', '2026-11-10T08:00:00.000Z', 75, 96, 18, 5.4, 6, 5, 'Atenção'],
      ['astro-02', '2026-11-10T08:00:00.000Z', 62, 99, 15, 7.8, 2, 2, 'Normal'],
    ];
    for (const measurement of demoMeasurements) {
      db.run(
            `INSERT INTO health_measurements (
              astronaut_id, timestamp, heart_rate, oxygen_saturation, respiratory_rate,
              sleep_hours, stress_level, fatigue_level, mood
            )
            SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM health_measurements WHERE astronaut_id = ? AND timestamp = ?
            )`,
            [...measurement, measurement[0], measurement[1]]
      );
    }

    const demoSymptoms = [
      ['astro-01', '2026-11-10T08:00:00.000Z', 'Sono reduzido', 'Quatro noites consecutivas com menos sono do que o habitual.', 'moderate'],
      ['astro-01', '2026-11-10T08:00:00.000Z', 'Fadiga', 'Sensação de cansaço e diminuição da energia.', 'moderate'],
    ];
    for (const symptom of demoSymptoms) {
      db.run(
            `INSERT INTO symptoms (astronaut_id, timestamp, title, description, severity)
             SELECT ?, ?, ?, ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM symptoms
               WHERE astronaut_id = ? AND timestamp = ? AND title = ?
             )`,
            [...symptom, symptom[0], symptom[1], symptom[2]]
      );
    }

    const demoAlerts = [
      ['Atenção', 'Exemplo simulado: variação do sono', 'Alerta histórico pré-carregado para demonstração; não foi gerado por uma avaliação clínica.'],
      ['Prioridade', 'Exemplo simulado: vários indicadores', 'Alerta histórico pré-carregado para demonstração; não foi gerado por uma avaliação clínica.'],
    ];
    for (const alert of demoAlerts) {
      db.run(
            `INSERT INTO alerts (astronaut_id, level, title, description)
             SELECT ?, ?, ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM alerts WHERE astronaut_id = ? AND title = ?
             )`,
            ['astro-01', ...alert, 'astro-01', alert[1]]
      );
    }

    db.all('PRAGMA table_info(health_measurements)', (measurementError, measurementColumns) => {
      if (measurementError) {
        migrationReject(measurementError);
        return;
      }

      const measurementMigrations = [
        ['isolation_level', 'REAL'],
        ['concentration_level', 'REAL'],
        ['motivation_level', 'REAL'],
        ['sleep_quality', 'REAL'],
      ];
      const existingMeasurementColumns = new Set(measurementColumns.map((column) => column.name));
      const missingMeasurementColumns = measurementMigrations.filter(([name]) => !existingMeasurementColumns.has(name));
      runColumnMigrations('health_measurements', missingMeasurementColumns)
        .then(() => readTableColumns('symptoms'))
        .then((symptomColumns) => {
          const existingSymptomColumns = new Set(symptomColumns.map((column) => column.name));
          const missingSymptomColumns = existingSymptomColumns.has('category')
            ? []
            : [['category', "TEXT NOT NULL DEFAULT 'other'"]];
          return runColumnMigrations('symptoms', missingSymptomColumns);
        })
        .then(migrationResolve, migrationReject);
    });
  });

  return initialization;
}

function readTableColumns(table) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, (error, columns) => {
      if (error) reject(error);
      else resolve(columns);
    });
  });
}

function runColumnMigrations(table, migrations) {
  return migrations.reduce(
    (previous, [name, definition]) => previous.then(() => new Promise((resolve, reject) => {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`, (error) => {
        if (error) reject(error);
        else resolve();
      });
    })),
    Promise.resolve()
  );
}

export function getDb() {
  return db;
}
