import { Check, X } from 'lucide-react';
import type { PendingRelay, RelayApprovalMode, theme as themeType } from './api/types';

type Theme = typeof themeType;

interface RelayApprovalPanelProps {
  mode: RelayApprovalMode;
  pendingRelays: PendingRelay[];
  connected: boolean;
  theme: Theme;
  onModeChange: (mode: RelayApprovalMode) => void;
  onApprove: (relayId: string) => void;
  onDeny: (relayId: string) => void;
}

function payloadPreview(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function formatStatus(status: PendingRelay['status']): string {
  switch (status) {
    case 'approved_delivered': return 'approved delivered';
    case 'delivery_failed': return 'delivery failed';
    default: return status;
  }
}

export function RelayApprovalPanel({
  mode,
  pendingRelays,
  connected,
  theme,
  onModeChange,
  onApprove,
  onDeny,
}: RelayApprovalPanelProps) {
  const approveEach = mode === 'approve_each';

  return (
    <div style={{ borderTop: `1px solid ${theme.border}`, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: theme.textBright }}>Relay approvals</div>
          <div style={{ fontSize: '11px', color: theme.textMuted }}>Agent to agent</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: connected ? theme.textPrimary : theme.textDim, cursor: connected ? 'pointer' : 'not-allowed' }}>
          <input
            type="checkbox"
            checked={approveEach}
            disabled={!connected}
            onChange={(event) => onModeChange(event.target.checked ? 'approve_each' : 'off')}
          />
          {approveEach ? 'Approve each' : 'Off'}
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
        {pendingRelays.length === 0 ? (
          <div style={{ color: theme.textDim, fontSize: '12px' }}>No pending agent relays.</div>
        ) : pendingRelays.map((relay) => {
          const text = payloadPreview(relay.payload);
          return (
            <div key={relay.id} style={{ backgroundColor: theme.bgSurface, border: `1px solid ${theme.borderLight}`, borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                <div style={{ minWidth: 0, color: theme.textPrimary, fontSize: '12px', fontWeight: 700, overflowWrap: 'anywhere' }}>
                  {relay.fromAgentId} {'->'} {relay.toAgentId}
                </div>
                <div style={{ color: relay.status === 'pending' ? theme.textSubtle : theme.textMuted, fontSize: '11px', whiteSpace: 'nowrap' }}>{formatStatus(relay.status)}</div>
              </div>

              <div style={{ color: theme.textSecondary, fontSize: '12px', lineHeight: 1.4, maxHeight: '54px', overflow: 'hidden', overflowWrap: 'anywhere' }}>{text}</div>

              {(relay.baton || relay.workflowEvent) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', color: theme.textMuted }}>
                  {relay.baton && (
                    <div>Baton {relay.baton.batonId}: {relay.baton.fromRole} {'->'} {relay.baton.toRole}</div>
                  )}
                  {relay.workflowEvent && (
                    <div>Authority {relay.workflowEvent.gate}: {relay.workflowEvent.action}</div>
                  )}
                </div>
              )}

              {relay.status === 'pending' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    title="Approve relay"
                    disabled={!connected}
                    onClick={() => onApprove(relay.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: theme.bg, color: theme.success, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '7px 8px', cursor: connected ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 700 }}
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    type="button"
                    title="Deny relay"
                    disabled={!connected}
                    onClick={() => onDeny(relay.id)}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', backgroundColor: theme.bg, color: theme.error, border: `1px solid ${theme.borderInput}`, borderRadius: '6px', padding: '7px 8px', cursor: connected ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 700 }}
                  >
                    <X size={14} /> Deny
                  </button>
                </div>
              )}

              {relay.deliveryError && (
                <div style={{ color: theme.error, fontSize: '11px', overflowWrap: 'anywhere' }}>{relay.deliveryError}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
