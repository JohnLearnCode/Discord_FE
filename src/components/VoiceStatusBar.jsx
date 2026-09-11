import { useVoice } from '../voice/VoiceContext.jsx'

export default function VoiceStatusBar({ channel }) {
  const {
    connectionState,
    currentChannelId,
    isConnected,
    isMuted,
    isDeafened,
    leaveVoice,
    toggleMute,
    toggleDeafen,
  } = useVoice()

  if (!currentChannelId) return null

  const statusText =
    connectionState === 'reconnecting'
      ? 'Đang kết nối lại...'
      : isConnected
        ? 'Đã kết nối'
        : 'Đang kết nối...'

  return (
    <div className="voice-status-bar">
      <div className="voice-status-info">
        <span className={`voice-status-dot ${isConnected ? 'voice-status-dot--live' : ''}`} />
        <div className="voice-status-meta">
          <span className="voice-status-title">{channel?.title || 'Kênh thoại'}</span>
          <span className="voice-status-sub">{statusText}</span>
        </div>
      </div>

      <div className="voice-status-actions">
        <button
          className={`voice-status-button ${isMuted ? 'voice-status-button--off' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Bật mic' : 'Tắt mic'}
        >
          {isMuted ? '🔇' : '🎙️'}
        </button>
        <button
          className={`voice-status-button ${isDeafened ? 'voice-status-button--off' : ''}`}
          onClick={toggleDeafen}
          title={isDeafened ? 'Bật tiếng' : 'Tắt tiếng người khác'}
        >
          {isDeafened ? '🔇' : '🎧'}
        </button>
        <button
          className="voice-status-button voice-status-button--leave"
          onClick={leaveVoice}
          title="Ngắt kết nối"
        >
          📞
        </button>
      </div>
    </div>
  )
}
