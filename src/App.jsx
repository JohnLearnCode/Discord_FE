import { useState } from 'react'
import LoginPage from './LoginPage.jsx'
import HomePage from './HomePage.jsx'

export default function App() {
  const [auth, setAuth] = useState(null)

  if (!auth) {
    return <LoginPage onLogin={setAuth} />
  }

  return <HomePage user={auth.user} onLogout={() => setAuth(null)} />
}
