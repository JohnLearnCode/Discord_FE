import { useEffect, useState } from 'react'
import { api } from './api.js'
import { getSocket } from './socket.js'
import DmChatPanel from './components/DmChatPanel.jsx'
import './FriendsPage.css'

const TABS = [
  { key: 'online', label: 'Trực tuyến' },
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Đang chờ xử lý' },
  { key: 'add', label: 'Thêm bạn' },
  { key: 'explore', label: 'Khám phá' },
]

export default function FriendsPage({ user, token, onLogout, onServerJoined }) {
  const [users, setUsers] = useState([])
  const [friends, setFriends] = useState([])
  const [friendships, setFriendships] = useState([])
  const [activeTab, setActiveTab] = useState('online')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [dmUser, setDmUser] = useState(null)
  const [toast, setToast] = useState(null)
  const [allServers, setAllServers] = useState([])
  const [serverSearchTerm, setServerSearchTerm] = useState('')
  const [serverSearchResults, setServerSearchResults] = useState([])
  const [searchingServers, setSearchingServers] = useState(false)

  const socket = getSocket(token)

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [userData, friendData, friendshipData, serverData] = await Promise.all([
        api.getUsers(),
        api.getFriend(user._id),
        api.getFriendshipsByUser(user._id),
        api.getServers(),
      ])
      setUsers(userData)
      setFriends(friendData)
      setFriendships(friendshipData)
      setAllServers(serverData)
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu bạn bè.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user._id])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const term = searchTerm.trim()

    if (!term) {
      setSearchResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)

    const timer = setTimeout(() => {
      api
        .searchUserByUsername(term)
        .then((data) => {
          if (!cancelled) setSearchResults(data)
        })
        .catch(() => {
          if (!cancelled) setSearchResults([])
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchTerm])

  useEffect(() => {
    const term = serverSearchTerm.trim()

    if (!term) {
      setServerSearchResults([])
      setSearchingServers(false)
      return
    }

    let cancelled = false
    setSearchingServers(true)

    const timer = setTimeout(() => {
      api
        .searchServers(term)
        .then((data) => {
          if (!cancelled) setServerSearchResults(data)
        })
        .catch(() => {
          if (!cancelled) setServerSearchResults([])
        })
        .finally(() => {
          if (!cancelled) setSearchingServers(false)
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [serverSearchTerm])

  useEffect(() => {
    if (!socket) return

    const refId = (value) => {
      if (!value) return null
      return typeof value === 'object' ? String(value._id) : String(value)
    }

    const otherUser = (friendship) =>
      refId(friendship.senderId) === user._id
        ? friendship.receiverId
        : friendship.senderId

    function addFriend(friend) {
      if (!friend?._id) return
      setFriends((prev) =>
        prev.some((f) => f._id === friend._id) ? prev : [...prev, friend],
      )
    }

    function removeFriend(friend) {
      if (!friend?._id) return
      setFriends((prev) => prev.filter((f) => f._id !== friend._id))
    }

    function handleRequest(friendship) {
      setFriendships((prev) =>
        prev.some((f) => f._id === friendship._id) ? prev : [...prev, friendship],
      )
      const name = friendship.senderId?.username || 'Ai đó'
      setToast({
        id: `${friendship._id}-request`,
        message: `${name} đã gửi lời mời kết bạn.`,
      })
    }

    function handleUpdated(friendship) {
      setFriendships((prev) =>
        prev.some((f) => f._id === friendship._id)
          ? prev.map((f) => (f._id === friendship._id ? friendship : f))
          : [...prev, friendship],
      )

      if (friendship.status === 'accepted') {
        addFriend(otherUser(friendship))
      }

      if (refId(friendship.senderId) !== user._id) return

      const name = friendship.receiverId?.username || 'Người dùng'
      setToast({
        id: `${friendship._id}-${friendship.status}`,
        message:
          friendship.status === 'accepted'
            ? `${name} đã chấp nhận lời mời kết bạn của bạn.`
            : `${name} đã từ chối lời mời kết bạn của bạn.`,
      })
    }

    function handleRemoved(payload) {
      if (!payload?._id) return

      setFriendships((prev) => prev.filter((f) => f._id !== payload._id))

      if (payload.status === 'accepted') {
        removeFriend(otherUser(payload))
      }

      if (refId(payload.receiverId) !== user._id || payload.status !== 'pending') return

      const name = payload.senderId?.username || 'Người dùng'
      setToast({
        id: `${payload._id}-removed`,
        message: `${name} đã hủy lời mời kết bạn.`,
      })
    }

    socket.on('friendship:request', handleRequest)
    socket.on('friendship:updated', handleUpdated)
    socket.on('friendship:removed', handleRemoved)

    return () => {
      socket.off('friendship:request', handleRequest)
      socket.off('friendship:updated', handleUpdated)
      socket.off('friendship:removed', handleRemoved)
    }
  }, [socket, user._id])

  function enrichFriendship(f) {
    const isSender = f.senderId?._id === user._id
    return {
      ...f,
      other: isSender ? f.receiverId : f.senderId,
      direction: isSender ? 'outgoing' : 'incoming',
    }
  }

  const enriched = friendships.map(enrichFriendship)
  const pending = enriched.filter((f) => f.status === 'pending')

  const hasRelation = (userId) =>
    enriched.some((f) => f.status !== 'rejected' && f.other?._id === userId)

  const isAddable = (u) => u._id !== user._id && !hasRelation(u._id)
  const addableUsers = users.filter(isAddable)

  const term = searchTerm.trim()
  const displayedUsers = term
    ? searchResults.filter(isAddable)
    : addableUsers

  const serverTerm = serverSearchTerm.trim()
  const myServerIds = new Set(
    allServers
      .filter((s) => (s.memberIds || []).includes(user._id))
      .map((s) => s._id),
  )
  const joinableServers = allServers.filter((s) => !myServerIds.has(s._id))
  const displayedServers = serverTerm ? serverSearchResults : joinableServers

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

  async function handleJoinServer(server) {
    setError('')
    try {
      const joined = await api.joinServer(server._id, user._id)
      if (onServerJoined) onServerJoined(joined)
      await loadData()
      setToast({
        id: `${server._id}-joined`,
        message: `Đã tham gia máy chủ "${server.name}".`,
      })
    } catch (err) {
      setError(err.message || 'Không thể tham gia máy chủ.')
    }
  }

  function openDm(friend) {
    setDmUser(friend)
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
          <button
            className="friend-btn friend-btn--message"
            onClick={() => openDm(friend)}
          >
            Nhắn tin
          </button>
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
            {friends.length === 0 ? (
              <div className="friends-sidebar-empty">Chưa có bạn bè nào.</div>
            ) : (
              friends.map((friend) => (
                <button
                  key={friend._id}
                  className="channel-item"
                  onClick={() => openDm(friend)}
                >
                  <span className="friend-sidebar-avatar">
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt={friend.username} />
                    ) : (
                      friend.username.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="channel-name">{friend.username}</span>
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
            <button className="logout-button" onClick={onLogout} title="Đăng xuất">
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {dmUser ? (
        <DmChatPanel
          user={user}
          otherUser={dmUser}
          socket={socket}
          onBack={() => setDmUser(null)}
        />
      ) : (
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
              {tab.key === 'pending' && pending.length > 0 && (
                <span className="friends-tab-badge">{pending.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className="friends-body">
        {loading && <div className="friends-loading">Đang tải...</div>}
        {!loading && error && <div className="friends-error">{error}</div>}

        {!loading && !error && activeTab === 'online' && (
          <div className="friends-list">
            {friends.length === 0 ? (
              <div className="friends-empty">Chưa có bạn bè trực tuyến.</div>
            ) : (
              friends.map((friend) => <FriendRow key={friend._id} friend={friend} />)
            )}
          </div>
        )}

        {!loading && !error && activeTab === 'all' && (
          <div className="friends-list">
            {friends.length === 0 ? (
              <div className="friends-empty">Chưa có bạn bè nào.</div>
            ) : (
              friends.map((friend) => <FriendRow key={friend._id} friend={friend} />)
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
                placeholder="Tìm kiếm theo tên người dùng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="friends-list">
            {searching ? (
              <div className="friends-loading">Đang tìm kiếm...</div>
            ) : displayedUsers.length === 0 ? (
              <div className="friends-empty">
                {term ? 'Không tìm thấy người dùng nào.' : 'Không còn ai để kết bạn.'}
              </div>
            ) : (
              displayedUsers.map((u) => (
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

        {!loading && !error && activeTab === 'explore' && (
          <>
            <div className="friends-search">
              <input
                type="text"
                className="friends-search-input"
                placeholder="Tìm kiếm máy chủ theo tên..."
                value={serverSearchTerm}
                onChange={(e) => setServerSearchTerm(e.target.value)}
              />
            </div>
            <div className="friends-list">
            {searchingServers ? (
              <div className="friends-loading">Đang tìm kiếm...</div>
            ) : displayedServers.length === 0 ? (
              <div className="friends-empty">
                {serverTerm ? 'Không tìm thấy máy chủ nào.' : 'Không còn máy chủ nào để tham gia.'}
              </div>
            ) : (
              displayedServers.map((s) => {
                const joined = myServerIds.has(s._id)
                return (
                  <div className="friend-row" key={s._id}>
                    <div className="friend-avatar">
                      {s.iconUrl ? (
                        <img src={s.iconUrl} alt={s.name} />
                      ) : (
                        s.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="friend-info">
                      <span className="friend-name">{s.name}</span>
                      <span className="friend-status">{(s.memberIds || []).length} thành viên</span>
                    </div>
                    <div className="friend-actions">
                      <button
                        className="friend-btn friend-btn--accept"
                        disabled={joined}
                        onClick={() => handleJoinServer(s)}
                      >
                        {joined ? 'Đã tham gia' : 'Tham gia'}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
            </div>
          </>
        )}
      </div>
      </div>
      )}

      {toast && <div className="friends-toast">{toast.message}</div>}
    </div>
  )
}
