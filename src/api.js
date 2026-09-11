import { API_BASE_URL } from './config.js'

let authToken = null

export function setAuthToken(token) {
  authToken = token || null
}

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `Request failed with status ${res.status}`)
  }

  const body = await res.json()
  return body.data
}

export const api = {
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getServers: () => request('/servers'),
  getServer: (id) => request(`/servers/${id}`),
  createServer: (payload) =>
    request('/servers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getCatalogs: () => request('/catalogs'),
  getTextChannels: () => request('/text-channels'),
  getVoiceChannels: () => request('/voice-channels'),
  getUsers: () => request('/users'),
  getMessagesByChannel: (channelId) => request(`/messages-group/channel/${channelId}`),
  sendMessage: (payload) =>
    request('/messages-group', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createTextChannel: (title) =>
    request('/text-channels', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  createVoiceChannel: (title) =>
    request('/voice-channels', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  updateTextChannel: (id, title) =>
    request(`/text-channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteTextChannel: (id) =>
    request(`/text-channels/${id}`, {
      method: 'DELETE',
    }),
  updateVoiceChannel: (id, title) =>
    request(`/voice-channels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteVoiceChannel: (id) =>
    request(`/voice-channels/${id}`, {
      method: 'DELETE',
    }),
  getCatalog: (id) => request(`/catalogs/${id}`),
  updateCatalog: (id, payload) =>
    request(`/catalogs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getFriendshipsByUser: (userId) => request(`/friendships/user/${userId}`),
  sendFriendRequest: (senderId, receiverId) =>
    request('/friendships', {
      method: 'POST',
      body: JSON.stringify({ senderId, receiverId }),
    }),
  respondFriendRequest: (id, status) =>
    request(`/friendships/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteFriendship: (id) =>
    request(`/friendships/${id}`, {
      method: 'DELETE',
    }),
}
