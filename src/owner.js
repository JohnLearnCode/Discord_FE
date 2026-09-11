export function getOwnerId(server) {
  if (!server) return null
  const owner = server.ownerId
  if (owner && typeof owner === 'object') return owner._id
  return owner || null
}

export function isServerOwner(server, userId) {
  if (!server || !userId) return false
  return getOwnerId(server) === userId
}
