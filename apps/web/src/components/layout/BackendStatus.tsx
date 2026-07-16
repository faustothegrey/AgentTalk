import { theme } from '../../api/types';

interface BackendStatusProps {
  connected: boolean;
  collapsed: boolean;
}

// The app carries no stylesheet (everything is inline-styled), and inline styles cannot express
// keyframes — so the animation travels with the component rather than introducing a CSS file.
const PULSE_STYLE = `
@keyframes agenttalk-backend-pulse {
  0%   { opacity: 1;    transform: scale(1); }
  50%  { opacity: 0.35; transform: scale(0.8); }
  100% { opacity: 1;    transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .agenttalk-backend-dot { animation: none !important; }
}
`;

/**
 * Live backend connection indicator: a pulsing dot while the WebSocket is up, a still red one when
 * it is not. The pulse is the point — a beating dot says "this page is being fed events right now",
 * which a static colour cannot. It is only truthful because the server pings its clients: without
 * that keepalive a half-open socket would keep this green over a dead backend.
 */
export function BackendStatus({ connected, collapsed }: BackendStatusProps) {
  const color = connected ? theme.success : theme.error;
  const label = connected ? 'Backend connected' : 'Backend disconnected';

  return (
    <>
      <style>{PULSE_STYLE}</style>
      <div
        title={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: '10px',
          padding: '10px 12px',
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        <span
          className="agenttalk-backend-dot"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}`,
            flexShrink: 0,
            animation: connected ? 'agenttalk-backend-pulse 2s ease-in-out infinite' : 'none',
          }}
        />
        {!collapsed && (
          <span style={{ fontSize: '12px', color: theme.textMuted, whiteSpace: 'nowrap' }}>{label}</span>
        )}
      </div>
    </>
  );
}
