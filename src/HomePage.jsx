import { useEffect, useState } from 'react'
import ServerRail from './components/ServerRail.jsx'
import ChannelSidebar from './components/ChannelSidebar.jsx'
import ChatArea from './components/ChatArea.jsx'
import MemberList from './components/MemberList.jsx'
import FriendsPage from './FriendsPage.jsx'
import { api } from './api.js'
import './HomePage.css'

export default function HomePage({ user, onLogout }) {
  const [view, setView] = useState('friends')
  const [servers, setServers] = useState([])
  const [catalogs, setCatalogs] = useState([])
  const [textChannels, setTextChannels] = useState([])
  const [voiceChannels, setVoiceChannels] = useState([])
  const [users, setUsers] = useState([])
  const [activeServer, setActiveServer] = useState(null)
  const [activeChannel, setActiveChannel] = useState(null)
  const [loading, setLoading] = useState(true)

  async function handleCreateServer({ name, iconUrl }) {
    const newServer = await api.createServer({
      name,
      ownerId: user._id,
      iconUrl: iconUrl || '',
    })

    setServers((prev) => [...prev, newServer])
    setActiveServer(newServer)
  }

  async function handleUpdateChannel(channel, title) {
    if (channel.type === 'text') {
      const updated = await api.updateTextChannel(channel._id, title)
      setTextChannels((prev) =>
        prev.map((c) => (c._id === channel._id ? updated : c)),
      )
    } else {
      const updated = await api.updateVoiceChannel(channel._id, title)
      setVoiceChannels((prev) =>
        prev.map((c) => (c._id === channel._id ? updated : c)),
      )
    }

    if (activeChannel?._id === channel._id) {
      setActiveChannel({ ...channel, title })
    }
  }

  async function handleDeleteChannel(channel) {
    if (channel.type === 'text') {
      await api.deleteTextChannel(channel._id)
      setTextChannels((prev) => prev.filter((c) => c._id !== channel._id))
    } else {
      await api.deleteVoiceChannel(channel._id)
      setVoiceChannels((prev) => prev.filter((c) => c._id !== channel._id))
    }

    setCatalogs((prev) =>
      prev.map((c) => ({
        ...c,
        channelIds: (c.channelIds || []).filter((id) => id !== channel._id),
      })),
    )

    if (activeChannel?._id === channel._id) {
      setActiveChannel(null)
    }
  }

  async function handleCreateChannel(catalogId, type, title) {
    const newChannel =
      type === 'text'
        ? await api.createTextChannel(title)
        : await api.createVoiceChannel(title)

    const catalog = await api.getCatalog(catalogId)
    const channelIds = [...(catalog.channelIds || []), newChannel._id]

    await api.updateCatalog(catalogId, { channelIds })

    if (type === 'text') {
      setTextChannels((prev) => [...prev, newChannel])
    } else {
      setVoiceChannels((prev) => [...prev, newChannel])
    }

    setCatalogs((prev) =>
      prev.map((c) =>
        c._id === catalogId ? { ...c, channelIds } : c,
      ),
    )
  }

  useEffect(() => {
    Promise.all([
      api.getServers(),
      api.getCatalogs(),
      api.getTextChannels(),
      api.getVoiceChannels(),
      api.getUsers(),
    ])
      .then(([serverData, catalogData, textData, voiceData, userData]) => {
        setServers(serverData)
        setCatalogs(catalogData)
        setTextChannels(textData)
        setVoiceChannels(voiceData)
        setUsers(userData)

        if (serverData.length > 0) {
          setActiveServer(serverData[0])
        }
      })
      .catch((err) => {
        console.error('Failed to load app data:', err)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (activeServer) {
      const firstCatalog = catalogs.find((c) => activeServer.catalogIds?.includes(c._id))
      const firstChannelId = firstCatalog?.channelIds?.[0]
      if (firstChannelId) {
        const channel =
          textChannels.find((c) => c._id === firstChannelId) ||
          voiceChannels.find((c) => c._id === firstChannelId)
        setActiveChannel(channel || null)
      } else {
        setActiveChannel(null)
      }
    }
  }, [activeServer, catalogs, textChannels, voiceChannels])

  if (loading) {
    return <div className="home-loading">Đang tải Discord...</div>
  }

  return (
    <div className="app-shell">
      <ServerRail
        servers={servers}
        activeServerId={view === 'friends' ? null : activeServer?._id}
        onSelectServer={(server) => {
          setActiveServer(server)
          setView('home')
        }}
        onCreateServer={handleCreateServer}
        homeActive={view === 'friends'}
        onHomeClick={() => setView('friends')}
      />
      {view === 'friends' ? (
        <FriendsPage user={user} />
      ) : (
        <div className="server-view">
          <ChannelSidebar
            server={activeServer}
            catalogs={catalogs}
            textChannels={textChannels}
            voiceChannels={voiceChannels}
            activeChannelId={activeChannel?._id}
            onSelectChannel={setActiveChannel}
            onCreateChannel={handleCreateChannel}
            onUpdateChannel={handleUpdateChannel}
            onDeleteChannel={handleDeleteChannel}
          />
          <ChatArea user={user} channel={activeChannel} />
          <MemberList server={activeServer} users={users} />
        </div>
      )}
    </div>
  )
}
