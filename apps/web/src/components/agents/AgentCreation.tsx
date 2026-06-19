import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus } from 'lucide-react';
import { Provider, ExecutionMode, theme } from '../../api/types';

const modelOptions: Record<Provider, { value: string; label: string }[]> = {
  claude: [
    { value: 'opus', label: 'Opus' },
    { value: 'sonnet', label: 'Sonnet 3.7' },
    { value: 'sonnet-3-5', label: 'Sonnet 3.5' },
    { value: 'haiku', label: 'Haiku' },
  ],
  gemini: [
    { value: 'gemini-3.1-pro', label: '3.1 Pro' },
    { value: 'gemini-3.1-pro-preview', label: '3.1 Pro (Preview)' },
    { value: 'gemini-2.5-pro', label: '2.5 Pro' },
    { value: 'gemini-3-pro-preview', label: '3 Pro (Preview)' },
    { value: 'gemini-3-flash-preview', label: '3 Flash (Preview)' },
    { value: 'gemini-2.5-flash', label: '2.5 Flash' },
  ],
  codex: [
    { value: '', label: 'Default' },
  ],
};

interface AgentCreationProps {
  loading: boolean;
  onCreate: (provider: Provider, model: string, mode: ExecutionMode, id?: string) => Promise<void>;
}

export function AgentCreation({ loading, onCreate }: AgentCreationProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [provider, setProvider] = useState<Provider>('gemini');
  const [model, setModel] = useState('gemini-3.1-pro');
  const [mode, setMode] = useState<ExecutionMode>('auto');
  const [idInput, setIdInput] = useState('');

  const handleCreate = async () => {
    await onCreate(provider, model, mode, idInput.trim() || undefined);
    setIdInput('');
  };

  return (
    <div style={{ padding: '16px', borderTop: `1px solid ${theme.border}` }}>
      <button 
        onClick={() => setCollapsed(!collapsed)} 
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer', textTransform: 'uppercase', fontSize: '11px' }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />} Agent Creation
      </button>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select 
              value={provider} 
              onChange={e => { 
                const p = e.target.value as Provider; 
                setProvider(p); 
                setModel(modelOptions[p][0].value); 
              }} 
              style={{ flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '6px' }}
            >
              <option value="gemini">Gemini</option>
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
            </select>
            <select 
              value={model} 
              onChange={e => setModel(e.target.value)} 
              style={{ flex: 1, backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '6px' }}
            >
              {modelOptions[provider].map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase' }}>Execution Mode</span>
            <select 
              value={mode} 
              onChange={e => setMode(e.target.value as ExecutionMode)} 
              style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '6px', fontSize: '12px' }}
            >
              <option value="auto">Auto-accept commands</option>
              <option value="persistent">Persistent (long-lived session)</option>
              <option value="one_shot">One-shot (run and terminate)</option>
            </select>
          </div>
          <input 
            value={idInput} 
            onChange={e => setIdInput(e.target.value)} 
            placeholder="Agent ID (Optional)" 
            style={{ backgroundColor: theme.bg, color: theme.textPrimary, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '8px', fontSize: '13px' }} 
          />
          <button 
            onClick={handleCreate} 
            disabled={loading} 
            style={{ 
              backgroundColor: theme.bg, 
              color: theme.textBright, 
              border: `1px solid ${theme.borderInput}`, 
              borderRadius: '6px', 
              padding: '10px', 
              cursor: loading ? 'not-allowed' : 'pointer', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Plus size={16} /> Create Agent
          </button>
        </div>
      )}
    </div>
  );
}
