const { all } = require('./database');

function datePart(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

async function createBackupId(prefix = 'SR', date = new Date()) {
  const part = datePart(date);
  const rows = await all(
    `SELECT id FROM backups WHERE id LIKE ? ORDER BY id DESC LIMIT 1`,
    [`${prefix}-${part}-%`]
  );

  let number = 1;
  if (rows.length) {
    const match = rows[0].id.match(/-(\d{3})$/);
    if (match) number = Number(match[1]) + 1;
  }

  return `${prefix}-${part}-${String(number).padStart(3, '0')}`;
}

module.exports = { createBackupId };
