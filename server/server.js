const express = require('express');
const cors = require('cors');
const dayjs = require('dayjs');
const path = require('path');
const { readDb, writeDb, getNextId } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function generateBookingNo() {
  const now = dayjs();
  const dateStr = now.format('YYYYMMDDHHmmss');
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BK${dateStr}${rand}`;
}

function checkVaccineValid(expiryDate) {
  if (!expiryDate) return false;
  return dayjs(expiryDate).isAfter(dayjs());
}

function isDateOverlapping(aStart, aEnd, bStart, bEnd) {
  return dayjs(aStart).isBefore(dayjs(bEnd)) && dayjs(aEnd).isAfter(dayjs(bStart));
}

function getActiveBookings(db, roomId, excludeBookingId = null) {
  return db.bookings.filter(b =>
    b.room_id === roomId &&
    ['active', 'overdue'].includes(b.status) &&
    (excludeBookingId === null || b.id !== excludeBookingId)
  );
}

function checkPetAvailability(db, petId, checkInDate, checkOutDate, excludeBookingId = null) {
  const petActiveBookings = db.bookings.filter(b =>
    b.pet_id === petId &&
    ['active', 'overdue'].includes(b.status) &&
    (excludeBookingId === null || b.id !== excludeBookingId)
  );

  for (const b of petActiveBookings) {
    const actualCheckOut = b.actual_check_out ? b.actual_check_out : b.check_out_date;
    if (dayjs(b.check_in_date).isBefore(dayjs(checkOutDate)) &&
        dayjs(actualCheckOut).isAfter(dayjs(checkInDate))) {
      return {
        available: false,
        message: `该宠物在 ${dayjs(b.check_in_date).format('MM-DD')} 至 ${dayjs(actualCheckOut).format('MM-DD')} 期间已有寄养预约`
      };
    }
  }
  return { available: true, message: '可预订' };
}

function checkRoomAvailability(db, roomId, checkInDate, checkOutDate, excludeBookingId = null) {
  const room = db.rooms.find(r => r.id === roomId);
  if (!room) return { available: false, message: '房间不存在' };
  if (room.status === 'maintenance') return { available: false, message: '房间正在维护' };

  const today = dayjs().format('YYYY-MM-DD');
  const activeBookings = getActiveBookings(db, roomId, excludeBookingId);

  let occupiedCount = 0;
  for (const b of activeBookings) {
    const actualCheckOut = b.actual_check_out ? b.actual_check_out : b.check_out_date;
    if (dayjs(b.check_in_date).isBefore(dayjs(checkOutDate)) &&
        dayjs(actualCheckOut).isAfter(dayjs(checkInDate))) {
      occupiedCount++;
    }
  }

  return {
    available: occupiedCount < room.capacity,
    message: occupiedCount >= room.capacity ? '该时间段房间已被占用' : '可预订'
  };
}

function getRoomRealtimeStatus(db, room) {
  if (room.status === 'maintenance') return 'maintenance';
  const today = dayjs().format('YYYY-MM-DD');
  const activeBookings = getActiveBookings(db, room.id);
  const currentCount = activeBookings.filter(b => {
    const actualCheckOut = b.actual_check_out ? b.actual_check_out : b.check_out_date;
    return dayjs(b.check_in_date).isBefore(dayjs(today).add(1, 'day')) &&
           dayjs(actualCheckOut).isAfter(dayjs(today));
  }).length;
  return currentCount >= room.capacity ? 'occupied' : 'available';
}

function generateReminders() {
  const db = readDb();
  const today = dayjs();
  const todayStr = today.format('YYYY-MM-DD');

  const activeBookings = db.bookings.filter(b => ['active', 'overdue'].includes(b.status));

  for (const booking of activeBookings) {
    const pet = db.pets.find(p => p.id === booking.pet_id);
    const room = db.rooms.find(r => r.id === booking.room_id);
    if (!pet || !room) continue;

    const checkOutDate = dayjs(booking.check_out_date);
    const daysToCheckout = checkOutDate.diff(today, 'day');

    if (daysToCheckout < 0 && booking.status === 'active') {
      booking.status = 'overdue';
    }

    const reminderExists = (type) => db.reminders.some(r =>
      r.booking_id === booking.id && r.type === type && r.reminder_date === todayStr
    );

    if (daysToCheckout < 0 && !reminderExists('overdue')) {
      db.reminders.push({
        id: getNextId(db.reminders),
        booking_id: booking.id,
        pet_id: booking.pet_id,
        type: 'overdue',
        title: `⚠️ ${pet.name} 寄养已超期`,
        message: `${pet.name}（${room.name}）已超过预定接回时间 ${Math.abs(daysToCheckout)} 天，请联系主人 ${pet.owner_name}（${pet.owner_phone}）确认续住或接回。`,
        is_read: 0,
        reminder_date: todayStr,
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });
    }

    if (daysToCheckout === 0 && !reminderExists('checkout_today')) {
      db.reminders.push({
        id: getNextId(db.reminders),
        booking_id: booking.id,
        pet_id: booking.pet_id,
        type: 'checkout_today',
        title: `📅 ${pet.name} 今日需要接回`,
        message: `${pet.name}（${room.name}）今日是预定接回日期，请提前准备好物品并联系主人 ${pet.owner_name}（${pet.owner_phone}）。`,
        is_read: 0,
        reminder_date: todayStr,
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
      });
    }

    if (pet.vaccine_expiry_date) {
      const vaccineExpiry = dayjs(pet.vaccine_expiry_date);
      const daysToVaccineExpiry = vaccineExpiry.diff(today, 'day');

      if (daysToVaccineExpiry < 0 && !reminderExists('vaccine_expired')) {
        db.reminders.push({
          id: getNextId(db.reminders),
          booking_id: booking.id,
          pet_id: booking.pet_id,
          type: 'vaccine_expired',
          title: `💉 ${pet.name} 疫苗已过期`,
          message: `${pet.name}（${room.name}）的疫苗已于 ${pet.vaccine_expiry_date} 过期，请提醒主人 ${pet.owner_name}（${pet.owner_phone}）尽快补打。`,
          is_read: 0,
          reminder_date: todayStr,
          created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
        });
      } else if (daysToVaccineExpiry <= 7 && daysToVaccineExpiry >= 0 && !reminderExists('vaccine_soon')) {
        db.reminders.push({
          id: getNextId(db.reminders),
          booking_id: booking.id,
          pet_id: booking.pet_id,
          type: 'vaccine_soon',
          title: `💉 ${pet.name} 疫苗即将到期`,
          message: `${pet.name}（${room.name}）的疫苗将在 ${daysToVaccineExpiry} 天后（${pet.vaccine_expiry_date}）过期，请提前提醒主人。`,
          is_read: 0,
          reminder_date: todayStr,
          created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
        });
      }
    }
  }

  writeDb(db);
}

function enrichBooking(db, booking) {
  const pet = db.pets.find(p => p.id === booking.pet_id);
  const room = db.rooms.find(r => r.id === booking.room_id);
  return {
    ...booking,
    pet_name: pet?.name,
    species: pet?.species,
    breed: pet?.breed,
    owner_name: pet?.owner_name,
    owner_phone: pet?.owner_phone,
    vaccine_expiry_date: pet?.vaccine_expiry_date,
    vaccine_valid: pet?.vaccine_valid,
    room_name: room?.name,
    room_type: room?.type
  };
}

app.get('/api/stats', (req, res) => {
  generateReminders();
  const db = readDb();
  const today = dayjs().format('YYYY-MM-DD');

  const activeBookings = db.bookings.filter(b =>
    ['active', 'overdue'].includes(b.status) &&
    dayjs(b.check_in_date).isBefore(dayjs(today).add(1, 'day')) &&
    (!b.actual_check_out || dayjs(b.actual_check_out).isAfter(dayjs(today)))
  );

  const activeRoomIds = [...new Set(activeBookings.map(b => b.room_id))];
  const totalRooms = db.rooms.filter(r => r.status !== 'maintenance').length;

  const todayCheckout = db.bookings.filter(b =>
    ['active', 'overdue'].includes(b.status) &&
    dayjs(b.check_out_date).format('YYYY-MM-DD') === today
  ).length;

  const overdueBookings = db.bookings.filter(b => b.status === 'overdue').length;

  const vaccineWarnings = activeBookings.filter(b => {
    const pet = db.pets.find(p => p.id === b.pet_id);
    return !pet || !pet.vaccine_valid;
  }).length;

  res.json({
    totalActive: activeBookings.length,
    totalRooms,
    occupiedRooms: activeRoomIds.length,
    availableRooms: totalRooms - activeRoomIds.length,
    todayCheckout,
    overdueBookings,
    vaccineWarnings
  });
});

app.get('/api/rooms', (req, res) => {
  const db = readDb();
  const { type } = req.query;
  let rooms = [...db.rooms];
  if (type) rooms = rooms.filter(r => r.type === type);
  rooms.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.name.localeCompare(b.name);
  });
  rooms = rooms.map(r => ({
    ...r,
    realtime_status: getRoomRealtimeStatus(db, r)
  }));
  res.json(rooms);
});

app.get('/api/rooms/available', (req, res) => {
  const db = readDb();
  const { check_in, check_out, type } = req.query;
  if (!check_in || !check_out) {
    return res.status(400).json({ error: '请提供入住和离店日期' });
  }

  let rooms = db.rooms.filter(r => r.status !== 'maintenance');
  if (type) rooms = rooms.filter(r => r.type === type);

  const availableRooms = rooms.map(room => {
    const check = checkRoomAvailability(db, room.id, check_in, check_out);
    return { ...room, available: check.available, message: check.message };
  });

  res.json(availableRooms);
});

app.get('/api/pets', (req, res) => {
  const db = readDb();
  const pets = [...db.pets].sort((a, b) =>
    dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf()
  );
  res.json(pets);
});

app.post('/api/pets', (req, res) => {
  const db = readDb();
  const { name, species, breed, age, weight, gender, owner_name, owner_phone, vaccine_expiry_date, notes } = req.body;

  if (!name || !species || !owner_name || !owner_phone) {
    return res.status(400).json({ error: '请填写必填项：宠物名、种类、主人姓名、电话' });
  }

  const vaccineValid = checkVaccineValid(vaccine_expiry_date) ? 1 : 0;
  const pet = {
    id: getNextId(db.pets),
    name, species, breed, age, weight, gender,
    owner_name, owner_phone, vaccine_expiry_date, vaccine_valid: vaccineValid,
    notes,
    created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
  };
  db.pets.push(pet);
  writeDb(db);
  res.json({ id: pet.id, message: '宠物信息已登记' });
});

app.get('/api/bookings', (req, res) => {
  generateReminders();
  const db = readDb();
  const { status } = req.query;
  let bookings = db.bookings.map(b => enrichBooking(db, b));
  if (status) bookings = bookings.filter(b => b.status === status);
  bookings.sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
  res.json(bookings);
});

app.get('/api/bookings/:id', (req, res) => {
  generateReminders();
  const db = readDb();
  const booking = db.bookings.find(b => b.id === Number(req.params.id));
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  const pet = db.pets.find(p => p.id === booking.pet_id);
  const room = db.rooms.find(r => r.id === booking.room_id);
  const records = db.daily_records
    .filter(r => r.booking_id === booking.id)
    .sort((a, b) => dayjs(b.record_date).valueOf() - dayjs(a.record_date).valueOf());

  res.json({
    ...booking,
    ...pet,
    room_name: room?.name,
    room_type: room?.type,
    room_desc: room?.description,
    records
  });
});

app.post('/api/bookings', (req, res) => {
  const db = readDb();
  const {
    pet_id, room_id, check_in_date, check_out_date,
    medication, grooming, pickup_service, pickup_time, dropoff_time,
    notes, pet_info
  } = req.body;

  if (!pet_id || !room_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: '请填写必填项：宠物、房间、入住日期、离店日期' });
  }

  if (dayjs(check_out_date).isBefore(dayjs(check_in_date))) {
    return res.status(400).json({ error: '离店日期不能早于入住日期' });
  }

  const availability = checkRoomAvailability(db, room_id, check_in_date, check_out_date);
  if (!availability.available) {
    return res.status(400).json({ error: availability.message });
  }

  let finalPetId = pet_id;
  if (pet_id === 'new' && pet_info) {
    if (!pet_info.name || !pet_info.species || !pet_info.owner_name || !pet_info.owner_phone) {
      return res.status(400).json({ error: '新宠物信息不完整' });
    }
    const vaccineValid = checkVaccineValid(pet_info.vaccine_expiry_date) ? 1 : 0;
    finalPetId = getNextId(db.pets);
    db.pets.push({
      id: finalPetId,
      name: pet_info.name,
      species: pet_info.species,
      breed: pet_info.breed,
      age: pet_info.age,
      weight: pet_info.weight,
      gender: pet_info.gender,
      owner_name: pet_info.owner_name,
      owner_phone: pet_info.owner_phone,
      vaccine_expiry_date: pet_info.vaccine_expiry_date,
      vaccine_valid: vaccineValid,
      notes: pet_info.notes,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
  }

  const pet = db.pets.find(p => p.id === (typeof finalPetId === 'string' ? Number(finalPetId) : finalPetId));
  if (!pet) {
    return res.status(400).json({ error: '宠物不存在' });
  }

  const petAvailability = checkPetAvailability(db, pet.id, check_in_date, check_out_date);
  if (!petAvailability.available) {
    return res.status(400).json({ error: petAvailability.message });
  }

  const room = db.rooms.find(r => r.id === Number(room_id));
  if (!room) {
    return res.status(400).json({ error: '房间不存在' });
  }
  if (room.type !== pet.species) {
    return res.status(400).json({ error: `${room.type === 'cat' ? '猫房' : '犬舍'}不能用于${pet.species === 'cat' ? '猫咪' : '狗狗'}` });
  }

  const bookingNo = generateBookingNo();
  const nights = dayjs(check_out_date).diff(dayjs(check_in_date), 'day');
  const basePrice = room.type === 'cat' ? 80 : 120;
  let total_price = nights * basePrice * (room.name.includes('VIP') ? 1.5 : 1);
  if (grooming) total_price += 150;
  if (pickup_service) total_price += 80;

  const bookingId = getNextId(db.bookings);
  const booking = {
    id: bookingId,
    booking_no: bookingNo,
    pet_id: typeof finalPetId === 'string' ? Number(finalPetId) : finalPetId,
    room_id: Number(room_id),
    check_in_date,
    check_out_date,
    actual_check_out: null,
    status: 'active',
    medication: medication || '',
    grooming: grooming ? 1 : 0,
    pickup_service: pickup_service ? 1 : 0,
    pickup_time: pickup_time || '',
    dropoff_time: dropoff_time || '',
    total_price,
    notes: notes || '',
    created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
  };
  db.bookings.push(booking);
  writeDb(db);
  generateReminders();

  const updatedDb = readDb();
  const updatedPet = updatedDb.pets.find(p => p.id === booking.pet_id);

  res.json({
    id: bookingId,
    booking_no: bookingNo,
    message: '预约创建成功',
    total_price,
    vaccine_warning: !updatedPet.vaccine_valid ? '疫苗已过期，请提醒主人及时补打' : null
  });
});

app.post('/api/bookings/:id/checkout', (req, res) => {
  const db = readDb();
  const booking = db.bookings.find(b => b.id === Number(req.params.id));
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  booking.status = 'completed';
  booking.actual_check_out = dayjs().format('YYYY-MM-DD HH:mm:ss');
  writeDb(db);
  generateReminders();
  res.json({ message: '已完成结账，房间已释放' });
});

app.post('/api/bookings/:id/cancel', (req, res) => {
  const db = readDb();
  const booking = db.bookings.find(b => b.id === Number(req.params.id));
  if (!booking) {
    return res.status(404).json({ error: '预约不存在' });
  }
  booking.status = 'cancelled';
  writeDb(db);
  res.json({ message: '预约已取消' });
});

app.get('/api/daily-records/today', (req, res) => {
  const db = readDb();
  const today = dayjs().format('YYYY-MM-DD');
  const records = db.daily_records
    .filter(r => r.record_date === today)
    .map(r => {
      const booking = db.bookings.find(b => b.id === r.booking_id);
      const pet = booking ? db.pets.find(p => p.id === booking.pet_id) : null;
      const room = booking ? db.rooms.find(rm => rm.id === booking.room_id) : null;
      return {
        ...r,
        booking_no: booking?.booking_no,
        pet_name: pet?.name,
        room_name: room?.name,
        owner_name: pet?.owner_name
      };
    })
    .sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf());
  res.json(records);
});

app.get('/api/bookings/:id/records', (req, res) => {
  const db = readDb();
  const records = db.daily_records
    .filter(r => r.booking_id === Number(req.params.id))
    .sort((a, b) => dayjs(b.record_date).valueOf() - dayjs(a.record_date).valueOf());
  res.json(records);
});

app.post('/api/daily-records', (req, res) => {
  const db = readDb();
  const { booking_id, feeding, walking, abnormal, staff_name, return_confirmed } = req.body;
  if (!booking_id) {
    return res.status(400).json({ error: '请选择预约记录' });
  }
  const today = dayjs().format('YYYY-MM-DD');
  const existing = db.daily_records.find(
    r => r.booking_id === Number(booking_id) && r.record_date === today
  );

  if (existing) {
    existing.feeding = feeding || '';
    existing.walking = walking || '';
    existing.abnormal = abnormal || '';
    existing.staff_name = staff_name || '';
    existing.return_confirmed = return_confirmed ? 1 : 0;
    writeDb(db);
    res.json({ id: existing.id, message: '今日记录已更新' });
  } else {
    const record = {
      id: getNextId(db.daily_records),
      booking_id: Number(booking_id),
      record_date: today,
      feeding: feeding || '',
      walking: walking || '',
      abnormal: abnormal || '',
      staff_name: staff_name || '',
      return_confirmed: return_confirmed ? 1 : 0,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    };
    db.daily_records.push(record);
    writeDb(db);
    res.json({ id: record.id, message: '今日记录已创建' });
  }
});

app.get('/api/reminders', (req, res) => {
  generateReminders();
  const db = readDb();
  const reminders = [...db.reminders]
    .sort((a, b) => {
      if (a.is_read !== b.is_read) return a.is_read - b.is_read;
      return dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf();
    })
    .slice(0, 100)
    .map(r => {
      const booking = db.bookings.find(b => b.id === r.booking_id);
      const pet = db.pets.find(p => p.id === r.pet_id);
      return {
        ...r,
        booking_no: booking?.booking_no,
        pet_name: pet?.name
      };
    });
  res.json(reminders);
});

app.get('/api/reminders/unread-count', (req, res) => {
  generateReminders();
  const db = readDb();
  const count = db.reminders.filter(r => r.is_read === 0).length;
  res.json({ count });
});

app.post('/api/reminders/:id/read', (req, res) => {
  const db = readDb();
  const reminder = db.reminders.find(r => r.id === Number(req.params.id));
  if (reminder) {
    reminder.is_read = 1;
    writeDb(db);
  }
  res.json({ message: '已标记为已读' });
});

app.post('/api/reminders/read-all', (req, res) => {
  const db = readDb();
  db.reminders.forEach(r => { r.is_read = 1; });
  writeDb(db);
  res.json({ message: '全部标记为已读' });
});

generateReminders();

const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuildPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`宠物寄养系统已启动: http://localhost:${PORT}`);
  console.log(`前端页面: http://localhost:${PORT}`);
  console.log(`后端API: http://localhost:${PORT}/api`);
});
