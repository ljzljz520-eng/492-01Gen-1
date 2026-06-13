import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const getStats = () => api.get('/stats').then(r => r.data);

export const getRooms = (type) => api.get('/rooms', { params: { type } }).then(r => r.data);
export const getAvailableRooms = (check_in, check_out, type) =>
  api.get('/rooms/available', { params: { check_in, check_out, type } }).then(r => r.data);

export const getPets = () => api.get('/pets').then(r => r.data);
export const createPet = (data) => api.post('/pets', data).then(r => r.data);

export const getBookings = (status) => api.get('/bookings', { params: { status } }).then(r => r.data);
export const getBooking = (id) => api.get(`/bookings/${id}`).then(r => r.data);
export const createBooking = (data) => api.post('/bookings', data).then(r => r.data);
export const checkoutBooking = (id) => api.post(`/bookings/${id}/checkout`).then(r => r.data);
export const cancelBooking = (id) => api.post(`/bookings/${id}/cancel`).then(r => r.data);

export const getTodayRecords = () => api.get('/daily-records/today').then(r => r.data);
export const getBookingRecords = (bookingId) => api.get(`/bookings/${bookingId}/records`).then(r => r.data);
export const saveDailyRecord = (data) => api.post('/daily-records', data).then(r => r.data);

export const getReminders = () => api.get('/reminders').then(r => r.data);
export const getUnreadCount = () => api.get('/reminders/unread-count').then(r => r.data);
export const markReminderRead = (id) => api.post(`/reminders/${id}/read`).then(r => r.data);
export const markAllRead = () => api.post('/reminders/read-all').then(r => r.data);

export default api;
