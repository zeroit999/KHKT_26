import { forumApi } from '../../../services/forumApi'

export const db = Object.freeze({ driver: 'sql-api' })

const POLL_MS = 3000

export const documentId = () => '__document_id__'
export const serverTimestamp = () => new Date().toISOString()
export const arrayUnion = (...values) => ({ __sqlArrayOp: 'union', values })
export const arrayRemove = (...values) => ({ __sqlArrayOp: 'remove', values })

export const collection = (_db, ...parts) => ({ kind: 'collection', parts: parts.map(String) })
export const collectionGroup = (_db, name) => ({ kind: 'collectionGroup', name: String(name) })
export const doc = (_db, ...parts) => ({ kind: 'doc', parts: parts.map(String) })
export const where = (field, op, value) => ({ kind: 'where', field, op, value })
export const orderBy = (field, direction = 'asc') => ({ kind: 'orderBy', field, direction })
export const limit = (value) => ({ kind: 'limit', value: Number(value || 0) })
export const query = (source, ...clauses) => ({ kind: 'query', source, clauses })

const partsOf = (ref) => ref?.parts || ref?.source?.parts || []
const clausesOf = (ref) => ref?.clauses || []
const normalizeId = (value) => String(value ?? '')
const getWhere = (ref, field) => clausesOf(ref).find((item) => item?.kind === 'where' && item.field === field)
const getLimit = (ref, fallback = 300) => clausesOf(ref).find((item) => item?.kind === 'limit')?.value || fallback

const snapDoc = (id, data, ref = null) => ({
  id: String(id),
  ref,
  exists: () => Boolean(data),
  data: () => data || {},
})

const snapQuery = (items = [], refFactory = null) => ({
  docs: items.map((item) => snapDoc(
    item.id ?? item.uid ?? item.userId,
    item,
    refFactory ? refFactory(item) : null,
  )),
  empty: items.length === 0,
  size: items.length,
})

const getUsers = async () => (await forumApi.users()).users || []
const getGroups = async () => (await forumApi.groups()).groups || []

const read = async (ref) => {
  if (ref?.kind === 'doc') {
    const parts = partsOf(ref)

    if (parts[0] === 'users' && parts[1]) {
      const users = await getUsers()
      return { type: 'doc', id: parts[1], data: users.find((u) => normalizeId(u.id ?? u.uid) === normalizeId(parts[1])) || null }
    }

    if (parts[0] === 'forumGroups' && parts[1] && parts.length === 2) {
      const groups = await getGroups()
      return { type: 'doc', id: parts[1], data: groups.find((g) => normalizeId(g.id) === normalizeId(parts[1])) || null }
    }

    if (parts[0] === 'forumGroupChats' && parts[1] && parts.length === 2) {
      const [groupId, ...rest] = parts[1].split('_')
      const channelId = rest.join('_')
      const messages = (await forumApi.groupMessages(groupId, channelId, 500)).messages || []
      return { type: 'doc', id: parts[1], data: { pinnedIds: messages.filter((m) => m.isPinned).map((m) => String(m.id)) } }
    }

    if (parts[0] === 'forumGroups' && parts[2] === 'presence' && parts[1] && parts[3]) {
      const presence = (await forumApi.groupPresence(parts[1])).presence || []
      return { type: 'doc', id: parts[3], data: presence.find((p) => normalizeId(p.userId) === normalizeId(parts[3])) || null }
    }

    if (parts[0] === 'forumGroupChats' && parts[2] === 'messages' && parts[1] && parts[3]) {
      const [groupId, ...rest] = parts[1].split('_')
      const channelId = rest.join('_')
      const messages = (await forumApi.groupMessages(groupId, channelId, 500)).messages || []
      return { type: 'doc', id: parts[3], data: messages.find((m) => normalizeId(m.id) === normalizeId(parts[3])) || null }
    }

    return { type: 'doc', id: parts.at(-1) || '', data: null }
  }

  const source = ref?.kind === 'query' ? ref.source : ref

  if (source?.kind === 'collectionGroup' && source.name === 'presence') {
    const groups = await getGroups()
    const items = []
    for (const group of groups) {
      try {
        const presence = (await forumApi.groupPresence(group.id)).presence || []
        presence.filter((p) => p.online !== false).forEach((p) => items.push({ ...p, groupId: String(group.id) }))
      } catch {
        // Ignore groups unavailable to the current user.
      }
    }
    return { type: 'query', items }
  }

  const parts = partsOf(source)

  if (parts[0] === 'users') {
    let items = await getUsers()
    const idFilter = getWhere(ref, '__document_id__')
    if (idFilter?.op === 'in' && Array.isArray(idFilter.value)) {
      const accepted = new Set(idFilter.value.map(normalizeId))
      items = items.filter((item) => accepted.has(normalizeId(item.id ?? item.uid)))
    }
    return { type: 'query', items: items.slice(0, getLimit(ref, 1000)) }
  }

  if (parts[0] === 'forumGroups' && parts[2] === 'presence' && parts[1]) {
    return { type: 'query', items: (await forumApi.groupPresence(parts[1])).presence || [] }
  }

  if (parts[0] === 'forumGroupChats' && parts[2] === 'messages' && parts[1]) {
    const [groupId, ...rest] = parts[1].split('_')
    return {
      type: 'query',
      items: (await forumApi.groupMessages(groupId, rest.join('_'), getLimit(ref, 300))).messages || [],
    }
  }

  if (parts[0] === 'forumNotifications') {
    let items = (await forumApi.notifications()).notifications || []
    const toUser = getWhere(ref, 'toUserId')
    if (toUser?.op === '==') items = items.filter((item) => normalizeId(item.toUserId) === normalizeId(toUser.value))
    return { type: 'query', items }
  }

  return { type: 'query', items: [] }
}

const makeSnapshot = (ref, result) => {
  if (result.type === 'doc') return snapDoc(result.id, result.data, ref)

  return snapQuery(result.items, (item) => {
    const source = ref?.kind === 'query' ? ref.source : ref
    const parts = partsOf(source)

    if (parts[0] === 'forumNotifications') return doc(db, 'forumNotifications', item.id)
    if (parts[0] === 'forumGroupChats' && parts[2] === 'messages') return doc(db, 'forumGroupChats', parts[1], 'messages', item.id)
    if (parts[0] === 'forumGroups' && parts[2] === 'presence') return doc(db, 'forumGroups', parts[1], 'presence', item.userId)

    return doc(db, parts[0] || 'items', item.id ?? item.uid ?? item.userId)
  })
}

export const getDocs = async (ref) => makeSnapshot(ref, await read(ref))

export const onSnapshot = (ref, onNext, onError = () => {}) => {
  let stopped = false
  let timer

  const load = async () => {
    try {
      const result = await read(ref)
      if (!stopped) onNext(makeSnapshot(ref, result))
    } catch (error) {
      if (!stopped) onError(error)
    }
  }

  load()
  timer = window.setInterval(load, POLL_MS)

  return () => {
    stopped = true
    if (timer) window.clearInterval(timer)
  }
}

const applyArrayOperation = (current = [], operation) => {
  if (!operation?.__sqlArrayOp) return operation
  const base = Array.isArray(current) ? current.map(normalizeId) : []
  const values = (operation.values || []).map(normalizeId)

  if (operation.__sqlArrayOp === 'union') return [...new Set([...base, ...values])]
  return base.filter((value) => !values.includes(value))
}

const updateLegacyGroup = async (groupId, payload) => {
  const group = (await getGroups()).find((item) => normalizeId(item.id) === normalizeId(groupId))
  if (!group) throw new Error('Nhóm không tồn tại.')

  const direct = {}
  const actions = []

  for (const [key, value] of Object.entries(payload || {})) {
    if (key === 'updatedAt' || key === 'membersCount') continue

    if (key === 'memberIds' && value?.__sqlArrayOp) {
      const before = new Set((group.memberIds || []).map(normalizeId))
      const after = new Set(applyArrayOperation(group.memberIds, value))
      for (const id of after) if (!before.has(id)) actions.push([id, 'approve'])
      for (const id of before) if (!after.has(id)) actions.push([id, 'kick'])
      continue
    }

    if (key === 'pendingMemberIds' && value?.__sqlArrayOp) {
      const before = new Set((group.pendingMemberIds || []).map(normalizeId))
      const after = new Set(applyArrayOperation(group.pendingMemberIds, value))
      for (const id of before) if (!after.has(id) && !actions.some(([uid]) => uid === id)) actions.push([id, 'reject'])
      continue
    }

    if (key === 'adminIds' && value?.__sqlArrayOp) {
      const before = new Set((group.adminIds || []).map(normalizeId))
      const after = new Set(applyArrayOperation(group.adminIds, value))
      for (const id of after) if (!before.has(id)) actions.push([id, 'promote'])
      for (const id of before) if (!after.has(id)) actions.push([id, 'demote'])
      continue
    }

    if (key === 'ownerId') {
      if (value && normalizeId(value) !== normalizeId(group.ownerId)) actions.push([normalizeId(value), 'transfer-owner'])
      continue
    }

    if (key.startsWith('deputyPermissions.')) {
      const subKey = key.split('.')[1]
      direct.deputyPermissions = { ...(group.deputyPermissions || {}), [subKey]: value }
      continue
    }

    direct[key] = value
  }

  if (Object.keys(direct).length) await forumApi.updateGroup(groupId, direct)
  for (const [userId, action] of actions) await forumApi.manageGroupMember(groupId, userId, action)

  return { success: true }
}

export const setDoc = async (ref, payload) => {
  const parts = partsOf(ref)

  if (parts[0] === 'users' && parts[1]) {
    if (payload?.pinnedGroupIds?.__sqlArrayOp) {
      const me = await forumApi.me()
      const user = me?.user || me || {}
      const current = Array.isArray(user.pinnedGroupIds) ? user.pinnedGroupIds : []
      return forumApi.updateMyForumSettings({
        pinnedGroupIds: applyArrayOperation(current, payload.pinnedGroupIds),
      })
    }
    return forumApi.updateMyForumSettings(payload)
  }

  if (parts[0] === 'forumGroups' && parts[2] === 'presence' && parts[1]) {
    return forumApi.updateGroupPresence(parts[1], {
      channelId: payload.channelId || '',
      channelLabel: payload.channelLabel || '',
      online: payload.online !== false,
    })
  }

  if (parts[0] === 'forumGroupChats' && parts[1] && parts.length === 2) {
    const [groupId, ...rest] = parts[1].split('_')
    const channelId = rest.join('_')
    const desired = new Set((payload?.pinnedIds || []).map(normalizeId))
    const messages = (await forumApi.groupMessages(groupId, channelId, 500)).messages || []

    for (const message of messages) {
      const pinned = desired.has(normalizeId(message.id))
      if (Boolean(message.isPinned) !== pinned) {
        await forumApi.updateGroupMessage(groupId, message.id, { action: 'pin', pinned })
      }
    }
    return { success: true }
  }

  if (parts[0] === 'forumGroups' && parts[1]) return forumApi.updateGroup(parts[1], payload)

  return { success: true }
}

export const updateDoc = async (ref, payload) => {
  const parts = partsOf(ref)

  if (parts[0] === 'forumGroupChats' && parts[2] === 'messages' && parts[1] && parts[3]) {
    const [groupId, ...rest] = parts[1].split('_')
    const channelId = rest.join('_')
    const messageId = parts[3]

    if (Object.prototype.hasOwnProperty.call(payload, 'reactions')) {
      const messages = (await forumApi.groupMessages(groupId, channelId, 500)).messages || []
      const current = messages.find((item) => normalizeId(item.id) === normalizeId(messageId)) || {}
      const desired = payload.reactions || {}
      const changed = Object.keys(desired).find((uid) => desired[uid] !== current.reactions?.[uid])
      const removed = Object.keys(current.reactions || {}).find((uid) => !Object.prototype.hasOwnProperty.call(desired, uid))
      const uid = changed || removed
      const emoji = uid ? desired[uid] || current.reactions?.[uid] || '' : ''
      return forumApi.reactGroupMessage(groupId, messageId, emoji)
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'content')) {
      return forumApi.updateGroupMessage(groupId, messageId, { action: 'edit', content: payload.content })
    }

    return { success: true }
  }

  if (parts[0] === 'forumGroups' && parts[2] === 'presence' && parts[1]) {
    return forumApi.updateGroupPresence(parts[1], {
      channelId: payload.channelId || '',
      channelLabel: payload.channelLabel || '',
      online: payload.online !== false,
    })
  }

  if (parts[0] === 'forumGroups' && parts[1]) return updateLegacyGroup(parts[1], payload)

  return setDoc(ref, payload)
}

export const addDoc = async (ref, payload) => {
  const parts = partsOf(ref)

  if (parts[0] === 'forumGroupChats' && parts[2] === 'messages' && parts[1]) {
    const [groupId, ...rest] = parts[1].split('_')
    const response = await forumApi.sendGroupMessage(groupId, {
      ...payload,
      channelId: rest.join('_'),
      createdAt: undefined,
    })
    return doc(db, 'forumGroupChats', parts[1], 'messages', response.message?.id || '')
  }

  if (parts[0] === 'forumNotifications') {
    return forumApi.broadcastNotification({
      audience: payload.groupId ? 'group-members' : 'admins',
      groupId: payload.groupId || '',
      type: payload.type || 'group-notice',
      text: payload.text || payload.title || '',
      category: payload.category || 'group',
      scope: payload.scope || 'group',
    })
  }

  return { success: true }
}

export const deleteDoc = async (ref) => {
  const parts = partsOf(ref)

  if (parts[0] === 'forumNotifications' && parts[1]) return forumApi.deleteNotification(parts[1])

  if (parts[0] === 'forumGroupChats' && parts[2] === 'messages' && parts[1] && parts[3]) {
    const [groupId] = parts[1].split('_')
    return forumApi.deleteGroupMessage(groupId, parts[3])
  }

  if (parts[0] === 'forumGroupChats' && parts[1] && parts.length === 2) {
    const [groupId, ...rest] = parts[1].split('_')
    return forumApi.deleteGroupChannelMessages(groupId, rest.join('_'))
  }

  return { success: true }
}