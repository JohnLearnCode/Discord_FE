import { useRef, useState } from 'react'

export default function ServerRail({ servers, activeServerId, onSelectServer, onCreateServer, homeActive, onHomeClick }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

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
    </nav>
  )
}
