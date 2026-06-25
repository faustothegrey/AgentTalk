interface SidebarEventEntry {
  id: string;
  timestamp: string;
  direction: 'in' | 'out' | 'system';
  label: string;
  detail: string;
}

interface SidebarEventsProps {
  sidebarEvents: SidebarEventEntry[];
  sidebarEventsCollapsed: boolean;
  setSidebarEventsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  setSidebarEvents: (events: SidebarEventEntry[] | ((prev: SidebarEventEntry[]) => SidebarEventEntry[])) => void;
  theme: any;
}

export function SidebarEvents({
  sidebarEvents,
  sidebarEventsCollapsed,
  setSidebarEventsCollapsed,
  setSidebarEvents,
  theme,
}: SidebarEventsProps) {
  return (
    <div style={{
      borderTop: `1px solid ${theme.border}`,
      backgroundColor: theme.bgSurface,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      ...(sidebarEventsCollapsed ? {} : { height: '128px' })
    }}>
      <div
        onClick={() => setSidebarEventsCollapsed(c => !c)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ fontSize: '10px', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '8px', opacity: 0.7 }}>{sidebarEventsCollapsed ? '▶' : '▼'}</span>
          Agent Events
        </span>
        {!sidebarEventsCollapsed && (
          <button
            onClick={(e) => { e.stopPropagation(); setSidebarEvents([]); }}
            style={{ background: 'none', border: 'none', color: theme.textDim, cursor: 'pointer', fontSize: '10px', padding: 0 }}
          >
            Clear
          </button>
        )}
      </div>
      {!sidebarEventsCollapsed && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', padding: '0 10px 8px' }}>
          {sidebarEvents.length === 0 ? (
            <div style={{ margin: 'auto 0', fontSize: '11px', color: theme.textDim }}>
              No agent events yet.
            </div>
          ) : (
            sidebarEvents.map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: '7px 8px',
                  borderRadius: '6px',
                  backgroundColor: entry.direction === 'in' ? '#203145' : entry.direction === 'out' ? '#2f2a1f' : '#262b31',
                  border: `1px solid ${entry.direction === 'in' ? '#31567d' : entry.direction === 'out' ? '#6a5830' : '#3a424c'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '10px', color: theme.textBright }}>{entry.label}</span>
                  <span style={{ fontSize: '10px', color: theme.textDim }}>
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: theme.textSecondary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {entry.detail}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
