import { useEffect, useRef } from 'react'
import { useVoice } from '../voice/VoiceContext.jsx'

function initial(name) {
  return (name || '?').charAt(0).toUpperCase()
}

function ScreenShareStage({ track, name }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el || !track) return undefined

    track.attach(el)
    return () => {
      track.detach(el)
    }
  }, [track])

  return (
    <div className="voice-stage">
      <div className="voice-stage-header">
        <span className="voice-stage-live">● Đang chia sẻ màn hình</span>
        <span className="voice-stage-name">{name}</span>
      </div>
      <video ref={videoRef} className="voice-stage-video" autoPlay playsInline />
    </div>
  )
}

function ParticipantTile({ participant }) {
  return (
    <div className={`voice-tile ${participant.isSpeaking ? 'voice-tile--speaking' : ''}`}>
      <div className="voice-tile-avatar">
        {initial(participant.name)}
        {participant.isMuted && <span className="voice-tile-muted" title="Đã tắt mic">🔇</span>}
      </div>
      <div className="voice-tile-name">
        {participant.name}
        {participant.isLocal && <span className="voice-tile-you"> (bạn)</span>}
      </div>
      <div className="voice-tile-badges">
        {participant.isSpeaking && <span className="voice-badge voice-badge--speaking">Đang nói</span>}
        {participant.isScreenSharing && <span className="voice-badge">Đang chia sẻ</span>}
      </div>
    </div>
  )
}

export default function VoiceChannelView({ channel }) {
  const {
    currentChannelId,
    connectionState,
    isConnected,
    participants,
    isMuted,
    isDeafened,
    isSharing,
    error,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleDeafen,
    toggleScreenShare,
  } = useVoice()

  const inThisChannel = currentChannelId === channel._id
  const connecting = inThisChannel && connectionState === 'connecting'
  const reconnecting = inThisChannel && connectionState === 'reconnecting'
  const showRoom = inThisChannel && isConnected

  const screenSharer = participants.find((p) => p.screenTrack)

  if (!showRoom) {
    return (
      <main className="chat-area chat-area--empty">
        <div className="voice-join">
          <h1>🔊 {channel.title}</h1>
          <p>Đây là kênh thoại. Kết nối để trò chuyện bằng giọng nói và chia sẻ màn hình.</p>

          {!inThisChannel && currentChannelId && (
            <div className="voice-join-note">
              Bạn đang ở một kênh thoại khác. Kết nối sẽ chuyển bạn sang kênh này.
            </div>
          )}

          {error && <div className="chat-error">{error}</div>}
          {reconnecting && <div className="voice-join-note">Đang kết nối lại...</div>}

          <button
            className="voice-join-button"
            onClick={() => joinVoice(channel._id)}
            disabled={connecting}
          >
            {connecting ? 'Đang kết nối...' : 'Kết nối'}
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="chat-area voice-area">
      <header className="chat-header">
        <span className="chat-channel-icon">🔊</span>
        <h2 className="chat-channel-title">{channel.title}</h2>
        <span className="chat-topic">{participants.length} người đang trong kênh</span>
      </header>

      {reconnecting && <div className="voice-status-note">Mất kết nối, đang thử lại...</div>}
      {error && <div className="chat-error">{error}</div>}

      {screenSharer && (
        <ScreenShareStage
          track={screenSharer.screenTrack}
          name={screenSharer.isLocal ? `${screenSharer.name} (bạn)` : screenSharer.name}
        />
      )}

      <div className={`voice-grid ${screenSharer ? 'voice-grid--compact' : ''}`}>
        {participants.map((participant) => (
          <ParticipantTile key={participant.identity} participant={participant} />
        ))}
      </div>

      <div className="voice-controls">
        <button
          className={`voice-control ${isMuted ? 'voice-control--off' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Bật mic' : 'Tắt mic'}
        >
          <span className="voice-control-icon">{isMuted ? '🔇' : '🎙️'}</span>
          <span>{isMuted ? 'Đang tắt mic' : 'Mic'}</span>
        </button>

        <button
          className={`voice-control ${isDeafened ? 'voice-control--off' : ''}`}
          onClick={toggleDeafen}
          title={isDeafened ? 'Bật tiếng' : 'Tắt tiếng người khác'}
        >
          <span className="voice-control-icon">{isDeafened ? '🔇' : '🎧'}</span>
          <span>{isDeafened ? 'Đang tắt tiếng' : 'Nghe'}</span>
        </button>

        <button
          className={`voice-control ${isSharing ? 'voice-control--active' : ''}`}
          onClick={toggleScreenShare}
          title={isSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}
        >
          <span className="voice-control-icon">🖥️</span>
          <span>{isSharing ? 'Dừng chia sẻ' : 'Chia sẻ màn hình'}</span>
        </button>

        <button className="voice-control voice-control--leave" onClick={leaveVoice} title="Ngắt kết nối">
          <span className="voice-control-icon">📞</span>
          <span>Ngắt kết nối</span>
        </button>
      </div>
    </main>
  )
}
