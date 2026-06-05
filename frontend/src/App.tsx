import { useState, useEffect } from 'react'
import { Shield, LogOut, Settings as SettingsIcon, AlertTriangle } from 'lucide-react'
import { Auth } from './components/Auth'
import { Secrets } from './components/Secrets'
import { AdminPanel } from './components/AdminPanel'
import { Notes } from './components/Notes'
import { Settings } from './components/Settings'
import { Bookmarks } from './components/Bookmarks'
import { TOTP } from './components/TOTP'
import { Files } from './components/Files'
import { Chat } from './components/Chat'
import { ECDHKeyPair, loadOrCreateKeyPair, uploadPublicKey } from './lib/cryptoE2E'
import { deriveMasterKey, hashAuthToken, encryptVaultKey } from './lib/crypto'
import { bufferToBase64 } from './lib/utils'
import { changePassword } from './lib/api'

function App() {
  const [masterKey, setMasterKey] = useState<Uint8Array | null>(null);
  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState('');
  const [ecdhKeyPair, setEcdhKeyPair] = useState<ECDHKeyPair | null>(null);
  const [chatUnread, setChatUnread] = useState(0);
  const [activeTab, setActiveTab] = useState<'secrets' | 'notes' | 'bookmarks' | 'totp' | 'files' | 'chat' | 'settings' | 'admin'>('secrets');

  // Force password change state
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pendingLoginData, setPendingLoginData] = useState<{
    mk: Uint8Array; vk: Uint8Array; token: string; is_admin: boolean; uname: string;
    oldAuthToken: string;
  } | null>(null);
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [changePwError, setChangePwError] = useState('');
  const [changePwLoading, setChangePwLoading] = useState(false);

  const doLogin = (mk: Uint8Array, vk: Uint8Array, token: string, is_admin: boolean = false, uname: string = '') => {
    setMasterKey(mk);
    setVaultKey(vk);
    setJwtToken(token);
    setIsAdmin(is_admin);
    setUsername(uname);
    setActiveTab('secrets');
  };

  const handleLogin = (mk: Uint8Array, vk: Uint8Array, token: string, is_admin: boolean = false, uname: string = '', mustChange: boolean = false, oldAuthToken: string = '') => {
    if (mustChange) {
      // Don't log in yet – show force change modal
      setPendingLoginData({ mk, vk, token, is_admin, uname, oldAuthToken });
      setMustChangePassword(true);
      return;
    }
    doLogin(mk, vk, token, is_admin, uname);
  };

  const handleForceChangePassword = async () => {
    if (!pendingLoginData) return;
    if (newPw.length < 10) { setChangePwError('Heslo musí mít alespoň 10 znaků.'); return; }
    if (newPw !== newPw2) { setChangePwError('Hesla se neshodují.'); return; }
    setChangePwLoading(true);
    setChangePwError('');
    try {
      // Generate new salt and derive new master key
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      const newMasterKey = await deriveMasterKey(newPw, newSalt);
      const newAuthTokenBytes = await hashAuthToken(newMasterKey);
      const newAuthToken = bufferToBase64(newAuthTokenBytes); // MUST be base64, same as login/register
      const newEncVaultKey = await encryptVaultKey(newMasterKey, pendingLoginData.vk);

      await changePassword(
        pendingLoginData.token,
        pendingLoginData.oldAuthToken,
        newAuthToken,
        newEncVaultKey,
        newSalt
      );

      // Login with new master key
      setMustChangePassword(false);
      setPendingLoginData(null);
      setNewPw(''); setNewPw2('');
      doLogin(newMasterKey, pendingLoginData.vk, pendingLoginData.token, pendingLoginData.is_admin, pendingLoginData.uname);
    } catch (err: any) {
      setChangePwError('Chyba: ' + err.message);
    } finally {
      setChangePwLoading(false);
    }
  };

  const handleLogout = () => {
    setMasterKey(null); setVaultKey(null); setJwtToken(null);
    setIsAdmin(false); setUsername(''); setEcdhKeyPair(null); setChatUnread(0);
    setMustChangePassword(false); setPendingLoginData(null);
  };

  // Setup ECDH key pair after login
  useEffect(() => {
    if (!vaultKey || !jwtToken) return;
    loadOrCreateKeyPair(vaultKey, jwtToken).then(async pair => {
      setEcdhKeyPair(pair);
      await uploadPublicKey(jwtToken, pair.publicKeyJWK);
    }).catch(console.error);
  }, [vaultKey, jwtToken]);

  // Poll for unread DM count regardless of active tab
  useEffect(() => {
    if (!jwtToken) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/dm/conversations', {
          headers: { 'Authorization': 'Bearer ' + jwtToken }
        });
        if (res.ok) {
          const data = await res.json();
          const total = (data.conversations || []).reduce((s: number, c: any) => s + (c.unread_count || 0), 0);
          setChatUnread(total);
        }
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => clearInterval(id);
  }, [jwtToken]);

  // ── Force Password Change Modal ──────────────────────────────────────────
  if (mustChangePassword) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="card" style={{ maxWidth: '420px', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: '#f59e0b' }}>
            <AlertTriangle size={28} />
            <h2 style={{ margin: 0 }}>Vyžadována změna hesla</h2>
          </div>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Administrátor vyžaduje, abyste si nastavili nové heslo před pokračováním.
            Vaše šifrovaná data zůstanou zachována.
          </p>
          <input
            type="password"
            className="input-field"
            placeholder="Nové heslo (min. 10 znaků)"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            className="input-field"
            placeholder="Potvrďte nové heslo"
            value={newPw2}
            onChange={e => setNewPw2(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleForceChangePassword()}
          />
          {changePwError && (
            <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{changePwError}</div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="btn-primary" onClick={handleForceChangePassword} disabled={changePwLoading || newPw.length < 10 || newPw !== newPw2}>
              {changePwLoading ? 'Ukládám...' : 'Nastavit heslo'}
            </button>
            <button className="btn-secondary" onClick={handleLogout}>Odhlásit</button>
          </div>
        </div>
      </div>
    );
  }

  if (!masterKey || !vaultKey || !jwtToken) {
    return <Auth onLogin={handleLogin} />;
  }

  const tabBtn = (tab: typeof activeTab, label: React.ReactNode, badge?: number) => (
    <button
      className={activeTab === tab ? 'btn-primary' : 'btn-link'}
      style={{ padding: '0.6rem 1rem', margin: 0, position: 'relative', display: 'flex', alignItems: 'center', gap: '0.4rem', borderRadius: '10px' }}
      onClick={() => setActiveTab(tab)}
    >
      {label}
      {badge != null && badge > 0 && (
        <span style={{ background: '#ef4444', borderRadius: '999px', padding: '0 0.35rem', fontSize: '0.65rem', fontWeight: 700, minWidth: '16px', textAlign: 'center', lineHeight: '16px' }}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="app-container">
      <header className="header" style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', 
        padding: '1.25rem 2rem', borderRadius: '24px', marginBottom: '2.5rem', 
        background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(30px)', 
        border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.png" alt="Aegis Logo" style={{ width: '42px', height: '42px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.6))' }} />
          <h1 style={{ fontSize: '1.75rem', margin: 0, fontWeight: 800, background: 'linear-gradient(to right, #f8fafc, #818cf8)', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '-0.02em' }}>Aegis Hub</h1>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.4rem', borderRadius: '14px', flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.03)' }}>
            {tabBtn('secrets', 'Passwords')}
            {tabBtn('notes', 'Notes')}
            {tabBtn('bookmarks', 'Bookmarks')}
            {tabBtn('totp', '2FA')}
            {tabBtn('files', 'Files')}
            {tabBtn('chat', 'Chat', chatUnread)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn-secondary" style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px' }} onClick={() => setActiveTab('settings')} title="Settings">
            <SettingsIcon size={18} />
          </button>
          {isAdmin && (
            <button className="btn-secondary" style={{ padding: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '10px' }} onClick={() => setActiveTab('admin')} title="Admin">
              <Shield size={18} />
            </button>
          )}
          <button className="btn-link" style={{ padding: '0.6rem', color: '#ef4444', borderRadius: '10px' }} onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="main-content fade-in">
        {activeTab === 'secrets' && <Secrets vaultKeyRaw={vaultKey} jwtToken={jwtToken} />}
        {activeTab === 'notes' && <Notes vaultKeyRaw={vaultKey} jwtToken={jwtToken} />}
        {activeTab === 'bookmarks' && <Bookmarks vaultKeyRaw={vaultKey} jwtToken={jwtToken} />}
        {activeTab === 'totp' && <TOTP vaultKeyRaw={vaultKey} jwtToken={jwtToken} />}
        {activeTab === 'files' && <Files vaultKeyRaw={vaultKey} jwtToken={jwtToken} />}
        {activeTab === 'chat' && (
          <Chat
            jwtToken={jwtToken}
            isAdmin={isAdmin}
            username={username}
            ecdhKeyPair={ecdhKeyPair}
            onUnreadChange={setChatUnread}
          />
        )}
        {activeTab === 'settings' && <Settings jwtToken={jwtToken} />}
        {activeTab === 'admin' && <AdminPanel jwtToken={jwtToken} currentUsername={username} />}
      </main>
    </div>
  )
}

export default App
