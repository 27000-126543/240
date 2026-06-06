import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io('http://localhost:3002', {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    this.socket.onAny((event, data) => {
      const handlers = this.listeners.get(event);
      if (handlers) {
        handlers.forEach(handler => handler(data));
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, handler: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    this.connect();
  }

  off(event: string, handler: (data: any) => void) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  onTaskUpdate(handler: (data: { taskId: string; status: string; progress: number }) => void) {
    this.on('task:update', handler);
  }

  offTaskUpdate(handler: (data: { taskId: string; status: string; progress: number }) => void) {
    this.off('task:update', handler);
  }

  onTaskMetrics(taskId: string, handler: (data: any) => void) {
    this.on(`task:${taskId}:metrics`, handler);
  }

  offTaskMetrics(taskId: string, handler: (data: any) => void) {
    this.off(`task:${taskId}:metrics`, handler);
  }

  onNewWarning(handler: (data: any) => void) {
    this.on('warning:new', handler);
  }

  offNewWarning(handler: (data: any) => void) {
    this.off('warning:new', handler);
  }

  onBatchPaused(handler: (data: any) => void) {
    this.on('batch:paused', handler);
  }

  offBatchPaused(handler: (data: any) => void) {
    this.off('batch:paused', handler);
  }
}

export const socketService = new SocketService();
