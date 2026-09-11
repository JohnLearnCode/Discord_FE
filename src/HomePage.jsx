import { useEffect, useState } from 'react'
import ServerRail from './components/ServerRail.jsx'
import ChannelSidebar from './components/ChannelSidebar.jsx'
import ChatArea from './components/ChatArea.jsx'
import MemberList from './components/MemberList.jsx'
import FriendsPage from './FriendsPage.jsx'
import { api } from './api.js'
import { getSocket } from './socket.js'
import { isServerOwner } from './owner.js'
import { VoiceProvider, useVoice } from './voice/VoiceContext.jsx'
import './HomePage.css'

function isMyServer(server, userId) {
  return (server.memberIds || []).includes(userId)
}

function HomePageContent({ user, token, onLogout, socket }) {
  const { currentChannelId } = useVoice()
  const [view, setView] = useState('friends')
  const [servers, setServers] = useState([])
  const [catalogs, setCatalogs] = useState([])
  const [textChannels, setTextChannels] = useState([])
  const [voiceChannels, setVoiceChannels] = useState([])
  const [users, setUsers] = useState([])
  const [activeServer, setActiveServer] = useState(null)
  const [activeChannel, setActiveChannel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [voicePresence, setVoicePresence] = useState({})
  const [refreshKey, setRefreshKey] = useState(0)

  const canManageActiveServer = isServerOwner(activeServer, user._id)

  function denyPermission() {
    window.alert('Bạn không có quyền thực hiện thao tác này. Chỉ chủ sở hữu máy chủ mới có thể sửa/xóa máy chủ, danh mục và kênh.')
  }

  function refresh() {
    setRefreshKey((key) => key + 1)
  }

  useEffect(() => {
    if (!socket) return undefined

    function handlePresence(snapshot) {
      setVoicePresence(snapshot || {})
    }

    socket.on('voice:presence', handlePresence)
    return () => socket.off('voice:presence', handlePresence)
  }, [socket])

  async function handleCreateServer({ name, iconUrl }) {
    const newServer = await api.createServer({
      name,
      ownerId: user._id,
      iconUrl: iconUrl || '',
    })

    setServers((prev) => [...prev, newServer])
    setActiveServer(newServer)
    refresh()
  }

  function handleServerJoined() {
    refresh()
  }

  async function handleCreateCatalog(serverId, title) {
    if (!isServerOwner(servers.find((s) => s._id === serverId), user._id)) {
      denyPermission()
      return
    }

    const newCatalog = await api.createCatalog(title)
    const server = servers.find((s) => s._id === serverId)
    const catalogIds = [...(server?.catalogIds || []), newCatalog._id]

    await api.updateServer(serverId, { catalogIds })
    refresh()
  }

  async function handleUpdateServer(serverId, payload) {
    if (!isServerOwner(servers.find((s) => s._id === serverId), user._id)) {
      denyPermission()
      return
    }

    await api.updateServer(serverId, payload)
    refresh()
  }

  async function handleDeleteServer(serverId) {
    if (!isServerOwner(servers.find((s) => s._id === serverId), user._id)) {
      denyPermission()
      return
    }

    await api.deleteServer(serverId)
    refresh()
  }

  async function handleUpdateChannel(channel, title) {
    if (!canManageActiveServer) {
      denyPermission()
      return
    }

    if (channel.type === 'text') {
      await api.updateTextChannel(channel._id, title)
    } else {
      await api.updateVoiceChannel(channel._id, title)
    }

    refresh()
  }

  async function handleDeleteChannel(channel) {
    if (!canManageActiveServer) {
      denyPermission()
      return
    }

    if (channel.type === 'text') {
      await api.deleteTextChannel(channel._id)
    } else {
      await api.deleteVoiceChannel(channel._id)
    }

    refresh()
  }

  async function handleUpdateCatalog(catalogId, title) {
    if (!canManageActiveServer) {
      denyPermission()
      return
    }

    await api.updateCatalog(catalogId, { title })
    refresh()
  }

  async function handleDeleteCatalog(catalogId) {
    if (!canManageActiveServer) {
      denyPermission()
      return
    }

    await api.deleteCatalog(catalogId)
    refresh()
  }

  async function handleCreateChannel(catalogId, type, title) {
    if (!canManageActiveServer) {
      denyPermission()
      return
    }

    const newChannel =
      type === 'text'
        ? await api.createTextChannel(title)
        : await api.createVoiceChannel(title)

    const catalog = await api.getCatalog(catalogId)
    const channelIds = [...(catalog.channelIds || []), newChannel._id]

    await api.updateCatalog(catalogId, { channelIds })
    refresh()
  }

  useEffect(() => {
    let cancelled = false

    Promise.all([api.getServers(), api.getUsers()])
      .then(([serverData, userData]) => {
        if (cancelled) return

        const myServers = serverData.filter((s) => isMyServer(s, user._id))

        setServers(myServers)
        setUsers(userData)

        setActiveServer((prev) => {
          if (prev) {
            const stillExists = myServers.find((s) => s._id === prev._id)
            if (stillExists) return stillExists
          }
          return myServers[0] || null
        })
      })
      .catch((err) => {
        console.error('Failed to load app data:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey, user._id])

  useEffect(() => {
    if (!activeServer) {
      setCatalogs([])
      setTextChannels([])
      setVoiceChannels([])
      setActiveChannel(null)
      return undefined
    }

    let cancelled = false
    const serverId = activeServer._id

    api
      .getServerChannels(serverId)
      .then((data) => {
        if (cancelled) return

        const serverCatalogs = data.catalogs || []
        const serverTextChannels = data.textChannels || []
        const serverVoiceChannels = data.voiceChannels || []
        const allChannels = [...serverTextChannels, ...serverVoiceChannels]

        setCatalogs(serverCatalogs)
        setTextChannels(serverTextChannels)
        setVoiceChannels(serverVoiceChannels)

        setActiveChannel((prev) => {
          if (prev) {
            const stillExists = allChannels.find((c) => c._id === prev._id)
            if (stillExists) return stillExists
          }
          const firstChannelId = serverCatalogs[0]?.channelIds?.[0]
          return allChannels.find((c) => c._id === firstChannelId) || null
        })
      })
      .catch((err) => {
        if (!cancelled) console.error('Failed to load server channels:', err)
      })

    return () => {
      cancelled = true
    }
  }, [activeServer?._id, refreshKey])

  if (loading) {
    return <div className="home-loading">Đang tải Discord...</div>
  }

  return (
    <div className="app-shell">
      <ServerRail
        servers={servers}
        currentUserId={user._id}
        activeServerId={view === 'friends' ? null : activeServer?._id}
        onSelectServer={(server) => {
          setActiveServer(server)
          setView('home')
        }}
        onCreateServer={handleCreateServer}
        onUpdateServer={handleUpdateServer}
        onDeleteServer={handleDeleteServer}
        homeActive={view === 'friends'}
        onHomeClick={() => setView('friends')}
      />
      {view === 'friends' ? (
        <FriendsPage
          user={user}
          token={token}
          onLogout={onLogout}
          onServerJoined={handleServerJoined}
        />
      ) : (
        <div className="server-view">
          <ChannelSidebar
            server={activeServer}
            catalogs={catalogs}
            textChannels={textChannels}
            voiceChannels={voiceChannels}
            activeChannelId={activeChannel?._id}
            voicePresence={voicePresence}
            activeVoiceChannelId={currentChannelId}
            onSelectChannel={setActiveChannel}
            onLogout={onLogout}
            canManage={canManageActiveServer}
            onCreateCatalog={(title) => handleCreateCatalog(activeServer._id, title)}
            onCreateChannel={handleCreateChannel}
            onUpdateChannel={handleUpdateChannel}
            onDeleteChannel={handleDeleteChannel}
            onUpdateCatalog={handleUpdateCatalog}
            onDeleteCatalog={handleDeleteCatalog}
          />
          <ChatArea user={user} channel={activeChannel} token={token} />
          <MemberList server={activeServer} users={users} />
        </div>
      )}
    </div>
  )
}

export default function HomePage({ user, token, onLogout }) {
  const socket = getSocket(token)

  return (
    <VoiceProvider socket={socket}>
      <HomePageContent user={user} token={token} onLogout={onLogout} socket={socket} />
    </VoiceProvider>
  )
}
