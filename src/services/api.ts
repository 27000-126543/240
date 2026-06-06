const API_BASE = 'http://localhost:3002/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;
  
  let url = `${API_BASE}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
    ...fetchOptions,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  dashboard: {
    getStats: () => request('/dashboard/stats'),
    getProcessCapability: () => request('/dashboard/process-capability'),
    getWeeklyTrends: () => request('/dashboard/weekly-trends'),
    getActiveTasks: () => request('/dashboard/active-tasks'),
    getRecentWarnings: () => request('/dashboard/recent-warnings'),
  },

  tasks: {
    list: (params?: { batchId?: string; status?: string; page?: number; limit?: number }) => 
      request('/tasks', { params }),
    get: (taskId: string) => request(`/tasks/${taskId}`),
    create: (data: { name: string; batchId: string; parameters?: any }) =>
      request('/tasks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    uploadMask: (taskId: string, file: File) => {
      const formData = new FormData();
      formData.append('maskFile', file);
      return request(`/tasks/${taskId}/upload`, {
        method: 'POST',
        body: formData as any,
        headers: {},
      });
    },
    start: (taskId: string) =>
      request(`/tasks/${taskId}/start`, { method: 'POST' }),
    getMetrics: (taskId: string) => request(`/tasks/${taskId}/metrics`),
    adjustParams: (taskId: string, data: { parameters: any; reason: string; adjustedBy?: string }) =>
      request(`/tasks/${taskId}/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (taskId: string) =>
      request(`/tasks/${taskId}`, { method: 'DELETE' }),
  },

  batches: {
    list: () => request('/batches'),
    get: (batchId: string) => request(`/batches/${batchId}`),
    getTasks: (batchId: string) => request(`/batches/${batchId}/tasks`),
    create: (data: { name?: string }) =>
      request('/batches', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    pause: (batchId: string, reason?: string) =>
      request(`/batches/${batchId}/pause`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      }),
    resume: (batchId: string) =>
      request(`/batches/${batchId}/resume`, { method: 'PUT' }),
  },

  warnings: {
    list: (params?: { acknowledged?: boolean; taskId?: string; type?: string }) =>
      request('/warnings', { params }),
    get: (warningId: string) => request(`/warnings/${warningId}`),
    acknowledge: (warningId: string, data?: { acknowledgedBy?: string; ackComment?: string }) =>
      request(`/warnings/${warningId}/acknowledge`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  approvals: {
    list: (params?: { status?: string; level?: string; taskId?: string }) =>
      request('/approvals', { params }),
    create: (data: { taskId: string; level: string; approver: string }) =>
      request('/approvals', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    decide: (approvalId: string, data: { status: string; comment?: string }) =>
      request(`/approvals/${approvalId}/decide`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    submitEngineer: (approvalId: string, data?: { approver?: string; comment?: string }) =>
      request(`/approvals/${approvalId}/submit-engineer`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  reports: {
    getPdf: (taskId: string) => `${API_BASE}/reports/${taskId}/pdf`,
    export: (taskId: string, params?: { format?: string; dimension?: string }) =>
      request(`/reports/${taskId}/export`, { params }),
  },

  recommendations: {
    list: () => request('/recommendations'),
    generate: () =>
      request('/recommendations/generate', { method: 'POST' }),
    apply: (recId: string) =>
      request(`/recommendations/${recId}/apply`, { method: 'POST' }),
  },
};
