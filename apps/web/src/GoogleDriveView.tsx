import { useState } from 'react';
import { Settings, ExternalLink, Folder, File, Trash2 } from 'lucide-react';

interface GoogleDriveStatus {
  configured: boolean;
  authenticated: boolean;
  redirectUri?: string;
  scopes: string[];
  hasRefreshToken: boolean;
}

interface GoogleDriveResource {
  id: string;
  name: string;
  type: 'file' | 'folder';
  driveId: string;
  createdAt: string;
  updatedAt: string;
}

interface GoogleDriveFileEntry {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

interface GoogleDriveReadResult {
  file: GoogleDriveFileEntry;
  text: string;
}

interface GoogleDriveViewProps {
  driveStatus: GoogleDriveStatus | null;
  driveResources: GoogleDriveResource[];
  driveAgentResources: GoogleDriveResource[];
  driveFiles: GoogleDriveFileEntry[];
  driveReadResult: GoogleDriveReadResult | null;
  driveLoading: boolean;
  onRefreshStatus: () => void;
  onAddResource: (name: string, type: 'file' | 'folder', driveId: string) => Promise<void>;
  onRemoveResource: (id: string) => Promise<void>;
  onGrantAccess: (resourceId: string, agentId: string) => Promise<void>;
  onRevokeAccess: (resourceId: string, agentId: string) => Promise<void>;
  onListFiles: (resourceId: string, agentId: string) => Promise<void>;
  onReadFile: (fileId: string, agentId: string) => Promise<void>;
  agents: { id: string }[];
  theme: any;
}

export function GoogleDriveView({
  driveStatus,
  driveResources,
  driveLoading,
  onAddResource,
  onRemoveResource,
  onGrantAccess,
  agents,
  theme
}: GoogleDriveViewProps) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'file' | 'folder'>('folder');
  const [newDriveId, setNewDriveId] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [grantAgentId, setDriveGrantAgentId] = useState('');

  if (!driveStatus) return <div>Loading...</div>;

  if (!driveStatus.configured) {
    return (
      <div style={{ padding: '20px', color: theme.textMuted }}>
        Google Drive integration is not configured. Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET.
      </div>
    );
  }

  if (!driveStatus.authenticated) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Settings size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3 style={{ color: theme.textBright }}>Google Drive Authentication Required</h3>
        <p style={{ color: theme.textMuted, marginBottom: '20px' }}>Authorize AgentTalk to access your Google Drive files.</p>
        <a
          href={driveStatus.redirectUri}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: '#4285F4',
            color: '#fff',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          <ExternalLink size={18} /> Authenticate with Google
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <section style={{ backgroundColor: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', color: theme.textMuted }}>Register Resource</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Friendly name (e.g. My Project)" style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <select value={newType} onChange={e => setNewType(e.target.value as 'file' | 'folder')} style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px 10px', fontSize: '13px', width: '100px' }}>
              <option value="folder">Folder</option>
              <option value="file">File</option>
            </select>
            <input value={newDriveId} onChange={e => setNewDriveId(e.target.value)} placeholder="Google Drive ID" style={{ flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }} />
          </div>
          <button
            onClick={() => { onAddResource(newName, newType, newDriveId); setNewName(''); setNewDriveId(''); }}
            disabled={driveLoading || !newName.trim() || !newDriveId.trim()}
            style={{ backgroundColor: theme.success, color: '#fff', border: 'none', borderRadius: '6px', padding: '10px', fontWeight: 600, cursor: 'pointer', opacity: (driveLoading || !newName.trim() || !newDriveId.trim()) ? 0.5 : 1 }}
          >
            Add Resource
          </button>
        </div>
      </section>

      <section>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', color: theme.textMuted }}>Your Resources</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {driveResources.map(res => (
            <div key={res.id} style={{ backgroundColor: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: theme.textBright, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {res.type === 'folder' ? <Folder size={14} /> : <File size={14} />} {res.name}
                </div>
                <div style={{ fontSize: '11px', color: theme.textMuted }}>{res.driveId}</div>
              </div>
              <button onClick={() => onRemoveResource(res.id)} style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </section>

      <section style={{ backgroundColor: theme.bgSurface, border: `1px solid ${theme.border}`, borderRadius: '8px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', textTransform: 'uppercase', color: theme.textMuted }}>Grant Agent Access</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select value={selectedResourceId} onChange={e => setSelectedResourceId(e.target.value)} style={{ flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', fontSize: '13px' }}>
            <option value="">Select Resource...</option>
            {driveResources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select value={grantAgentId} onChange={e => setDriveGrantAgentId(e.target.value)} style={{ flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', fontSize: '13px' }}>
            <option value="">Select Agent...</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.id}</option>)}
          </select>
          <button onClick={() => onGrantAccess(selectedResourceId, grantAgentId)} disabled={!selectedResourceId || !grantAgentId} style={{ backgroundColor: theme.bg, color: theme.textBright, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px 16px', cursor: 'pointer' }}>Grant</button>
        </div>
      </section>
    </div>
  );
}
