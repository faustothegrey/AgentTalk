import { AlertCircle, X } from 'lucide-react';

interface GlobalNotificationsProps {
  globalError: string | null;
  globalNotice: string | null;
  onClearError: () => void;
  theme: any;
}

export function GlobalNotifications({ globalError, globalNotice, onClearError, theme }: GlobalNotificationsProps) {
  return (
    <>
      {/* Global Error Notification */}
      {globalError && (
        <div style={{
          position: 'absolute',
          top: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#ef4444',
          color: theme.textBright,
          padding: '12px 24px',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.25)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          maxWidth: '80%'
        }}>
          <AlertCircle size={20} />
          <div style={{ flex: 1, fontSize: '14px', wordBreak: 'break-word' }}>
            {globalError}
          </div>
          <button 
            onClick={onClearError}
            style={{ background: 'none', border: 'none', color: theme.textBright, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {globalNotice && (
        <div style={{
          position: 'absolute',
          top: globalError ? '76px' : '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#1f5f3a',
          color: theme.textBright,
          padding: '10px 18px',
          borderRadius: '6px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.25)',
          zIndex: 9998,
          maxWidth: '80%',
          fontSize: '13px',
          wordBreak: 'break-word',
        }}>
          {globalNotice}
        </div>
      )}
    </>
  );
}
