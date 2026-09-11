import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

function userId(value) {
  if (!value) return null
  return typeof value === 'object' ? value._id : value
}

export default function DmChatPanel({ user, otherUser, socket, onBack }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    api
      .getConversation(user._id, otherUser._id)
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
  }, [user._id, otherUser._id])

  useEffect(() => {
    if (!socket) return

    function handleMessage(msg) {
      const senderId = userId(msg.senderId)
      const receiverId = userId(msg.receiverId)
      const isRelevant =
        (senderId === user._id && receiverId === otherUser._id) ||
        (senderId === otherUser._id && receiverId === user._id)

      if (!isRelevant) return

      setMessages((prev) =>
        prev.some((m) => m._id === msg._id) ? prev : [...prev, msg],
      )
    }

    socket.on('p2p:message', handleMessage)
    return () => socket.off('p2p:message', handleMessage)
  }, [socket, user._id, otherUser._id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !socket?.connected) return

    socket.emit('p2p:message', {
      receiverId: otherUser._id,
      message: text,
    })

    setInput('')
  }

  return (
    <div className="dm-chat">
      <header className="chat-header">
        <button className="dm-back" onClick={onBack} aria-label="Quay lại">
          ←
        </button>
        <span className="message-avatar dm-avatar">
          {otherUser.avatarUrl ? (
            <img src={otherUser.avatarUrl} alt={otherUser.username} />
          ) : (
            otherUser.username.charAt(0).toUpperCase()
          )}
        </span>
        <h2 className="chat-channel-title">{otherUser.username}</h2>
        <span className="chat-topic">Trực tuyến</span>
      </header>

      <div className="chat-messages">
        {loading && <div className="chat-loading">Đang tải tin nhắn...</div>}

        {!loading && error && <div className="chat-error">{error}</div>}

        {!loading && !error && messages.length === 0 && (
          <div className="chat-empty">
            Bắt đầu trò chuyện với {otherUser.username}.
          </div>
        )}

        {messages.map((msg) => {
          const senderId = userId(msg.senderId)
          const isMine = senderId === user._id
          return (
            <div className={`message ${isMine ? 'message--mine' : ''}`} key={msg._id}>
              <div className="message-avatar">
                {msg.senderId?.avatarUrl ? (
                  <img src={msg.senderId.avatarUrl} alt={msg.senderId.username} />
                ) : (
                  (msg.senderId?.username || '?').charAt(0).toUpperCase()
                )}
              </div>
              <div className="message-body">
                <div className="message-header">
                  <span className="message-author">
                    {isMine ? 'Bạn' : msg.senderId?.username || 'Ẩn danh'}
                  </span>
                  <span className="message-time">
                    {new Date(msg.createdAt).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
                <div className="message-content">{msg.message}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder={`Nhắn tin cho ${otherUser.username}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" disabled={!input.trim() || !socket?.connected}>
          Gửi
        </button>
      </form>
    </div>
  )
}
