import React, { useState, useRef } from 'react';
import { Settings as SettingsIcon, Download, Upload, Loader2, ShieldAlert } from 'lucide-react';
import { fetchObjects, saveObject, EncryptedObject } from '../lib/api';
import { bufferToBase64, base64ToBuffer } from '../lib/utils';

export function Settings({ jwtToken }: { jwtToken: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const objects = await fetchObjects(jwtToken);
      
      // We need to convert Uint8Array back to base64 for JSON export
      const exportData = objects.map(o => ({
        id: o.id,
        type: o.type,
        version: o.version,
        ciphertext: bufferToBase64(o.ciphertext),
        nonce: bufferToBase64(o.nonce)
      }));

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aegis_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setMessage('Backup downloaded successfully.');
    } catch (err: any) {
      setError('Export error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('This action will load records from the backup into your current vault. Existing records will be overwritten with newer versions. Do you really want to continue?')) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid backup format: root element must be an array.');
      }

      let successCount = 0;
      for (const item of data) {
        if (!item.type || typeof item.version !== 'number' || !item.ciphertext || !item.nonce) {
          console.warn('Skipping invalid record:', item);
          continue;
        }

        const objToSave: EncryptedObject = {
          id: item.id,
          type: item.type,
          version: item.version,
          ciphertext: base64ToBuffer(item.ciphertext),
          nonce: base64ToBuffer(item.nonce)
        };

        await saveObject(jwtToken, objToSave);
        successCount++;
      }

      setMessage(`Import completed successfully! Restored ${successCount} records.`);
    } catch (err: any) {
      setError('Import error: ' + err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="secrets-container">
      <div className="secrets-header" style={{ marginBottom: '2rem' }}>
        <h2><SettingsIcon size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Settings & Backup</h2>
      </div>

      {error && <div style={{color: '#ef4444', marginBottom: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem'}}>{error}</div>}
      {message && <div style={{color: '#10b981', marginBottom: '1rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem'}}>{message}</div>}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3><Download size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Export Vault</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          Securely download your entire encrypted database in JSON format. This file contains 
          all your passwords and notes, but all data is strongly encrypted (Zero-Knowledge). 
          Without your master password, this file is completely worthless to anyone else.
        </p>
        <button 
          className="btn-primary" 
          onClick={handleExport} 
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {loading ? <Loader2 className="spinner" size={18} /> : <Download size={18} />}
          Download Backup (.json)
        </button>
      </div>

      <div className="card">
        <h3><Upload size={18} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem' }} /> Import Vault</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          Do you have a downloaded JSON backup from before? You can upload it back. The system will smartly 
          compare records by their internal ID and perform a merge (overwriting existing records 
          with backup versions and adding missing ones).
        </p>
        
        <input 
          type="file" 
          accept=".json,application/json" 
          ref={fileInputRef}
          onChange={handleImport}
          style={{ display: 'none' }}
        />
        
        <button 
          className="btn-secondary" 
          onClick={() => fileInputRef.current?.click()} 
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {loading ? <Loader2 className="spinner" size={18} /> : <Upload size={18} />}
          Upload Backup File
        </button>
        
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255, 170, 0, 0.1)', borderRadius: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <ShieldAlert size={20} style={{ color: '#ffaa00', flexShrink: 0, marginTop: '0.1rem' }} />
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.8)', lineHeight: '1.5' }}>
            Only upload backups that you created in Aegis under the same master password.
            If you attempt to upload data encrypted with someone else's key, you will never be able to decrypt it.
          </p>
        </div>
      </div>
    </div>
  );
}
