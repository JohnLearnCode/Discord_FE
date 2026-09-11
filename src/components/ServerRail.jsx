import { useEffect, useRef, useState } from 'react'
import { isServerOwner } from '../owner.js'

export default function ServerRail({ servers, currentUserId, activeServerId, onSelectServer, onCreateServer, onUpdateServer, onDeleteServer, homeActive, onHomeClick }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const [contextMenu, setContextMenu] = useState(null)
  const [editingServer, setEditingServer] = useState(null)
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

  function openModal() {
    setName('')
    setIconUrl('')
    setError('')
    setOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setOpen(false)
    setError('')
  }

  function openContextMenu(e, server) {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, server })
  }

  function openEditModal() {
    const server = contextMenu.server

    if (!isServerOwner(server, currentUserId)) {
      setContextMenu(null)
      window.alert('Bạn không có quyền sửa máy chủ này. Chỉ chủ sở hữu mới có thể thực hiện.')
      return
    }

    setEditingServer(server)
    setName(server.name)
    setIconUrl(server.iconUrl || '')
    setError('')
    setContextMenu(null)
  }

  function closeEditModal() {
    if (submitting) return
    setEditingServer(null)
    setName('')
    setIconUrl('')
    setError('')
  }

  async function handleDeleteServer() {
    const server = contextMenu.server
    setContextMenu(null)

    if (!isServerOwner(server, currentUserId)) {
      window.alert('Bạn không có quyền xóa máy chủ này. Chỉ chủ sở hữu mới có thể thực hiện.')
      return
    }

    if (!window.confirm(`Bạn có chắc muốn xóa máy chủ "${server.name}"?`)) return

    setSubmitting(true)
    setError('')
    try {
      await onDeleteServer(server._id)
    } catch (err) {
      window.alert(err.message || 'Không thể xóa máy chủ.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn file ảnh hợp lệ.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setIconUrl(reader.result)
      setError('')
    }
    reader.readAsDataURL(file)
  }

  function removeIcon() {
    setIconUrl('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Vui lòng nhập tên máy chủ.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await onCreateServer({ name: trimmed, iconUrl: iconUrl.trim() })
      closeModal()
    } catch (err) {
      setError(err.message || 'Không thể tạo máy chủ.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Vui lòng nhập tên máy chủ.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await onUpdateServer(editingServer._id, { name: trimmed, iconUrl: iconUrl.trim() })
      closeEditModal()
    } catch (err) {
      setError(err.message || 'Không thể sửa máy chủ.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <nav className="server-rail">
      <button
        className={`server-item server-item--home ${homeActive ? 'server-item--active' : ''}`}
        onClick={onHomeClick}
        title="Trang chủ"
      >
        <span className="server-icon">🏠</span>
      </button>

      <div className="server-divider" />

      {servers.map((server) => (
        <button
          key={server._id}
          className={`server-item ${server._id === activeServerId ? 'server-item--active' : ''}`}
          onClick={() => onSelectServer(server)}
          onContextMenu={(e) => openContextMenu(e, server)}
          title={server.name}
        >
          <span className="server-icon">
            {server.iconUrl ? (
              <img src={server.iconUrl} alt={server.name} />
            ) : (
              server.name.charAt(0).toUpperCase()
            )}
          </span>
        </button>
      ))}

      <button className="server-item server-item--add" title="Thêm máy chủ" onClick={openModal}>
        <span className="server-icon">+</span>
      </button>

      {contextMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {isServerOwner(contextMenu.server, currentUserId) ? (
            <>
              <button className="context-menu-item" onClick={openEditModal}>
                Sửa máy chủ
              </button>
              <button className="context-menu-item context-menu-item--danger" onClick={handleDeleteServer}>
                Xóa máy chủ
              </button>
            </>
          ) : (
            <div className="context-menu-note">
              Bạn không có quyền sửa/xóa máy chủ này
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Tạo máy chủ mới</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-section">
                <span className="modal-label">TÊN MÁY CHỦ</span>
                <input
                  type="text"
                  className="modal-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tên máy chủ"
                  autoFocus
                />
              </div>

              <div className="modal-section">
                <span className="modal-label">ICON MÁY CHỦ (TÙY CHỌN)</span>
                <div className="server-icon-picker">
                  <div className="server-icon-preview">
                    {iconUrl ? (
                      <img src={iconUrl} alt="Xem trước icon" />
                    ) : (
                      <span className="server-icon-preview-placeholder">
                        {name.trim() ? name.trim().charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                  <div className="server-icon-actions">
                    <button
                      type="button"
                      className="modal-button modal-button--secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Chọn ảnh
                    </button>
                    {iconUrl && (
                      <button
                        type="button"
                        className="modal-button modal-button--cancel"
                        onClick={removeIcon}
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="server-icon-file-input"
                  onChange={handleFileChange}
                />
              </div>

              {error && <div className="modal-error">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="modal-button modal-button--cancel" onClick={closeModal}>
                  Hủy
                </button>
                <button type="submit" className="modal-button modal-button--primary" disabled={submitting}>
                  {submitting ? 'Đang tạo...' : 'Tạo máy chủ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingServer && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Sửa máy chủ</h3>
              <button className="modal-close" onClick={closeEditModal}>×</button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="modal-section">
                <span className="modal-label">TÊN MÁY CHỦ</span>
                <input
                  type="text"
                  className="modal-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tên máy chủ"
                  autoFocus
                />
              </div>

              <div className="modal-section">
                <span className="modal-label">ICON MÁY CHỦ (TÙY CHỌN)</span>
                <div className="server-icon-picker">
                  <div className="server-icon-preview">
                    {iconUrl ? (
                      <img src={iconUrl} alt="Xem trước icon" />
                    ) : (
                      <span className="server-icon-preview-placeholder">
                        {name.trim() ? name.trim().charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                  <div className="server-icon-actions">
                    <button
                      type="button"
                      className="modal-button modal-button--secondary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Chọn ảnh
                    </button>
                    {iconUrl && (
                      <button
                        type="button"
                        className="modal-button modal-button--cancel"
                        onClick={removeIcon}
                      >
                        Xóa ảnh
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="server-icon-file-input"
                  onChange={handleFileChange}
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
    </nav>
  )
}
