const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const dbPath = path.join(__dirname, 'data.json');

function readDb() {
  if (!fs.existsSync(dbPath)) {
    return initDefaultData();
  }
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return initDefaultData();
  }
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

function initDefaultData() {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const db = {
    rooms: [],
    pets: [],
    bookings: [],
    daily_records: [],
    reminders: []
  };

  for (let i = 1; i <= 6; i++) {
    db.rooms.push({
      id: i,
      name: `猫房-${String(i).padStart(2, '0')}`,
      type: 'cat',
      capacity: 1,
      status: 'available',
      description: `标准猫房 ${i}号`,
      created_at: now
    });
  }

  for (let i = 1; i <= 8; i++) {
    db.rooms.push({
      id: 6 + i,
      name: `犬舍-${String(i).padStart(2, '0')}`,
      type: 'dog',
      capacity: 1,
      status: 'available',
      description: `标准犬舍 ${i}号`,
      created_at: now
    });
  }

  db.rooms.push({
    id: 15,
    name: '猫房-VIP',
    type: 'cat',
    capacity: 2,
    status: 'available',
    description: '豪华VIP猫房，可容纳2只猫',
    created_at: now
  });
  db.rooms.push({
    id: 16,
    name: '犬舍-VIP',
    type: 'dog',
    capacity: 2,
    status: 'available',
    description: '豪华VIP犬舍，可容纳大型犬',
    created_at: now
  });

  writeDb(db);
  return db;
}

function getNextId(collection) {
  if (collection.length === 0) return 1;
  return Math.max(...collection.map(x => x.id)) + 1;
}

module.exports = { readDb, writeDb, getNextId };
