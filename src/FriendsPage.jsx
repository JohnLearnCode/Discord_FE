import { useEffect, useState } from 'react'
import { api } from './api.js'
import './FriendsPage.css'

const TABS = [
  { key: 'online', label: 'Trực tuyến' },
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ xử lý' },
  { key: 'add', label: 'Thêm bạn' },
]

export default function FriendsPage({ user }) {
  const [users, setUsers] = useState([])
  const [friendships, setFriendships] = useState([])
  const [activeTab, setActiveTab] = useState('online')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [userData, friendshipData] = await Promise.all([
        api.getUsers(),
        api.getFriendshipsByUser(user._id),
      ])
      setUsers(userData)
      setFriendships(friendshipData)
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu bạn bè.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user._id])

  function enrichFriendship(f) {
    const isSender = f.senderId?._id === user._id
    return {
      ...f,
      other: isSender ? f.receiverId : f.senderId,
      direction: isSender ? 'outgoing' : 'incoming',
    }
  }

  const enriched = friendships.map(enrichFriendship)
  const accepted = enriched.filter((f) => f.status === 'accepted')
  const pending = enriched.filter((f) => f.status === 'pending')

  const hasRelation = (userId) =>
    enriched.some((f) => f.status !== 'rejected' && f.other?._id === userId)

  const addableUsers = users.filter(
    (u) => u._id !== user._id && !hasRelation(u._id),
  )

  const filteredAddableUsers = addableUsers.filter((u) => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return true
    return (
      u.username?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term)
    )
  })

  async function handleSendRequest(receiverId) {
    setError('')
    try {
      await api.sendFriendRequest(user._id, receiverId)
      await loadData()
    } catch (err) {
      setError(err.message || 'Không thể gửi lời mời kết bạn.')
    }
  }

  async function handleRespond(id, status) {
    setError('')
    try {
      await api.respondFriendRequest(id, status)
      await loadData()
    } catch (err) {
      setError(err.message || 'Không thể xử lý lời mời.')
    }
  }

  async function handleCancel(id) {
    setError('')
    try {
      await api.deleteFriendship(id)
      await loadData()
    } catch (err) {
      setError(err.message || 'Không thể hủy lời mời.')
    }
  }

  function FriendRow({ friend }) {
    return (
      <div className="friend-row">
        <div className="friend-avatar">
          {friend.avatarUrl ? (
            <img src={friend.avatarUrl} alt={friend.username} />
          ) : (
            friend.username.charAt(0).toUpperCase()
          )}
        </div>
        <div className="friend-info">
          <span className="friend-name">{friend.username}</span>
          <span className="friend-status">Trực tuyến</span>
        </div>
        <div className="friend-actions">
          <button className="friend-btn friend-btn--message">Nhắn tin</button>
        </div>
      </div>
    )
  }

  return (
    <div className="friends-page">
      <aside className="channel-sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-server-name">Bạn bè</h2>
          <button className="sidebar-dropdown">⌄</button>
        </div>

        <div className="sidebar-scroll">
          <div className="catalog-group">
            <div className="catalog-title">
              <span className="catalog-arrow" aria-hidden="true">▼</span>
              <span className="catalog-title-text">Bạn bè đã kết bạn</span>
            </div>
            {accepted.length === 0 ? (
              <div className="friends-sidebar-empty">Chưa có bạn bè nào.</div>
            ) : (
              accepted.map((f) => (
                <button key={f._id} className="channel-item">
                  <span className="friend-sidebar-avatar">
                    {f.other.avatarUrl ? (
                      <img src={f.other.avatarUrl} alt={f.other.username} />
                    ) : (
                      f.other.username.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="channel-name">{f.other.username}</span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-badge">
            <span className="user-avatar">
              {user.username?.charAt(0).toUpperCase()}
            </span>
            <div className="user-meta">
              <span className="user-name">{user.username}</span>
              <span className="user-status">#online</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="friends-content">
        <header className="friends-header">
        <h1 className="friends-title">Bạn bè</h1>
        <nav className="friends-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`friends-tab ${activeTab === tab.key ? 'friends-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="friends-body">
        {loading && <div className="friends-loading">Đang tải...</div>}
        {!loading && error && <div className="friends-error">{error}</div>}

        {!loading && !error && activeTab === 'online' && (
          <div className="friends-list">
            {accepted.length === 0 ? (
              <div className="friends-empty">Chưa có bạn bè trực tuyến.</div>
            ) : (
              accepted.map((f) => <FriendRow key={f._id} friend={f.other} />)
            )}
          </div>
        )}

        {!loading && !error && activeTab === 'all' && (
          <div className="friends-list">
            {enriched.filter((f) => f.status !== 'rejected').length === 0 ? (
              <div className="friends-empty">Chưa có bạn bè nào.</div>
            ) : (
              enriched
                .filter((f) => f.status !== 'rejected')
                .map((f) => <FriendRow key={f._id} friend={f.other} />)
            )}
          </div>
        )}

        {!loading && !error && activeTab === 'pending' && (
          <div className="friends-list">
            {pending.length === 0 ? (
              <div className="friends-empty">Không có lời mời đang chờ.</div>
            ) : (
              pending.map((f) => (
                <div className="friend-row" key={f._id}>
                  <div className="friend-avatar">
                    {f.other.avatarUrl ? (
                      <img src={f.other.avatarUrl} alt={f.other.username} />
                    ) : (
                      f.other.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="friend-info">
                    <span className="friend-name">{f.other.username}</span>
                    <span className="friend-status">
                      {f.direction === 'incoming' ? 'Đã gửi lời mời cho bạn' : 'Đang chờ phản hồi'}
                    </span>
                  </div>
                  <div className="friend-actions">
                    {f.direction === 'incoming' ? (
                      <>
                        <button
                          className="friend-btn friend-btn--accept"
                          onClick={() => handleRespond(f._id, 'accepted')}
                        >
                          Chấp nhận
                        </button>
                        <button
                          className="friend-btn friend-btn--reject"
                          onClick={() => handleRespond(f._id, 'rejected')}
                        >
                          Từ chối
                        </button>
                      </>
                    ) : (
                      <button
                        className="friend-btn friend-btn--reject"
                        onClick={() => handleCancel(f._id)}
                      >
                        Hủy lời mời
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {!loading && !error && activeTab === 'add' && (
          <>
            <div className="friends-search">
              <input
                type="text"
                className="friends-search-input"
                placeholder="Tìm kiếm theo tên hoặc email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="friends-list">
            {addableUsers.length === 0 ? (
              <div className="friends-empty">Không còn ai để kết bạn.</div>
            ) : filteredAddableUsers.length === 0 ? (
              <div className="friends-empty">Không tìm thấy người dùng nào.</div>
            ) : (
              filteredAddableUsers.map((u) => (
                <div className="friend-row" key={u._id}>
                  <div className="friend-avatar">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.username} />
                    ) : (
                      u.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="friend-info">
                    <span className="friend-name">{u.username}</span>
                    <span className="friend-status">{u.email}</span>
                  </div>
                  <div className="friend-actions">
                    <button
                      className="friend-btn friend-btn--accept"
                      onClick={() => handleSendRequest(u._id)}
                    >
                      Kết bạn
                    </button>
                  </div>
                </div>
              ))
            )}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  )
}
