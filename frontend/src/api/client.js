const API_BASE = '/api';

/**
 * Helper to handle fetch responses and handle JSON parsing and errors.
 */
async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  
  // Set JSON headers by default
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // If token is stored in localStorage, inject it
  const token = localStorage.getItem('admin_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (e) {
      errorData = { detail: response.statusText };
    }
    throw new Error(errorData.detail || 'API request failed');
  }

  // Handle case where body might be empty or 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const apiClient = {
  // Health
  checkHealth: () => request('/health'),

  // Public / Gameplay Endpoints
  getHunt: (slug) => request(`/hunts/${slug}`),
  
  createSession: (huntId) => request('/sessions', {
    method: 'POST',
    body: JSON.stringify({ hunt_id: huntId })
  }),

  getSession: (deviceToken) => request(`/sessions/${deviceToken}`),

  recordScan: (deviceToken, qrCodeValue) => request('/scans', {
    method: 'POST',
    body: JSON.stringify({ device_token: deviceToken, qr_code_value: qrCodeValue })
  }),

  getProgress: (deviceToken) => request(`/progress/${deviceToken}`),

  getCharacter: (characterId, deviceToken) =>
    request(`/characters/${characterId}?device_token=${encodeURIComponent(deviceToken)}`),

  // Admin Endpoints
  adminLogin: async (email, password) => {
    const data = await request('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data && data.access_token) {
      localStorage.setItem('admin_token', data.access_token);
    }
    return data;
  },

  adminLogout: () => {
    localStorage.removeItem('admin_token');
  },

  getOrganizations: () => request('/admin/organizations'),
  createOrganization: (orgData) => request('/admin/organizations', {
    method: 'POST',
    body: JSON.stringify(orgData)
  }),

  getAdminHunts: () => request('/admin/hunts'),
  createHunt: (huntData) => request('/admin/hunts', {
    method: 'POST',
    body: JSON.stringify(huntData)
  }),
  updateHunt: (huntData) => request('/admin/hunts', {
    method: 'PATCH',
    body: JSON.stringify(huntData)
  }),
  getHuntStats: (huntId) => request(`/admin/hunts/${huntId}/stats`),

  getAdminCharacters: (huntId) => request(`/admin/characters?hunt_id=${huntId}`),
  createCharacter: (charData) => request('/admin/characters', {
    method: 'POST',
    body: JSON.stringify(charData)
  }),
  updateCharacter: (charData) => request('/admin/characters', {
    method: 'PATCH',
    body: JSON.stringify(charData)
  }),
  deleteCharacter: (charId) => request(`/admin/characters?character_id=${charId}`, {
    method: 'DELETE'
  }),

  createRewardTier: (tierData) => request('/admin/reward-tiers', {
    method: 'POST',
    body: JSON.stringify(tierData)
  })
};
