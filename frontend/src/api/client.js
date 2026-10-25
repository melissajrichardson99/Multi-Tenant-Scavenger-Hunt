const API_BASE = '/api';

/**
 * Decodes the payload of a JWT without verifying its signature — fine for
 * reading non-sensitive claims client-side (e.g. is this admin a super-admin),
 * since the server independently enforces authorization on every request.
 */
function decodeTokenPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

/**
 * Helper to handle fetch responses and handle JSON parsing and errors.
 */
async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;

  // Set JSON headers by default, except for FormData bodies (e.g. file
  // uploads) — the browser needs to set its own multipart boundary in
  // Content-Type, so we must not override it.
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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
    const error = new Error(errorData.detail || 'API request failed');
    error.status = response.status;
    throw error;
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
  getActiveHunts: () => request('/hunts'),
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

  lookupHuntByCode: (code) => request(`/characters/lookup-hunt?code=${encodeURIComponent(code)}`),

  getCharacter: (characterId, deviceToken) =>
    request(`/characters/${characterId}?device_token=${encodeURIComponent(deviceToken)}`),

  getTrivia: (characterId, deviceToken) =>
    request(`/characters/${characterId}/trivia?device_token=${encodeURIComponent(deviceToken)}`),

  answerTrivia: (characterId, deviceToken, answer) => request(`/characters/${characterId}/trivia/answer`, {
    method: 'POST',
    body: JSON.stringify({ device_token: deviceToken, answer })
  }),

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

  // Reads the current admin's claims off the stored JWT. organization_id is
  // null for super-admins (see AdminUser model / create_access_token).
  getCurrentAdminClaims: () => {
    const token = localStorage.getItem('admin_token');
    return token ? decodeTokenPayload(token) : null;
  },

  getOrganizations: () => request('/admin/organizations'),
  createOrganization: (orgData) => request('/admin/organizations', {
    method: 'POST',
    body: JSON.stringify(orgData)
  }),
  updateOrganization: (orgData) => request('/admin/organizations', {
    method: 'PATCH',
    body: JSON.stringify(orgData)
  }),

  getAdminUsers: () => request('/admin/admin-users'),
  createAdminUser: (adminData) => request('/admin/admin-users', {
    method: 'POST',
    body: JSON.stringify(adminData)
  }),
  deactivateAdminUser: (adminUserId) => request(`/admin/admin-users/${adminUserId}/deactivate`, {
    method: 'PATCH'
  }),
  reactivateAdminUser: (adminUserId) => request(`/admin/admin-users/${adminUserId}/reactivate`, {
    method: 'PATCH'
  }),

  changePassword: (currentPassword, newPassword) => request('/admin/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
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

  // Returns a PDF Blob (not JSON), so this bypasses the request() helper.
  printQrCodes: async (huntId) => {
    const token = localStorage.getItem('admin_token');
    const response = await fetch(`${API_BASE}/admin/hunts/${huntId}/print-qr-codes`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { detail: response.statusText };
      }
      const error = new Error(errorData.detail || 'Failed to generate QR code PDF');
      error.status = response.status;
      throw error;
    }

    return response.blob();
  },

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
  uploadCharacterImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/admin/characters/upload-image', {
      method: 'POST',
      body: formData,
    });
  }
};
