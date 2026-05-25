// Unified API Service for Yoda SharePoint Admin Panel
const BASE_URL = ''; // Proxied through Vite in development (/v1/...)

// Storage keys
const TOKEN_KEY = 'yoda_auth_token';
const USER_KEY = 'yoda_user_profile';

const backendURL = "https://nodejs-production-30a6.up.railway.app"

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
export const setAuthToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeAuthToken = () => localStorage.removeItem(TOKEN_KEY);

export const getUserProfile = () => {
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
};
export const setUserProfile = (profile) => localStorage.setItem(USER_KEY, JSON.stringify(profile));
export const removeUserProfile = () => localStorage.removeItem(USER_KEY);

export const getActiveProject = () => {
  const proj = localStorage.getItem('yoda_active_project');
  return proj ? JSON.parse(proj) : null;
};
export const setActiveProject = (project) => localStorage.setItem('yoda_active_project', JSON.stringify(project));
export const removeActiveProject = () => localStorage.removeItem('yoda_active_project');

export const getRoleName = (roleId) => {
  switch (Number(roleId)) {
    case 1: return 'Administrator';
    case 2: return 'Editor';
    case 3: return 'Viewer';
    default: return 'Guest';
  }
};

/**
 * Base fetch client wrapper
 */
async function client(endpoint, { body, ...customConfig } = {}) {
  const token = getAuthToken();
  const activeProject = getActiveProject();
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (activeProject) {
    headers['X-Project-Id'] = activeProject.id;
  }

  // Generate simple random UUID for Idempotency-Key if creating a new resource
  if (customConfig.method === 'POST' && !endpoint.includes('/auth/') && !endpoint.includes('/registry/')) {
    headers['Idempotency-Key'] = `idem-${Math.random().toString(36).substring(2, 15)}`;
  }

  const config = {
    method: body ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      ...headers,
      ...customConfig.headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(endpoint, config);
    
    // Check if token expired or unauthorized
    if (response.status === 401) {
      removeAuthToken();
      removeUserProfile();
      // Only reload if we were previously logged in to prevent loop
      if (token) {
        window.location.reload();
      }
      throw new Error('Session expired. Please log in again.');
    }

    const result = await response.json();
    
    if (response.ok && result.success) {
      return result;
    } else {
      // API error structure
      const errorMsg = result.error?.message || result.error || 'Something went wrong';
      const err = new Error(errorMsg);
      err.status = response.status;
      err.details = result.error?.details || null;
      throw err;
    }
  } catch (error) {
    if (!error.status) {
      error.message = 'Network error. Please make sure the backend server is running.';
    }
    throw error;
  }
}

// API endpoint methods
export const api = {
  // Auth
  auth: {
    login: async (email, password) => {
      const res = await client(`${backendURL}/v1/auth/login`, {
        method: 'POST',
        body: { email, password },
      });
      if (res.data?.access_token) {
        setAuthToken(res.data.access_token);
        setUserProfile(res.data.user);
      }
      return res.data.user;
    },
    register: async (email, password, full_name) => {
      const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');
      return client(`${backendURL}/v1/auth/register`, {
        method: 'POST',
        body: { 
          email, 
          password, 
          display_name: full_name,
          username: username.length >= 3 ? username : `user_${Math.random().toString(36).substring(2, 7)}`
        },
      });
    },
    logout: async () => {
      try {
        await client(`${backendURL}/v1/auth/logout`, { method: 'POST' });
      } catch (e) {
        console.warn('Logout endpoint failed', e);
      } finally {
        removeAuthToken();
        removeUserProfile();
      }
    }
  },

  // Tables Schema Registry
  registry: {
    listTables: async () => {
      const res = await client(`${backendURL}/v1/registry/tables`);
      return (res.data || []).map(t => ({ ...t, name: t.table_name }));
    },
    getTableSchema: async (tableId) => {
      const res = await client(`${backendURL}/v1/registry/tables/${tableId}`);
      if (res.data) {
        res.data.name = res.data.table_name;
        if (res.data.columns && Array.isArray(res.data.columns)) {
          res.data.columns = res.data.columns.map(c => ({
            ...c,
            name: c.column_name
          }));
        }
      }
      return res.data;
    },
    createTable: async (schema) => {
      const res = await client(`${backendURL}/v1/registry/tables`, {
        method: 'POST',
        body: schema,
      });
      if (res.data) {
        res.data.name = res.data.table_name;
        if (res.data.columns && Array.isArray(res.data.columns)) {
          res.data.columns = res.data.columns.map(c => ({
            ...c,
            name: c.column_name
          }));
        }
      }
      return res.data;
    },
    addColumn: async (tableId, columnDef) => {
      const res = await client(`${backendURL}/v1/registry/tables/${tableId}/columns`, {
        method: 'POST',
        body: columnDef,
      });
      return res.data;
    },
    deleteColumn: async (tableId, columnName) => {
      const res = await client(`${backendURL}/v1/registry/tables/${tableId}/columns/${columnName}`, {
        method: 'DELETE',
      });
      return res.data;
    },
    deleteTable: async (tableId) => {
      const res = await client(`${backendURL}/v1/registry/tables/${tableId}`, {
        method: 'DELETE',
      });
      return res.data;
    }
  },

  // Dynamic Records DML
  records: {
    list: async (tableName, params = {}) => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParams.append(key, val);
        }
      });
      
      const queryString = queryParams.toString();
      const endpoint = `${backendURL}/v1/${tableName}${queryString ? `?${queryString}` : ''}`;
      const res = await client(endpoint);
      return res; // Return full response since we need both data and meta (pagination info!)
    },
    get: async (tableName, recordId) => {
      const res = await client(`${backendURL}/v1/${tableName}/${recordId}`);
      return res.data;
    },
    create: async (tableName, recordData) => {
      const res = await client(`${backendURL}/v1/${tableName}`, {
        method: 'POST',
        body: recordData,
      });
      return res.data;
    },
    update: async (tableName, recordId, recordData, currentVersion) => {
      const headers = {};
      if (currentVersion !== undefined) {
        headers['If-Match'] = String(currentVersion);
      }
      const res = await client(`${backendURL}/v1/${tableName}/${recordId}`, {
        method: 'PATCH',
        headers,
        body: recordData,
      });
      return res.data;
    },
    delete: async (tableName, recordId, hard = false) => {
      const res = await client(`${backendURL}/v1/${tableName}/${recordId}${hard ? '?hard=true' : ''}`, {
        method: 'DELETE',
      });
      return res.data;
    },
    restore: async (tableName, recordId) => {
      const res = await client(`${backendURL}/v1/${tableName}/${recordId}/restore`, {
        method: 'POST',
      });
      return res.data;
    },
    
    // History Time-Machine
    getHistory: async (tableName, recordId) => {
      const res = await client(`${backendURL}/v1/${tableName}/${recordId}/history`);
      return res.data || [];
    },
    getHistoryVersion: async (tableName, recordId, versionNumber) => {
      const res = await client(`${backendURL}/v1/${tableName}/${recordId}/history/${versionNumber}`);
      return res.data;
    }
  },

  // Projects
  projects: {
    list: async () => {
      const res = await client(`${backendURL}/v1/projects`);
      return res.data || [];
    },
    create: async (payload) => {
      const res = await client(`${backendURL}/v1/projects`, {
        method: 'POST',
        body: payload
      });
      return res.data;
    },
    listUsers: async (projectId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/users`);
      return res.data || [];
    },
    addUser: async (projectId, payload) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/users`, {
        method: 'POST',
        body: payload
      });
      return res.data;
    },
    removeUser: async (projectId, userId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/users/${userId}`, {
        method: 'DELETE'
      });
      return res.data;
    },
    getLogs: async (projectId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/logs`);
      return res.data || [];
    },
    getBlocks: async (projectId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/blocks`);
      return res.data || [];
    },
    unblockUser: async (projectId, userId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/blocks/${userId}`, {
        method: 'DELETE'
      });
      return res.data;
    },
    updateSettings: async (projectId, whitelistedDomains) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/settings`, {
        method: 'PATCH',
        body: { whitelisted_domains: whitelistedDomains }
      });
      return res.data;
    },
    listDocuments: async (projectId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/documents`);
      return res.data || [];
    },
    uploadDocument: async (projectId, docData) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/documents`, {
        method: 'POST',
        body: docData
      });
      return res.data;
    },
    downloadDocument: async (projectId, documentId) => {
      const token = getAuthToken();
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      headers['X-Project-Id'] = projectId;
      
      const response = await fetch(`${backendURL}/v1/projects/${projectId}/documents/${documentId}`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error('Failed to download secure document');
      }
      
      return response.blob();
    },
    delete: async (projectId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}`, {
        method: 'DELETE'
      });
      return res.data;
    },
    deleteDocument: async (projectId, documentId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/documents/${documentId}`, {
        method: 'DELETE'
      });
      return res.data;
    }
  },

  // Admin & Developer Tools
  admin: {
    executeSQL: async (projectId, query) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/admin/sql`, {
        method: 'POST',
        body: { query }
      });
      return res.data;
    },
    listWebhooks: async (projectId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/admin/webhooks`);
      return res.data || [];
    },
    createWebhook: async (projectId, webhookDef) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/admin/webhooks`, {
        method: 'POST',
        body: webhookDef
      });
      return res.data;
    },
    deleteWebhook: async (projectId, webhookId) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/admin/webhooks/${webhookId}`, {
        method: 'DELETE'
      });
      return res.data;
    },
    sendEmail: async (projectId, emailDef) => {
      const res = await client(`${backendURL}/v1/projects/${projectId}/admin/email`, {
        method: 'POST',
        body: emailDef
      });
      return res.data;
    }
  }
};
