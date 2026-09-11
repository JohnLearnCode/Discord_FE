import { useEffect, useRef, useState } from 'react'
import VoiceStatusBar from './VoiceStatusBar.jsx'

function uniqueMembers(members) {
  const seen = new Set()

  return members.filter((member) => {
    if (seen.has(member.userId)) return false
    seen.add(member.userId)
    return true
  })
}

export default function ChannelSidebar({ server, catalogs, textChannels, voiceChannels, activeChannelId, voicePresence = {}, activeVoiceChannelId, onSelectChannel, onLogout, canManage = false, onCreateCatalog, onCreateChannel, onUpdateChannel, onDeleteChannel, onUpdateCatalog, onDeleteCatalog }) {
  const [collapsedCatalogs, setCollapsedCatalogs] = useState({})
  const [modalCatalog, setModalCatalog] = useState(null)
  const [channelType, setChannelType] = useState('text')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [createModal, setCreateModal] = useState(false)
  const [createKind, setCreateKind] = useState('channel')
  const [createCatalogId, setCreateCatalogId] = useState('')

  const [contextMenu, setContextMenu] = useState(null)
  const [editingChannel, setEditingChannel] = useState(null)
  const menuRef = useRef(null)

  const [catalogContextMenu, setCatalogContextMenu] = useState(null)
  const [editingCatalog, setEditingCatalog] = useState(null)
  const catalogMenuRef = useRef(null)

  function denyPermission() {
    window.alert('Bạn không có quyền thực hiện thao tác này. Chỉ chủ sở hữu máy chủ mới có thể sửa/xóa danh mục và kênh.')
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null)
      }
      if (catalogMenuRef.current && !catalogMenuRef.current.contains(e.target)) {
        setCatalogContextMenu(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!server) {
    return (
      <aside className="channel-sidebar channel-sidebar--empty">
        <div className="sidebar-empty">Chọn một máy chủ để bắt đầu</div>
        <button className="logout-button" onClick={onLogout} title="Đăng xuất">
          Đăng xuất
        </button>
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

  const activeVoiceChannel = voiceChannels.find((c) => c._id === activeVoiceChannelId) || null

  const toggleCatalog = (catalogId) => {
    setCollapsedCatalogs((prev) => ({
      ...prev,
      [catalogId]: !prev[catalogId],
    }))
  }

  function openModal(catalog) {
    if (!canManage) {
      denyPermission()
      return
    }

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

  function openCreateModal(kind = 'channel') {
    if (!canManage) {
      denyPermission()
      return
    }

    setCreateModal(true)
    setCreateKind(kind)
    setChannelType('text')
    setCreateCatalogId(catalogs[0]?._id || '')
    setTitle('')
    setError('')
  }

  function closeCreateModal() {
    if (submitting) return
    setCreateModal(false)
    setTitle('')
    setError('')
  }

  async function handleCreateSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()

    if (!trimmed) {
      setError(createKind === 'catalog' ? 'Vui lòng nhập tên danh mục.' : 'Vui lòng nhập tên kênh.')
      return
    }

    if (createKind === 'channel' && !createCatalogId) {
      setError('Vui lòng chọn danh mục cho kênh.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      if (createKind === 'catalog') {
        await onCreateCatalog(trimmed)
      } else {
        await onCreateChannel(createCatalogId, channelType, trimmed)
      }
      closeCreateModal()
    } catch (err) {
      setError(err.message || 'Không thể tạo.')
    } finally {
      setSubmitting(false)
    }
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

  function openCatalogContextMenu(e, catalog) {
    e.preventDefault()
    setContextMenu(null)
    setCatalogContextMenu({ x: e.clientX, y: e.clientY, catalog })
  }

  function openEditCatalogModal() {
    const catalog = catalogContextMenu.catalog
    setEditingCatalog(catalog)
    setTitle(catalog.title)
    setError('')
    setCatalogContextMenu(null)
  }

  function closeEditCatalogModal() {
    if (submitting) return
    setEditingCatalog(null)
    setTitle('')
    setError('')
  }

  async function handleDeleteCatalog() {
    const catalog = catalogContextMenu.catalog
    setCatalogContextMenu(null)

    if (!window.confirm(`Bạn có chắc muốn xóa danh mục "${catalog.title}"?`)) return

    setSubmitting(true)
    setError('')
    try {
      await onDeleteCatalog(catalog._id)
    } catch (err) {
      setError(err.message || 'Không thể xóa danh mục.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditCatalogSubmit(e) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Vui lòng nhập tên danh mục.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await onUpdateCatalog(editingCatalog._id, trimmed)
      closeEditCatalogModal()
    } catch (err) {
      setError(err.message || 'Không thể sửa danh mục.')
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
              <div
                className="catalog-title"
                onClick={() => toggleCatalog(catalog._id)}
                onContextMenu={(e) => openCatalogContextMenu(e, catalog)}
              >
                <span
                  className={`catalog-arrow ${isCollapsed ? 'catalog-arrow--collapsed' : ''}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
                <span className="catalog-title-text">{catalog.title}</span>
                {canManage && (
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
                )}
              </div>
              {!isCollapsed && channels.map((channel) => {
                const members = channel.type === 'voice' ? uniqueMembers(voicePresence[channel._id] || []) : []

                return (
                  <div className="channel-block" key={channel._id}>
                    <button
                      className={`channel-item ${channel._id === activeChannelId ? 'channel-item--active' : ''} ${channel._id === activeVoiceChannelId ? 'channel-item--voice-active' : ''}`}
                      onClick={() => onSelectChannel(channel)}
                      onContextMenu={(e) => openContextMenu(e, channel)}
                    >
                      <span className="channel-icon">{channel.type === 'text' ? '#' : '🔊'}</span>
                      <span className="channel-name">{channel.title}</span>
                    </button>
                    {members.length > 0 && (
                      <div className="voice-members">
                        {members.map((member) => (
                          <div className="voice-member" key={member.userId}>
                            <span className="voice-member-avatar">
                              {member.username.charAt(0).toUpperCase()}
                            </span>
                            <span className="voice-member-name">{member.username}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {canManage && (
          <button className="sidebar-create" onClick={() => openCreateModal('channel')}>
            <span className="sidebar-create-icon">+</span>
            <span>Tạo danh mục hoặc kênh</span>
          </button>
        )}
      </div>

      {activeVoiceChannelId && <VoiceStatusBar channel={activeVoiceChannel} />}

      <div className="sidebar-footer">
        <div className="user-badge">
          <span className="user-avatar">A</span>
          <div className="user-meta">
            <span className="user-name">Bạn</span>
            <span className="user-status">#online</span>
          </div>
          <button className="logout-button" onClick={onLogout} title="Đăng xuất">
            Đăng xuất
          </button>
        </div>
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {canManage ? (
            <>
              <button className="context-menu-item" onClick={openEditModal}>
                Sửa kênh
              </button>
              <button className="context-menu-item context-menu-item--danger" onClick={handleDelete}>
                Xóa kênh
              </button>
            </>
          ) : (
            <div className="context-menu-note">
              Bạn không có quyền sửa/xóa kênh này
            </div>
          )}
        </div>
      )}

      {catalogContextMenu && (
        <div
          ref={catalogMenuRef}
          className="context-menu"
          style={{ top: catalogContextMenu.y, left: catalogContextMenu.x }}
        >
          {canManage ? (
            <>
              <button className="context-menu-item" onClick={openEditCatalogModal}>
                Sửa danh mục
              </button>
              <button className="context-menu-item context-menu-item--danger" onClick={handleDeleteCatalog}>
                Xóa danh mục
              </button>
            </>
          ) : (
            <div className="context-menu-note">
              Bạn không có quyền sửa/xóa danh mục này
            </div>
          )}
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

      {editingCatalog && (
        <div className="modal-overlay" onClick={closeEditCatalogModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Sửa danh mục</h3>
              <button className="modal-close" onClick={closeEditCatalogModal}>×</button>
            </div>

            <form onSubmit={handleEditCatalogSubmit}>
              <div className="modal-section">
                <span className="modal-label">TÊN DANH MỤC</span>
                <input
                  type="text"
                  className="modal-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Tên danh mục"
                  autoFocus
                />
              </div>

              {error && <div className="modal-error">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="modal-button modal-button--cancel" onClick={closeEditCatalogModal}>
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

      {createModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Tạo mới</h3>
              <button className="modal-close" onClick={closeCreateModal}>×</button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-section">
                <span className="modal-label">LOẠI</span>
                <div className="channel-type-options">
                  <button
                    type="button"
                    className={`channel-type-option ${createKind === 'catalog' ? 'channel-type-option--active' : ''}`}
                    onClick={() => setCreateKind('catalog')}
                  >
                    <span className="channel-type-icon">🗂️</span>
                    <span className="channel-type-text">Danh mục</span>
                  </button>
                  <button
                    type="button"
                    className={`channel-type-option ${createKind === 'channel' ? 'channel-type-option--active' : ''}`}
                    onClick={() => setCreateKind('channel')}
                  >
                    <span className="channel-type-icon">#</span>
                    <span className="channel-type-text">Kênh</span>
                  </button>
                </div>
              </div>

              {createKind === 'channel' && (
                <>
                  <div className="modal-section">
                    <span className="modal-label">DANH MỤC</span>
                    <select
                      className="modal-input"
                      value={createCatalogId}
                      onChange={(e) => setCreateCatalogId(e.target.value)}
                      disabled={catalogs.length === 0}
                    >
                      {catalogs.length === 0 && <option value="">Chưa có danh mục</option>}
                      {catalogs.map((catalog) => (
                        <option key={catalog._id} value={catalog._id}>
                          {catalog.title}
                        </option>
                      ))}
                    </select>
                  </div>

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
                </>
              )}

              <div className="modal-section">
                <span className="modal-label">{createKind === 'catalog' ? 'TÊN DANH MỤC' : 'TÊN KÊNH'}</span>
                <input
                  type="text"
                  className="modal-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={createKind === 'catalog' ? 'Tên danh mục mới' : 'Tên kênh mới'}
                  autoFocus
                />
              </div>

              {error && <div className="modal-error">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="modal-button modal-button--cancel" onClick={closeCreateModal}>
                  Hủy
                </button>
                <button type="submit" className="modal-button modal-button--primary" disabled={submitting}>
                  {submitting ? 'Đang tạo...' : 'Tạo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  )
}
