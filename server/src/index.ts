import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { db } from './db/database';
import { taskRoutes } from './routes/taskRoutes';
import { batchRoutes } from './routes/batchRoutes';
import { warningRoutes } from './routes/warningRoutes';
import { approvalRoutes } from './routes/approvalRoutes';
import { reportRoutes } from './routes/reportRoutes';
import { recommendationRoutes } from './routes/recommendationRoutes';
import { dashboardRoutes } from './routes/dashboardRoutes';
import { simulationEngine } from './services/simulationEngine';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/tasks', taskRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/warnings', warningRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/dashboard', dashboardRoutes);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3002;

console.log('JSON database loaded successfully');

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

simulationEngine.initialize(io);

export { io };
