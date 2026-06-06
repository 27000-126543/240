import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { db } from './db/sqlite';
import { taskRoutes } from './routes/taskRoutes';
import { batchRoutes } from './routes/batchRoutes';
import { warningRoutes } from './routes/warningRoutes';
import { approvalRoutes } from './routes/approvalRoutes';
import { reportRoutes } from './routes/reportRoutes';
import { recommendationRoutes } from './routes/recommendationRoutes';
import { dashboardRoutes } from './routes/dashboardRoutes';
import { simulationEngine } from './services/simulationEngine';
import { dailyStatsService } from './services/dailyStatsService';
import { recommendationEngine } from './services/recommendationEngine';

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

async function startServer() {
  try {
    await db.init();
    console.log('SQLite database initialized successfully');
    
    await dailyStatsService.ensureTodayStats();
    console.log('Daily stats initialized');
    
    await recommendationEngine.ensureDefaultRecommendations();
    console.log('Recommendations initialized');
    
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`WebSocket server ready`);
      console.log(`API base: http://localhost:${PORT}/api`);
    });
    
    simulationEngine.initialize(io);
    console.log('Simulation engine started');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };
