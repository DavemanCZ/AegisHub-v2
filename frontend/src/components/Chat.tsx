import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Plus, Send, Loader2, Hash, Trash2, Lock, Paperclip, X, Image as ImageIcon, UserPlus, UserCheck, UserX, ShieldOff } from 'lucide-react';
import {
  fetchChannels, createChannel, deleteChannel,
  fetchMessages, sendMessage, Channel, ChatMessage,
  fetchDMConversations, fetchDMMessages, sendDMMessage, DMMessage, DMConversation, deleteDMMessage, deleteDMConversation,
  uploadFile,
  fetchFriends, sendFriendRequest, respondFriendRequest, blockUser, FriendEntry, fetchBlockedUsers, unblockUser,
  searchUsers, fetchPublicSettings, deleteChatMessage
} from '../lib/api';
import {
  ECDHKeyPair, deriveSharedKey, encryptMessage, decryptMessage,
  encryptFileMessage, decryptFileMessage, isFileMessage,
  fetchPublicKeys, encryptFileWithKey
} from '../lib/cryptoE2E';

type ActiveView =
  | { type: 'channel'; channel: Channel }
  | { type: 'dm'; userId: string; username: string };

interface RenderedMsg {
  id: string;
  senderName: string;
  content: string;
  fileInfo?: { file_id: string; name: string; mime: string } | null;
  createdAt: string;
  isMe: boolean;
}

// ─── FilePreview – inline náhled obrázků a stahování souborů ─────────────────
function FilePreview({ fileInfo, isMe, partnerId, jwtToken, getSharedKey }: {
  fileInfo: { file_id: string; name: string; mime: string };
  isMe: boolean; partnerId: string; jwtToken: string;
  getSharedKey: (id: string) => Promise<CryptoKey | null>;
}) {
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const isImg = fileInfo.mime?.startsWith('image/');

  const handleAction = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const sharedKey = await getSharedKey(partnerId);
      if (!sharedKey) { alert('Nelze dešifrovat'); return; }
      const { decryptFileWithKey } = await import('../lib/cryptoE2E');
      const { downloadFile } = await import('../lib/api');
      const { blob, nonce } = await downloadFile(jwtToken, fileInfo.file_id);
      const raw = await blob.arrayBuffer();
      const dec = await decryptFileWithKey(sharedKey, raw, nonce);
      const url = URL.createObjectURL(new Blob([dec], { type: fileInfo.mime }));
      if (isImg) { setObjectUrl(url); }
      else {
        const a = document.createElement('a'); a.href = url; a.download = fileInfo.name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const bubble: React.CSSProperties = {
    maxWidth: '280px', borderRadius: isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
    overflow: 'hidden', background: isMe ? '#4f46e5' : 'rgba(255,255,255,0.08)',
    cursor: objectUrl ? 'default' : 'pointer',
  };

  if (objectUrl) return (
    <div style={bubble}>
      <img src={objectUrl} alt={fileInfo.name} style={{ width: '100%', display: 'block', maxHeight: '300px', objectFit: 'contain' }} />
      <div style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', opacity: 0.7, display: 'flex', justifyContent: 'space-between' }}>
        <span>{fileInfo.name}</span>
        <a href={objectUrl} download={fileInfo.name} style={{ color: 'inherit' }}>⬇</a>
      </div>
    </div>
  );

  return (
    <div onClick={handleAction} style={{ ...bubble, padding: '0.5rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
      {loading ? <Loader2 size={14} className="spinner" /> : (isImg ? <ImageIcon size={14} /> : <Paperclip size={14} />)}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{fileInfo.name}</span>
      {!loading && <span style={{ opacity: 0.6, fontSize: '0.75rem', flexShrink: 0 }}>{isImg ? 'Zobrazit' : '⬇'}</span>}
    </div>
  );
}

function stringToColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${hash % 360}, 65%, 55%)`;
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const color = stringToColor(name || '?');
  const initials = (name || '?').substring(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45,
      fontWeight: 600, flexShrink: 0, textShadow: '0 1px 2px rgba(0,0,0,0.3)',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
    }}>
      {initials}
    </div>
  );
}

export function Chat({
  jwtToken, isAdmin, username, ecdhKeyPair, onUnreadChange
}: {
  jwtToken: string;
  isAdmin: boolean;
  username: string;
  ecdhKeyPair: ECDHKeyPair | null;
  onUnreadChange?: (n: number) => void;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([]);
  const [activeView, setActiveView] = useState<ActiveView | null>(null);
  const [rendered, setRendered] = useState<RenderedMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [addFriendSearch, setAddFriendSearch] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<{ id: string; username: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [newChName, setNewChName] = useState('');
  const [newChDesc, setNewChDesc] = useState('');
  const [maxUploadMb, setMaxUploadMb] = useState(100);
  const [pubKeys, setPubKeys] = useState<Record<string, CryptoKey>>({});
  const [totalUnread, setTotalUnread] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; username: string }[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sharedKeyCache = useRef<Record<string, CryptoKey>>({});

  // Derive or get shared key for a DM partner
  const getSharedKey = useCallback(async (partnerId: string): Promise<CryptoKey | null> => {
    if (!ecdhKeyPair) return null;
    if (sharedKeyCache.current[partnerId]) return sharedKeyCache.current[partnerId];
    const partnerKey = pubKeys[partnerId];
    if (!partnerKey) return null;
    const sk = await deriveSharedKey(ecdhKeyPair.privateKey, partnerKey);
    sharedKeyCache.current[partnerId] = sk;
    return sk;
  }, [ecdhKeyPair, pubKeys]);

  // Decrypt and render messages
  const renderMessages = useCallback(async (
    msgs: (ChatMessage | DMMessage)[],
    isDM: boolean,
    partnerId?: string
  ) => {
    const sharedKey = isDM && partnerId ? await getSharedKey(partnerId) : null;
    const result: RenderedMsg[] = [];
    for (const m of msgs) {
      const senderName = (m as any).username || (m as any).sender_username;
      let content = m.content;
      let fileInfo: RenderedMsg['fileInfo'] = null;
      if (isDM && sharedKey) {
        if (isFileMessage(content)) {
          fileInfo = await decryptFileMessage(sharedKey, content);
          content = fileInfo ? `📎 ${fileInfo.name}` : '📎 [Soubor]';
        } else {
          content = await decryptMessage(sharedKey, content);
        }
      }
      result.push({ id: m.id, senderName, content, fileInfo, createdAt: m.created_at, isMe: senderName === username });
    }
    setRendered(result);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [getSharedKey, username]);

  const loadData = useCallback(async () => {
    try {
      const [ch, dmData, pks, fr, pub, blocks] = await Promise.all([
        fetchChannels(jwtToken),
        fetchDMConversations(jwtToken),
        fetchPublicKeys(jwtToken),
        fetchFriends(jwtToken),
        fetchPublicSettings(),
        fetchBlockedUsers(jwtToken)
      ]);
      setMaxUploadMb(parseInt(pub.max_upload_mb || '100', 10));
      setChannels(ch);
      setDmConversations(dmData.conversations);
      setPubKeys(pks);
      setFriends(fr);
      setBlockedUsers(blocks);
      const unread = dmData.conversations.reduce((s: number, c: DMConversation) => s + c.unread_count, 0);
      setTotalUnread(unread);
      onUnreadChange?.(unread);
      if (!activeView && ch.length > 0) setActiveView({ type: 'channel', channel: ch[0] });
    } catch { /* ignore */ }
  }, [jwtToken]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reload DM conversations periodically for unread counts
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const dmData = await fetchDMConversations(jwtToken);
        setDmConversations(dmData.conversations);
        const unread = dmData.conversations.reduce((s: number, c: DMConversation) => s + c.unread_count, 0);
        setTotalUnread(unread);
        onUnreadChange?.(unread);
      } catch { /* ignore */ }
    }, 15000);
    return () => clearInterval(interval);
  }, [jwtToken]);

  // Load messages when view changes
  useEffect(() => {
    if (!activeView) return;
    sseRef.current?.close();

    const addMsg = async (m: any) => {
      if (m.type === 'clear_chat') {
        setRendered([]);
        return;
      }
      if (m.type === 'delete') {
        setRendered(prev => prev.filter(r => r.id !== m.id));
        return;
      }
      const isDM = activeView.type === 'dm';
      const partnerId = isDM ? (activeView as any).userId : undefined;
      const sharedKey = isDM && partnerId ? await getSharedKey(partnerId) : null;
      let content = m.content;
      let fileInfo: RenderedMsg['fileInfo'] = null;
      const senderName = m.username || m.sender_username;
      if (isDM && sharedKey) {
        if (isFileMessage(content)) {
          fileInfo = await decryptFileMessage(sharedKey, content);
          content = fileInfo ? `📎 ${fileInfo.name}` : '📎 [Soubor]';
        } else {
          content = await decryptMessage(sharedKey, content);
        }
      }
      const renderedMsg: RenderedMsg = { id: m.id, senderName, content, fileInfo, createdAt: m.created_at, isMe: senderName === username };
      setRendered(prev => prev.find(r => r.id === m.id) ? prev : [...prev, renderedMsg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    };

    let reconnectTimer: any;
    let sse: EventSource | null = null;
    let isMounted = true;

    const connectSSE = () => {
      if (!isMounted) return;
      if (sse) sse.close();

      if (activeView.type === 'channel') {
        fetchMessages(jwtToken, activeView.channel.id).then(msgs => {
          if (isMounted) renderMessages(msgs, false);
        });
        sse = new EventSource(`/api/chat/sse?channel=${activeView.channel.id}&token=${encodeURIComponent(jwtToken)}`);
      } else {
        const partnerId = (activeView as any).userId;
        fetchDMMessages(jwtToken, partnerId).then(msgs => {
          if (!isMounted) return;
          renderMessages(msgs, true, partnerId);
          // Mark as read
          setDmConversations(prev => prev.map(c => c.user_id === partnerId ? { ...c, unread_count: 0 } : c));
          setTotalUnread(prev => Math.max(0, prev - (dmConversations.find(c => c.user_id === partnerId)?.unread_count ?? 0)));
        });
        sse = new EventSource(`/api/dm/sse?with=${partnerId}&token=${encodeURIComponent(jwtToken)}`);
      }

      sse.onmessage = e => { try { addMsg(JSON.parse(e.data)); } catch { /* ignore */ } };
      sse.onerror = () => {
        sse?.close();
        if (isMounted) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectSSE, 3000); // auto reconnect po 3 vteřinách
        }
      };
      sseRef.current = sse;
    };

    connectSSE();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      sseRef.current?.close();
    };
  }, [activeView?.type === 'channel' ? (activeView as any).channel?.id : (activeView as any)?.userId, pubKeys]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !pendingFile) || !activeView || sending) return;
    setSending(true);
    try {
      if (activeView.type === 'channel') {
        if (input.trim()) {
          const msg = await sendMessage(jwtToken, activeView.channel.id, input.trim());
          setInput('');
          setRendered(prev => prev.find(r => r.id === msg.id) ? prev : [...prev, {
            id: msg.id, senderName: username, content: msg.content, fileInfo: null, createdAt: msg.created_at, isMe: true
          }]);
        }
      } else {
        const partnerId = (activeView as any).userId;
        const sharedKey = await getSharedKey(partnerId);
        if (!sharedKey) { alert('Cannot encrypt: user does not have a public key.'); setSending(false); return; }

        if (pendingFile) {
          if (pendingFile.size > maxUploadMb * 1024 * 1024) {
            alert(`Cannot send: file exceeds the limit of ${maxUploadMb} MB.`);
            setSending(false);
            return;
          }
          const raw = await pendingFile.arrayBuffer();
          setUploadPct(0);
          const { blob, nonceHex } = await encryptFileWithKey(sharedKey, raw);
          // Pass partnerId so recipient can download the file
          const { id: fileId } = await uploadFile(jwtToken, blob, pendingFile.name, pendingFile.type || 'application/octet-stream', nonceHex, partnerId, (pct) => setUploadPct(pct));
          const fileContent = await encryptFileMessage(sharedKey, fileId, pendingFile.name, pendingFile.type || 'application/octet-stream');
          const msg = await sendDMMessage(jwtToken, partnerId, fileContent);
          const savedFile = pendingFile;
          setPendingFile(null);
          setUploadPct(null);
          setRendered(prev => prev.find(r => r.id === msg.id) ? prev : [...prev, {
            id: msg.id, senderName: username, content: `📎 ${savedFile.name}`,
            fileInfo: { file_id: fileId, name: savedFile.name, mime: savedFile.type },
            createdAt: msg.created_at, isMe: true
          }]);
        }
        if (input.trim()) {
          const encContent = await encryptMessage(sharedKey, input.trim());
          const msg = await sendDMMessage(jwtToken, partnerId, encContent);
          setInput('');
          setRendered(prev => prev.find(r => r.id === msg.id) ? prev : [...prev, {
            id: msg.id, senderName: username, content: input.trim(), fileInfo: null, createdAt: msg.created_at, isMe: true
          }]);
        }
      }
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally { setSending(false); }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeView) return;
    if (!confirm('Are you sure you want to delete this message for everyone?')) return;
    try {
      if (activeView.type === 'channel') {
        await deleteChatMessage(jwtToken, activeView.channel.id, msgId);
      } else {
        const partnerId = (activeView as any).userId;
        await deleteDMMessage(jwtToken, partnerId, msgId);
      }
      setRendered(prev => prev.filter(r => r.id !== msgId));
    } catch (err: any) {
      alert('Cannot delete: ' + err.message);
    }
  };

  const openDM = (userId: string, uname: string) => {
    setActiveView({ type: 'dm', userId, username: uname });
    setShowUserList(false);
    setDmConversations(prev => prev.find(c => c.user_id === userId) ? prev : [
      { user_id: userId, username: uname, last_message: '', last_at: '', unread_count: 0, is_blocked_by_me: false, am_i_blocked: false }, ...prev
    ]);
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChName.trim()) return;
    try {
      const ch = await createChannel(jwtToken, newChName.trim().toLowerCase().replace(/\s+/g, '-'), newChDesc.trim());
      setChannels(prev => [...prev, ch]);
      setActiveView({ type: 'channel', channel: ch });
      setShowNewChannel(false); setNewChName(''); setNewChDesc('');
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  const isDMView = activeView?.type === 'dm';
  const dmPartnerId = isDMView ? (activeView as any).userId : '';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* ── Sidebar ── */}
      <div style={{ width: 220, borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
        {/* Channels section */}
        <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Channels</span>
            {isAdmin && <button className="btn-link" style={{ padding: '0.1rem' }} onClick={() => setShowNewChannel(!showNewChannel)}><Plus size={15} /></button>}
          </div>
          {showNewChannel && isAdmin && (
            <form onSubmit={handleCreateChannel} style={{ marginBottom: '0.5rem' }}>
              <input type="text" placeholder="channel-name" value={newChName} onChange={e => setNewChName(e.target.value)} className="input-field" style={{ margin: '0 0 0.3rem', fontSize: '0.8rem' }} required autoFocus />
              <input type="text" placeholder="Description" value={newChDesc} onChange={e => setNewChDesc(e.target.value)} className="input-field" style={{ margin: '0 0 0.3rem', fontSize: '0.8rem' }} />
              <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.3rem', fontSize: '0.8rem' }}>Create</button>
            </form>
          )}
          {channels.map(ch => {
            const isActive = activeView?.type === 'channel' && (activeView as any).channel.id === ch.id;
            return (
              <div key={ch.id} onClick={() => setActiveView({ type: 'channel', channel: ch })}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.5rem', borderRadius: '0.4rem', cursor: 'pointer', background: isActive ? 'rgba(99,102,241,0.2)' : 'transparent' }}>
                <Hash size={13} style={{ color: '#818cf8', flexShrink: 0 }} />
                <span style={{ fontSize: '0.84rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                {isAdmin && <button className="btn-link" style={{ padding: '0.1rem', color: '#ef4444', opacity: 0.4 }}
                  onClick={e => { e.stopPropagation(); if (confirm('Delete channel?')) { deleteChannel(jwtToken, ch.id); setChannels(prev => prev.filter(c => c.id !== ch.id)); if (isActive) setActiveView(null); } }}>
                  <Trash2 size={11} />
                </button>}
              </div>
            );
          })}
        </div>

        {/* DM section */}
        <div style={{ padding: '0.75rem', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Direct Messages</span>
              {totalUnread > 0 && (
                <span style={{ background: '#ef4444', borderRadius: '999px', padding: '0 0.35rem', fontSize: '0.65rem', fontWeight: 700, color: 'white' }}>{totalUnread}</span>
              )}
            </div>
            <button className="btn-link" style={{ padding: '0.1rem' }} onClick={() => setShowUserList(!showUserList)} title="Add friend / new DM"><UserPlus size={15} /></button>
          </div>

          {/* Add friend / search */}
          {showUserList && (
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '0.5rem', padding: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>Přidat přítele</div>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                <input type="text" placeholder="Jméno uživatele..." value={addFriendSearch}
                  onChange={async e => {
                    const q = e.target.value;
                    setAddFriendSearch(q);
                    if (q.length >= 1) {
                      setSearchLoading(true);
                      const results = await searchUsers(jwtToken, q);
                      setUserSearchResults(results);
                      setSearchLoading(false);
                    } else {
                      setUserSearchResults([]);
                    }
                  }}
                  className="input-field" style={{ margin: 0, flex: 1, fontSize: '0.78rem', padding: '0.3rem 0.5rem' }}
                  onKeyDown={e => { if (e.key === 'Escape') { setShowUserList(false); setAddFriendSearch(''); setUserSearchResults([]); } }}
                />
                {searchLoading && <Loader2 size={14} className="spinner" style={{ alignSelf: 'center' }} />}
              </div>
              {/* Search results */}
              {userSearchResults.length > 0 && (
                <div style={{ marginTop: '0.4rem', maxHeight: '120px', overflowY: 'auto' }}>
                  {userSearchResults.map(u => {
                    const alreadyFriend = friends.some(f => f.user_id === u.id);
                    return (
                      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.4rem', borderRadius: '0.3rem', cursor: 'pointer', fontSize: '0.82rem' }}
                        onClick={async () => {
                          if (alreadyFriend) return;
                          try {
                            await sendFriendRequest(jwtToken, u.id);
                            loadData();
                            setAddFriendSearch(''); setUserSearchResults([]); setShowUserList(false);
                          } catch (err: any) { alert(err.message); }
                        }}>
                        <UserPlus size={12} style={{ color: alreadyFriend ? '#6b7280' : '#10b981', flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{u.username}</span>
                        <span style={{ fontSize: '0.68rem', color: alreadyFriend ? '#6b7280' : '#10b981' }}>
                          {alreadyFriend ? (friends.find(f => f.user_id === u.id)?.status === 'pending' ? 'pending' : 'friend') : 'add'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {addFriendSearch.length >= 1 && userSearchResults.length === 0 && !searchLoading && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', textAlign: 'center' }}>No user found</div>
              )}
            </div>
          )}

          {/* Pending friend requests */}
          {(() => {
            const pending = friends.filter(f => f.status === 'pending' && f.direction === 'received');
            if (pending.length === 0) return null;
            return (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ background: '#f59e0b', color: '#000', borderRadius: '999px', padding: '0 0.3rem', fontSize: '0.6rem' }}>{pending.length}</span>
                  Friend Requests
                </div>
                {pending.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.4rem', borderRadius: '0.4rem', background: 'rgba(245,158,11,0.1)', marginBottom: '0.2rem' }}>
                    <span style={{ flex: 1, fontSize: '0.8rem' }}>{f.username}</span>
                    <button className="btn-link" style={{ color: '#10b981', padding: '0.1rem' }} title="Accept"
                      onClick={async () => { await respondFriendRequest(jwtToken, f.id, 'accept'); loadData(); }}>
                      <UserCheck size={13} />
                    </button>
                    <button className="btn-link" style={{ color: '#ef4444', padding: '0.1rem' }} title="Decline"
                      onClick={async () => { await respondFriendRequest(jwtToken, f.id, 'decline'); loadData(); }}>
                      <UserX size={13} />
                    </button>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Friends / conversations */}
          {dmConversations.map(c => {
            const isActive = activeView?.type === 'dm' && (activeView as any).userId === c.user_id;
            return (
              <div key={c.user_id}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.5rem', borderRadius: '0.4rem', cursor: 'pointer', background: isActive ? 'rgba(99,102,241,0.2)' : 'transparent' }}>
                <div onClick={() => openDM(c.user_id, c.username)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                  <Lock size={10} style={{ color: c.unread_count > 0 ? '#10b981' : '#6b7280', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.84rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: c.unread_count > 0 ? 700 : 400 }}>{c.username}</span>
                  {c.unread_count > 0 && (
                    <span style={{ background: '#6366f1', borderRadius: '999px', padding: '0 0.35rem', fontSize: '0.65rem', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>{c.unread_count}</span>
                  )}
                </div>
                <button className="btn-link" style={{ padding: '0.1rem', opacity: 0.3, color: '#ef4444', flexShrink: 0 }} title="Block"
                  onClick={async e => { e.stopPropagation(); if (confirm(`Block ${c.username}?`)) { await blockUser(jwtToken, c.user_id); loadData(); } }}>
                  <ShieldOff size={10} />
                </button>
              </div>
            );
          })}

          {/* Accepted friends not yet in conversations */}
          {friends.filter(f => f.status === 'accepted' && !dmConversations.find(c => c.user_id === f.user_id)).map(f => (
            <div key={f.user_id}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.35rem 0.5rem', borderRadius: '0.4rem', cursor: 'pointer' }}>
              <div onClick={() => openDM(f.user_id, f.username)} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: 1, minWidth: 0 }}>
                <Lock size={10} style={{ color: '#6b7280', flexShrink: 0 }} />
                <span style={{ fontSize: '0.84rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.username}</span>
              </div>
              <button className="btn-link" style={{ padding: '0.1rem', opacity: 0.3, color: '#ef4444', flexShrink: 0 }} title="Block"
                onClick={async e => { e.stopPropagation(); if (confirm(`Block ${f.username}?`)) { await blockUser(jwtToken, f.user_id); loadData(); } }}>
                <ShieldOff size={10} />
              </button>
            </div>
          ))}

          {/* Blocked Users */}
          {blockedUsers.length > 0 && (
            <div style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>
              <div style={{ fontSize: '0.68rem', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <ShieldOff size={10} /> Blocked Users
              </div>
              {blockedUsers.map(b => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.4rem', borderRadius: '0.4rem', background: 'rgba(239,68,68,0.1)', marginBottom: '0.2rem' }}>
                  <span style={{ flex: 1, fontSize: '0.8rem', color: '#fca5a5' }}>{b.username}</span>
                  <button className="btn-link" style={{ color: '#10b981', padding: '0.1rem', fontSize: '0.7rem' }} title="Unblock"
                    onClick={async () => { await unblockUser(jwtToken, b.id); loadData(); }}>
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User indicator */}
        <div style={{ padding: '0.6rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
          {username}
          {ecdhKeyPair && <span title="E2E keys active"><Lock size={9} style={{ color: '#10b981', marginLeft: '0.2rem' }} /></span>}
          {isAdmin && <span style={{ marginLeft: 'auto', color: '#a5b4fc', fontSize: '0.68rem' }}>admin</span>}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!activeView ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <MessageSquare size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
              <p>{isAdmin ? 'Create first channel or select user.' : 'Select channel or user.'}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '0.65rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isDMView ? <Lock size={15} style={{ color: '#10b981' }} /> : <Hash size={16} style={{ color: '#818cf8' }} />}
              <span style={{ fontWeight: 700 }}>{isDMView ? (activeView as any).username : (activeView as any).channel.name}</span>
              {isDMView && (
                <>
                  <span style={{ fontSize: '0.72rem', color: pubKeys[dmPartnerId] ? '#10b981' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {pubKeys[dmPartnerId] ? '🔒 E2E Encrypted' : '⚠️ User has no E2E key'}
                  </span>
                  <button className="btn-link" style={{ marginLeft: 'auto', color: '#ef4444', padding: '0.2rem' }} title="Delete Conversation" onClick={async () => {
                    if (confirm('Are you sure you want to delete this entire chat history?')) {
                      await deleteDMConversation(jwtToken, dmPartnerId);
                      setRendered([]);
                      loadData();
                    }
                  }}>
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {rendered.map((m, i) => {
                const showName = i === 0 || rendered[i - 1].senderName !== m.senderName;
                return (
                  <div key={m.id} style={{ display: 'flex', width: '100%', justifyContent: m.isMe ? 'flex-end' : 'flex-start', marginBottom: showName ? '0.5rem' : '0.15rem' }}>
                    {!m.isMe && (
                      <div style={{ width: '28px', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: showName ? '0.2rem' : '0' }}>
                        {showName ? <Avatar name={m.senderName} size={22} /> : null}
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.isMe ? 'flex-end' : 'flex-start', maxWidth: m.isMe ? '85%' : '75%', minWidth: 0 }}>
                      {showName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem', padding: '0 0.25rem', flexDirection: m.isMe ? 'row-reverse' : 'row' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {m.isMe ? formatTime(m.createdAt) : `${m.senderName} · ${formatTime(m.createdAt)}`}
                            {m.isMe && (
                              <button className="btn-link" style={{ padding: 0, opacity: 0.4, color: '#ef4444' }} onClick={() => handleDeleteMessage(m.id)} title="Delete message for everyone">
                                <Trash2 size={10} />
                              </button>
                            )}
                          </span>
                        </div>
                      )}
                      
                      {m.fileInfo && isDMView ? (
                        <FilePreview
                          fileInfo={m.fileInfo}
                          isMe={m.isMe}
                          partnerId={dmPartnerId}
                          jwtToken={jwtToken}
                          getSharedKey={getSharedKey}
                        />
                      ) : (
                        <div style={{
                          padding: '0.6rem 0.9rem',
                          borderRadius: m.isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                          background: m.isMe ? 'linear-gradient(135deg, var(--primary-color), #4f46e5)' : 'rgba(255,255,255,0.08)',
                          fontSize: '0.92rem', lineHeight: '1.5',
                          wordBreak: 'break-word', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap',
                          boxShadow: m.isMe ? '0 4px 12px rgba(99,102,241,0.12)' : 'none',
                          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)'
                        }}>
                          {m.content}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* File preview */}
            {pendingFile && (
              <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.08)' }}>
                <Paperclip size={14} style={{ color: '#818cf8' }} />
                <span style={{ fontSize: '0.82rem', flex: 1 }}>{pendingFile.name}</span>
                <button className="btn-link" style={{ color: '#ef4444' }} onClick={() => setPendingFile(null)}><X size={14} /></button>
              </div>
            )}

            {/* Input */}
            {(() => {
              const currentDM = isDMView ? dmConversations.find(c => c.user_id === dmPartnerId) : null;
              const amIBlocked = currentDM?.am_i_blocked;
              const isBlockedByMe = currentDM?.is_blocked_by_me;

              if (amIBlocked) {
                return (
                  <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: '#ef4444', fontSize: '0.85rem' }}>
                    🔒 You have been blocked by this user.
                  </div>
                );
              }
              if (isBlockedByMe) {
                return (
                  <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: '#ef4444', fontSize: '0.85rem' }}>
                    You blocked this user. Unblock them to send messages.
                  </div>
                );
              }

              if (isDMView) {
                const isFriend = friends.some(f => f.user_id === dmPartnerId && f.status === 'accepted');
                const pendingSent = friends.some(f => f.user_id === dmPartnerId && f.status === 'pending' && f.direction === 'sent');
                const pendingReceived = friends.some(f => f.user_id === dmPartnerId && f.status === 'pending' && f.direction === 'received');

                if (!isFriend) {
                  return (
                    <div style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>You must be friends to send messages.</span>
                      {!pendingSent && !pendingReceived && (
                        <button className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} 
                          onClick={async () => { await sendFriendRequest(jwtToken, dmPartnerId); loadData(); }}>
                          Send Friend Request
                        </button>
                      )}
                      {pendingSent && <span style={{ fontSize: '0.75rem', color: '#818cf8' }}>Request sent. Waiting for approval.</span>}
                      {pendingReceived && (
                        <button className="btn-primary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} 
                          onClick={async () => { await respondFriendRequest(jwtToken, friends.find(f => f.user_id === dmPartnerId)!.id, 'accept'); loadData(); }}>
                          Accept Request
                        </button>
                      )}
                    </div>
                  );
                }
              }

              return (
                <form onSubmit={handleSend} style={{ padding: '0.65rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {isDMView && (
                    <>
                      <button type="button" className="btn-link" style={{ padding: '0.4rem', flexShrink: 0 }} onClick={() => fileInputRef.current?.click()} title="Attach file">
                        <Paperclip size={18} />
                      </button>
                      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) setPendingFile(e.target.files[0]); e.target.value = ''; }} />
                    </>
                  )}
                  <textarea
                    placeholder={isDMView ? `🔒 Message for ${(activeView as any).username}…` : `Message in #${(activeView as any).channel?.name}…`}
                    value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if ((input.trim() || pendingFile) && !sending) {
                          handleSend(e as unknown as React.FormEvent);
                        }
                      }
                    }}
                    className="input-field" 
                    style={{ flex: 1, margin: 0, minHeight: '44px', maxHeight: '150px', resize: 'none', overflowY: 'auto', padding: '0.65rem 1rem', fontFamily: 'inherit', lineHeight: '1.4' }}
                    rows={1}
                  />
                  <button type="submit" className="btn-primary" disabled={(!input.trim() && !pendingFile) || sending} style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '0.3rem' }}>
                    {sending ? (
                      <>
                        <Loader2 size={16} className="spinner" />
                        {uploadPct !== null && <span style={{ fontSize: '0.75rem' }}>{uploadPct}%</span>}
                      </>
                    ) : <Send size={16} />}
                  </button>
                </form>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
