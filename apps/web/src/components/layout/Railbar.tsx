import { MessagesSquare, Users, Activity, Settings, History as HistoryIcon, History, Menu, Terminal as TerminalIcon } from 'lucide-react';
import { TopLevelTab, theme } from '../../api/types';
import { BackendStatus } from './BackendStatus';

interface RailbarProps {
  activeTopTab: TopLevelTab;
  onTabChange: (tab: TopLevelTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** WebSocket liveness, surfaced here because the rail is the one chrome visible on every tab. */
  connected: boolean;
}

export function Railbar({ activeTopTab, onTabChange, collapsed, onToggleCollapse, connected }: RailbarProps) {
  const NavButton = ({ tab, icon: Icon, label }: { tab: TopLevelTab; icon: any; label: string }) => (
    <button
      onClick={() => onTabChange(tab)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '12px',
        padding: '10px',
        borderRadius: '6px',
        border: 'none',
        backgroundColor: activeTopTab === tab ? theme.bgActive : 'transparent',
        color: activeTopTab === tab ? theme.textBright : theme.textMuted,
        cursor: 'pointer',
        width: '100%',
        transition: 'all 0.2s',
      }}
      title={collapsed ? label : ""}
    >
      <Icon size={20} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ fontSize: '14px', fontWeight: 600 }}>{label}</span>}
    </button>
  );

  return (
    <div style={{
      width: collapsed ? '56px' : '200px',
      backgroundColor: theme.bgRaised,
      borderRight: `1px solid ${theme.border}`,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease',
    }}>
      <div style={{ padding: '12px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
        <button
          onClick={onToggleCollapse}
          style={{ background: 'none', border: 'none', color: theme.textMuted, cursor: 'pointer' }}
        >
          <Menu size={20} />
        </button>
      </div>
      <div style={{ flex: 1, padding: '0 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <NavButton tab="agents" icon={TerminalIcon} label="Agents" />
        <NavButton tab="chat" icon={MessagesSquare} label="Chat" />
        <NavButton tab="team" icon={Users} label="Team" />
        <NavButton tab="usage" icon={Activity} label="Usage" />
        <NavButton tab="drive" icon={Settings} label="Google Drive" />
        <NavButton tab="scheduler" icon={HistoryIcon} label="Scheduler" />
        <div style={{ height: '1px', backgroundColor: theme.border, margin: '8px 12px', opacity: 0.5 }} />
        <NavButton tab="planning" icon={History} label="Planning" />
      </div>
      <BackendStatus connected={connected} collapsed={collapsed} />
    </div>
  );
}
