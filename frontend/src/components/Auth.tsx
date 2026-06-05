import React, { useState } from 'react';
import { KeyRound, User, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { deriveMasterKey, hashAuthToken, generateKey, exportKey, encryptVaultKey, decryptVaultKey } from '../lib/crypto';
import { registerUser, getSalt, verifyLogin } from '../lib/api';
import { bufferToBase64 } from '../lib/utils';

export function Auth({ onLogin }: { onLogin: (mk: Uint8Array, vaultKey: Uint8Array, token: string, is_admin: boolean, username: string, mustChange?: boolean, oldAuthToken?: string) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      if (isLogin) {
        const salt = await getSalt(username);
        const mk = await deriveMasterKey(password, salt);
        const authTokenRaw = await hashAuthToken(mk);
        const authToken = bufferToBase64(authTokenRaw);
        
        const { token, encrypted_vault_key, is_admin, must_change_password } = await verifyLogin(username, authToken);
        const vaultKey = await decryptVaultKey(mk, encrypted_vault_key);
        
        onLogin(mk, vaultKey, token, is_admin, username, must_change_password, authToken);
      } else {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const mk = await deriveMasterKey(password, salt);
        const authTokenRaw = await hashAuthToken(mk);
        const authToken = bufferToBase64(authTokenRaw);
        
        const vkCrypto = await generateKey();
        const vkRaw = await exportKey(vkCrypto);
        const encVaultKey = await encryptVaultKey(mk, vkRaw);
        
        await registerUser(username, authToken, salt, encVaultKey);
        setIsLogin(true);
        setSuccessMsg('Vault vytvořen! Nyní se přihlaste.');
        setPassword('');
      }
    } catch (err: any) {
      console.error('Auth chyba:', err);
      setErrorMsg(err.message || 'Došlo k chybě při autentizaci.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <img src="/logo.png" alt="Aegis Logo" style={{ width: '80px', height: '80px', margin: '0 auto 1.5rem', display: 'block', filter: 'drop-shadow(0 0 16px rgba(99, 102, 241, 0.6))' }} />
          <h2 style={{ fontSize: '2rem', fontWeight: 800, background: 'linear-gradient(to right, #f8fafc, #818cf8)', WebkitBackgroundClip: 'text', color: 'transparent', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>{isLogin ? 'Welcome back' : 'Create Vault'}</h2>
          <p style={{ color: '#94a3b8', fontSize: '1rem' }}>{isLogin ? 'Decrypt your local vault' : 'Your zero-knowledge personal hub'}</p>
        </div>

        {errorMsg && <div style={{color: '#ef4444', marginBottom: '1rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '4px'}}>{errorMsg}</div>}
        {successMsg && <div style={{color: '#22c55e', marginBottom: '1rem', textAlign: 'center', background: 'rgba(34, 197, 94, 0.1)', padding: '0.5rem', borderRadius: '4px'}}>{successMsg}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <User className="input-icon" size={18} />
            <input 
              type="text" 
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </div>

          <div className="input-group" style={{ position: 'relative' }}>
            <Lock className="input-icon" size={18} />
            <input 
              type={showPassword ? "text" : "password"}
              placeholder="Master Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
              style={{ paddingRight: '2.5rem' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 className="spinner" size={20} /> : (
              <>
                <KeyRound size={18} />
                <span>{isLogin ? 'Sign In' : 'Sign Up'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <button type="button" className="btn-link" onClick={() => {
            setIsLogin(!isLogin);
            setErrorMsg('');
            setSuccessMsg('');
          }}>
            {isLogin ? 'Need an account? Create one' : 'Already have a Vault? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
