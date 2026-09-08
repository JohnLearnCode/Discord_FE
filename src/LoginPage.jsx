import { useState } from 'react'
import './LoginPage.css'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        setError('Đăng nhập thất bại')
        return
      }

      const data = await res.json()
      onLogin(data.data)
    } catch {
      setError('Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Chào mừng trở lại!</h1>
          <p className="login-subtitle">Rất vui được gặp lại bạn!</p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="field">
            <span className="field-label">EMAIL HOẶC SỐ ĐIỆN THOẠI</span>
            <input
              type="text"
              className="field-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </label>

          <label className="field">
            <span className="field-label">MẬT KHẨU</span>
            <input
              type="password"
              className="field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="login-footer">
          Cần tài khoản?{' '}
          <a href="#" className="login-link" onClick={(e) => e.preventDefault()}>
            Đăng ký
          </a>
        </p>
      </div>
    </div>
  )
}
