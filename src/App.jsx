import { useState } from 'react'
import LoginPage from './LoginPage.jsx'
import HomePage from './HomePage.jsx'
import { disconnectSocket } from './socket.js'
import { setAuthToken } from './api.js'

const AUTH_STORAGE_KEY = 'discord-remake-auth'

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.user || !parsed?.accessToken) return null
    return parsed
  } catch {
    return null
  }
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    const stored = loadStoredAuth()
    setAuthToken(stored?.accessToken)
    return stored
  })

  function handleLogin(data) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
    setAuthToken(data.accessToken)
    setAuth(data)
  }

  function handleLogout() {
    disconnectSocket()
    setAuthToken(null)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setAuth(null)
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <HomePage
      user={auth.user}
      token={auth.accessToken}
      onLogout={handleLogout}
    />
  )
}
