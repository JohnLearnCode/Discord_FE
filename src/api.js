import { API_BASE_URL } from './config.js'

const BASE_URL = API_BASE_URL

let authToken = null

export function setAuthToken(token) {
  authToken = token || null
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
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
  getServers: () => request('/servers'),
  getServer: (id) => request(`/servers/${id}`),
  getServerChannels: (id) => request(`/servers/${id}/channels`),
  searchServers: (name) =>
    request(`/servers/search?name=${encodeURIComponent(name)}`),
  joinServer: (id, userId) =>
    request(`/servers/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
  createServer: (payload) =>
    request('/servers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateServer: (id, payload) =>
    request(`/servers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteServer: (id) =>
    request(`/servers/${id}`, {
      method: 'DELETE',
    }),
  getCatalogs: () => request('/catalogs'),
  createCatalog: (title) =>
    request('/catalogs', {
      method: 'POST',
      body: JSON.stringify({ title, channelIds: [] }),
    }),
  getTextChannels: () => request('/text-channels'),
  getVoiceChannels: () => request('/voice-channels'),
  getUsers: () => request('/users'),
  searchUserByUsername: (username) =>
    request(`/users/search?username=${encodeURIComponent(username)}`),
  getFriend: (userId) => request(`/users/${userId}/friends`),
  getConversation: (userId1, userId2) =>
    request(`/messages-p2p/conversation?userId1=${userId1}&userId2=${userId2}`),
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
  deleteCatalog: (id) =>
    request(`/catalogs/${id}`, {
      method: 'DELETE',
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
