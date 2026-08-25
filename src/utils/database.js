const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

const dataDir = path.join(process.cwd(), 'data');
fs.ensureDirSync(dataDir);

const db = new sqlite3.Database(path.join(dataDir, 'skyrush.sqlite'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS backups (
    id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    guild_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    file_path TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    guild_id TEXT PRIMARY KEY,
    auto_backup INTEGER DEFAULT 1,
    interval_minutes INTEGER DEFAULT 60,
    max_backups INTEGER DEFAULT 20,
    log_channel_id TEXT
  )`);
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err); else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

module.exports = { db, run, all, get };
