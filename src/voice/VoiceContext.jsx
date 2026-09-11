import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client'

const VoiceContext = createContext(null)

function emitWithAck(socket, event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Chưa kết nối tới máy chủ'))
      return
    }

    const timer = setTimeout(() => reject(new Error('Máy chủ không phản hồi')), timeoutMs)
    socket.emit(event, payload, (res) => {
      clearTimeout(timer)
      resolve(res)
    })
  })
}

function mapConnectionState(state) {
  switch (state) {
    case ConnectionState.Connecting:
      return 'connecting'
    case ConnectionState.Connected:
      return 'connected'
    case ConnectionState.Reconnecting:
    case ConnectionState.SignalReconnecting:
      return 'reconnecting'
    default:
      return 'idle'
  }
}

function snapshotParticipants(room) {
  if (!room) return []

  const all = [room.localParticipant, ...room.remoteParticipants.values()]

  return all.map((participant) => ({
    identity: participant.identity,
    name: participant.name || participant.identity,
    isLocal: participant === room.localParticipant,
    isSpeaking: participant.isSpeaking,
    isMuted: !participant.isMicrophoneEnabled,
    isScreenSharing: participant.isScreenShareEnabled,
    audioTrack: participant.getTrackPublication(Track.Source.Microphone)?.track || null,
    screenTrack: participant.getTrackPublication(Track.Source.ScreenShare)?.track || null,
  }))
}

export function VoiceProvider({ socket, children }) {
  const [currentChannelId, setCurrentChannelId] = useState(null)
  const [connectionState, setConnectionState] = useState('idle')
  const [participants, setParticipants] = useState([])
  const [activeSpeakerId, setActiveSpeakerId] = useState(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [error, setError] = useState('')

  const roomRef = useRef(null)
  const channelRef = useRef(null)
  const audioContainerRef = useRef(null)
  const deafenedRef = useRef(false)

  const sync = useCallback(() => {
    setParticipants(snapshotParticipants(roomRef.current))
  }, [])

  const wireEvents = useCallback(
    (room) => {
      room
        .on(RoomEvent.ParticipantConnected, sync)
        .on(RoomEvent.ParticipantDisconnected, sync)
        .on(RoomEvent.TrackMuted, sync)
        .on(RoomEvent.TrackUnmuted, sync)
        .on(RoomEvent.LocalTrackPublished, sync)
        .on(RoomEvent.LocalTrackUnpublished, sync)
        .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setActiveSpeakerId(speakers[0]?.identity || null)
          sync()
        })
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
            const el = track.attach()
            el.autoplay = true
            el.muted = deafenedRef.current
            audioContainerRef.current.appendChild(el)
          }
          sync()
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove())
          sync()
        })
        .on(RoomEvent.ConnectionStateChanged, (state) => {
          setConnectionState(mapConnectionState(state))
        })
        .on(RoomEvent.Disconnected, () => {
          if (roomRef.current === room) {
            roomRef.current = null
            channelRef.current = null
          }
          setParticipants([])
          setActiveSpeakerId(null)
          setIsSharing(false)
          setConnectionState('idle')
        })
    },
    [sync],
  )

  const leaveVoice = useCallback(async () => {
    const room = roomRef.current
    const channelId = channelRef.current

    roomRef.current = null
    channelRef.current = null

    if (room) {
      room.removeAllListeners()
      try {
        await room.disconnect()
      } catch {
        // already disconnected
      }
    }

    if (channelId && socket) {
      socket.emit('voice:leave', { channelId })
    }

    if (audioContainerRef.current) {
      audioContainerRef.current.innerHTML = ''
    }

    setParticipants([])
    setActiveSpeakerId(null)
    setCurrentChannelId(null)
    setConnectionState('idle')
    setIsMuted(false)
    setIsDeafened(false)
    setIsSharing(false)
    setError('')
  }, [socket])

  const joinVoice = useCallback(
    async (channelId) => {
      if (!socket || !channelId) return

      if (roomRef.current) {
        await leaveVoice()
      }

      setError('')
      setCurrentChannelId(channelId)
      channelRef.current = channelId
      setConnectionState('connecting')

      try {
        const res = await emitWithAck(socket, 'voice:token', { channelId })
        if (!res?.ok) {
          throw new Error(res?.error || 'Không thể lấy quyền truy cập kênh thoại')
        }

        const room = new Room({ adaptiveStream: true, dynacast: true })
        roomRef.current = room
        wireEvents(room)

        await room.connect(res.url, res.token)
        await room.localParticipant.setMicrophoneEnabled(true)

        socket.emit('voice:join', { channelId })

        deafenedRef.current = false
        setIsMuted(false)
        setIsDeafened(false)
        setIsSharing(false)
        setConnectionState(mapConnectionState(room.state))
        sync()
        room.startAudio().catch(() => {})
      } catch (err) {
        setError(err.message || 'Không thể kết nối kênh thoại')
        await leaveVoice()
      }
    },
    [socket, leaveVoice, wireEvents, sync],
  )

  const toggleMute = useCallback(async () => {
    const localParticipant = roomRef.current?.localParticipant
    if (!localParticipant) return

    const next = !isMuted
    await localParticipant.setMicrophoneEnabled(!next)
    setIsMuted(next)
    sync()
  }, [isMuted, sync])

  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const next = !prev
      deafenedRef.current = next

      const container = audioContainerRef.current
      if (container) {
        Array.from(container.children).forEach((el) => {
          el.muted = next
        })
      }

      return next
    })
  }, [])

  const toggleScreenShare = useCallback(async () => {
    const localParticipant = roomRef.current?.localParticipant
    if (!localParticipant) return

    const next = !isSharing
    setError('')

    try {
      await localParticipant.setScreenShareEnabled(next)
      setIsSharing(next)
      sync()
    } catch (err) {
      setError(err.message || 'Không thể chia sẻ màn hình')
      setIsSharing(false)
    }
  }, [isSharing, sync])

  useEffect(() => {
    return () => {
      const room = roomRef.current
      const channelId = channelRef.current

      roomRef.current = null
      channelRef.current = null

      if (room) {
        room.removeAllListeners()
        room.disconnect().catch(() => {})
      }

      if (channelId && socket) {
        socket.emit('voice:leave', { channelId })
      }
    }
  }, [socket])

  const value = useMemo(
    () => ({
      currentChannelId,
      connectionState,
      isConnected: connectionState === 'connected',
      participants,
      activeSpeakerId,
      isMuted,
      isDeafened,
      isSharing,
      error,
      joinVoice,
      leaveVoice,
      toggleMute,
      toggleDeafen,
      toggleScreenShare,
    }),
    [
      currentChannelId,
      connectionState,
      participants,
      activeSpeakerId,
      isMuted,
      isDeafened,
      isSharing,
      error,
      joinVoice,
      leaveVoice,
      toggleMute,
      toggleDeafen,
      toggleScreenShare,
    ],
  )

  return (
    <VoiceContext.Provider value={value}>
      {children}
      <div ref={audioContainerRef} className="voice-audio-sink" />
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const context = useContext(VoiceContext)

  if (!context) {
    throw new Error('useVoice phải được dùng bên trong VoiceProvider')
  }

  return context
}
