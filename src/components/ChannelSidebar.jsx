import { useEffect, useRef, useState } from 'react'

export default function ChannelSidebar({ server, catalogs, textChannels, voiceChannels, activeChannelId, onSelectChannel, onCreateChannel, onUpdateChannel, onDeleteChannel }) {
  const [collapsedCatalogs, setCollapsedCatalogs] = useState({})
  const [modalCatalog, setModalCatalog] = useState(null)
  const [channelType, setChannelType] = useState('text')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [contextMenu, setContextMenu] = useState(null)
  const [editingChannel, setEditingChannel] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!server) {
    return (
      <aside className="channel-sidebar channel-sidebar--empty">
        <div className="sidebar-empty">Chọn một máy chủ để bắt đầu</div>
      </aside>
    )
  }

  const channelById = (id) => {
    const text = textChannels.find((c) => c._id === id)
    if (text) return { ...text, type: 'text' }
    const voice = voiceChannels.find((c) => c._id === id)
    if (voice) return { ...voice, type: 'voice' }
    return null
  }

  const toggleCatalog = (catalogId) => {
    setCollapsedCatalogs((prev) => ({
      ...prev,
      [catalogId]: !prev[catalogId],
    }))
  }

  function openModal(catalog) {
    setModalCatalog(catalog)
    setChannelType('text')
    setTitle('')
    setError('')
  }

  function closeModal() {
    if (submitting) return
    setModalCatalog(null)
    setTitle('')
    setError('')
  }

  function openContextMenu(e, channel) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, channel })
  }

  function openEditModal() {
    const channel = contextMenu.channel
    setEditingChannel(channel)
    setTitle(channel.title)
    setError('')
    setContextMenu(null)
  }

  function closeEditModal() {
    if (submitting) return
    setEditingChannel(null)
    setTitle('')
    setError('')
  }

  async function handleDelete() {
    const channel = contextMenu.channel
    setContextMenu(null)

    if (!window.confirm(`Bạn có chắc muốn xóa kênh "${channel.title}"?`)) return

    setSubmitting(true)
    try {
      await onDeleteChannel(channel)
    } catch (err) {
      setError(err.message || 'Không thể xóa kênh.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Vui lòng nhập tên kênh.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await onCreateChannel(modalCatalog._id, channelType, trimmed)
      closeModal()
    } catch (err) {
      setError(err.message || 'Không thể tạo kênh.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Vui lòng nhập tên kênh.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await onUpdateChannel(editingChannel, trimmed)
      closeEditModal()
    } catch (err) {
      setError(err.message || 'Không thể sửa kênh.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <aside className="channel-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-server-name">{server.name}</h2>
        <button className="sidebar-dropdown">⌄</button>
      </div>

      <div className="sidebar-scroll">
        {catalogs.map((catalog) => {
          const channels = catalog.channelIds
            .map(channelById)
            .filter(Boolean)

          const isCollapsed = collapsedCatalogs[catalog._id]

          return (
            <div className="catalog-group" key={catalog._id}>
              <div className="catalog-title" onClick={() => toggleCatalog(catalog._id)}>
                <span
                  className={`catalog-arrow ${isCollapsed ? 'catalog-arrow--collapsed' : ''}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
                <span className="catalog-title-text">{catalog.title}</span>
                <button
                  className="catalog-add"
                  title="Thêm kênh"
                  onClick={(e) => {
                    e.stopPropagation()
                    openModal(catalog)
                  }}
                >
                  +
                </button>
              </div>
              {!isCollapsed && channels.map((channel) => (
                <button
                  key={channel._id}
                  className={`channel-item ${channel._id === activeChannelId ? 'channel-item--active' : ''}`}
                  onClick={() => onSelectChannel(channel)}
                  onContextMenu={(e) => openContextMenu(e, channel)}
                >
                  <span className="channel-icon">{channel.type === 'text' ? '#' : '🔊'}</span>
                  <span className="channel-name">{channel.title}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>

      <div className="sidebar-footer">
        <div className="user-badge">
          <span className="user-avatar">A</span>
          <div className="user-meta">
            <span className="user-name">Bạn</span>
            <span className="user-status">#online</span>
          </div>
        </div>
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="context-menu-item" onClick={openEditModal}>
            Sửa kênh
          </button>
          <button className="context-menu-item context-menu-item--danger" onClick={handleDelete}>
            Xóa kênh
          </button>
        </div>
      )}

      {modalCatalog && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Tạo kênh mới</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-section">
                <span className="modal-label">LOẠI KÊNH</span>
                <div className="channel-type-options">
                  <button
                    type="button"
                    className={`channel-type-option ${channelType === 'text' ? 'channel-type-option--active' : ''}`}
                    onClick={() => setChannelType('text')}
                  >
                    <span className="channel-type-icon">#</span>
                    <span className="channel-type-text">Kênh văn bản</span>
                  </button>
                  <button
                    type="button"
                    className={`channel-type-option ${channelType === 'voice' ? 'channel-type-option--active' : ''}`}
                    onClick={() => setChannelType('voice')}
                  >
                    <span className="channel-type-icon">🔊</span>
                    <span className="channel-type-text">Kênh thoại</span>
                  </button>
                </div>
              </div>

              <div className="modal-section">
                <span className="modal-label">TÊN KÊNH</span>
                <input
                  type="text"
                  className="modal-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tên kênh mới"
                  autoFocus
                />
              </div>

              {error && <div className="modal-error">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="modal-button modal-button--cancel" onClick={closeModal}>
                  Hủy
                </button>
                <button type="submit" className="modal-button modal-button--primary" disabled={submitting}>
                  {submitting ? 'Đang tạo...' : 'Tạo kênh'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingChannel && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Sửa kênh</h3>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-section">
                <span className="modal-label">TÊN KÊNH</span>
                <input
                  type="text"
                  className="modal-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tên kênh"
                  autoFocus
                />
              </div>

              {error && <div className="modal-error">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="modal-button modal-button--cancel" onClick={closeEditModal}>
                  Hủy
                </button>
                <button type="submit" className="modal-button modal-button--primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  )
}
