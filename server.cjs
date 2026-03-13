require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// ============================
// SOCKET.IO SETUP
// ============================
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Make io accessible in routes
app.set('io', io);

// ============================
// MIDDLEWARE
// ============================
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 10mb for base64 photos
app.use(express.urlencoded({ extended: true }));

// ============================
// API ROUTES
// ============================
app.use('/api/auth',        require('./server/routes/auth.cjs'));
app.use('/api/employees',   require('./server/routes/employees.cjs'));
app.use('/api/devices',     require('./server/routes/devices.cjs'));
app.use('/api/logs',        require('./server/routes/logs.cjs'));
app.use('/api/visitors',    require('./server/routes/visitors.cjs'));
app.use('/api/vendors',     require('./server/routes/vendors.cjs'));
app.use('/api/users',       require('./server/routes/users.cjs'));
app.use('/api/audit',       require('./server/routes/audit.cjs'));

// ============================
// SERVE FRONTEND
// ============================
app.use(express.static(path.join(__dirname, 'dist')));

// All non-API routes serve the React app
// All non-API routes serve the React app
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
// ============================
// HEALTH CHECK
// ============================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Minet LAP Tracker API is running' });
});

// ============================
// START SERVER
// ============================
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Minet LAP Tracker running on http://localhost:${PORT}`);
});