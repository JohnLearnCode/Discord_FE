const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const API_BASE_URL = `${API_URL}/api`
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL
