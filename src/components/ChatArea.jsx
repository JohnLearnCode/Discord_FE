import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

export default function ChatArea({ user, channel, onSendMessage }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!channel || channel.type !== 'text') {
      setMessages([])
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    api
      .getMessagesByChannel(channel._id)
      .then((data) => {
        if (!cancelled) setMessages(data)
      })
      .catch(() => {
        if (!cancelled) setError('Không thể tải tin nhắn')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [channel])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !channel) return

    const payload = {
      senderId: user._id,
      channelId: channel._id,
      message: text,
    }

    try {
      const newMessage = await api.sendMessage(payload)
      setMessages((prev) => [...prev, newMessage])
      setInput('')
    } catch {
      setError('Không thể gửi tin nhắn')
    }
  }

  if (!channel) {
    return (
      <main className="chat-area chat-area--empty">
        <div className="chat-welcome">
          <h1>Chào mừng đến với Discord</h1>
          <p>Chọn một kênh để bắt đầu trò chuyện.</p>
        </div>
      </main>
    )
  }

  if (channel.type === 'voice') {
    return (
      <main className="chat-area chat-area--empty">
        <div className="chat-welcome">
          <h1>🔊 {channel.title}</h1>
          <p>Đây là kênh thoại. Kết nối để trò chuyện bằng giọng nói.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="chat-area">
      <header className="chat-header">
        <span className="chat-channel-icon">#</span>
        <h2 className="chat-channel-title">{channel.title}</h2>
        <span className="chat-topic">Chủ đề của kênh</span>
      </header>

      <div className="chat-messages">
        {loading && <div className="chat-loading">Đang tải tin nhắn...</div>}

        {!loading && error && <div className="chat-error">{error}</div>}

        {!loading && messages.length === 0 && (
          <div className="chat-empty">Chưa có tin nhắn nào. Hãy bắt đầu trò chuyện!</div>
        )}

        {messages.map((msg) => (
          <div className="message" key={msg._id}>
            <div className="message-avatar">
              {msg.senderId?.avatarUrl ? (
                <img src={msg.senderId.avatarUrl} alt={msg.senderId.username} />
              ) : (
                (msg.senderId?.username || '?').charAt(0).toUpperCase()
              )}
            </div>
            <div className="message-body">
              <div className="message-header">
                <span className="message-author">{msg.senderId?.username || 'Ẩn danh'}</span>
                <span className="message-time">
                  {new Date(msg.createdAt).toLocaleTimeString('vi-VN')}
                </span>
              </div>
              <div className="message-content">{msg.message}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={`Nhắn tin vào #${channel.title}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={!input.trim()}>
          Gửi
        </button>
      </form>
    </main>
  )
}
