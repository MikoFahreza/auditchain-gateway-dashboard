import React from 'react';

// ================================================================
// ICON — tiny inline SVG helpers (no external icon dep needed)
// ================================================================
const Icon = ({ name, size = 18, style = {} }) => {
  const icons = {
    shield: (
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" fill="currentColor" />
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    palette: (
      <>
        <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor" />
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="6.5" cy="13" r="1.5" fill="currentColor" />
        <path d="M12 3a9 9 0 0 0 0 18h1.5a2.5 2.5 0 0 0 1.77-4.27 1.5 1.5 0 0 1 1.06-2.56H17a4 4 0 0 0 0-8h-.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    moon: (
      <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    ),
    monitor: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M8 21h8M12 16v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    check: (
      <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    ),
    lock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="12" cy="16" r="1.5" fill="currentColor" />
      </>
    ),
    eye: (
      <>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
      </>
    ),
    eyeOff: (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="10" fill="#ef4444" />
        <path d="M12 7v5M12 16v1" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    warn: (
      <>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="#f59e0b" stroke="#d97706" strokeWidth="0.5" />
        <line x1="12" y1="9" x2="12" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    menu: (
      <>
        <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    chevronRight: (
      <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    ),
    chevronLeft: (
      <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    ),
    chevronDown: (
      <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    arrowDown: (
      <>
        <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <polyline points="19 12 12 19 5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
    arrowUp: (
      <>
        <line x1="12" y1="19" x2="12" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <polyline points="5 12 12 5 19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    zap: (
      <polygon points="13 2 3 14 11 14 10 22 21 10 13 10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
    ),
    x: (
      <>
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M19 6l-1 15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    chart: (
      <>
        <line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    trending: (
      <>
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <polyline points="17 6 23 6 23 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    list: (
      <>
        <line x1="8" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="6" x2="3.01" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="12" x2="3.01" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="3" y1="18" x2="3.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    database: (
      <>
        <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" stroke="currentColor" strokeWidth="2" fill="none" />
      </>
    ),
    building: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M9 21v-5h6v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M8 7h.01M12 7h.01M16 7h.01M8 11h.01M12 11h.01M16 11h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </>
    ),
    history: (
      <>
        <polyline points="1 4 1 10 7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M3.51 15a9 9 0 1 0 .49-4.95L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" rx="1" />
        <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" rx="1" />
        <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" rx="1" />
        <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" fill="none" rx="1" />
      </>
    ),
    sidebarPanel: (
      <>
        <rect x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M9 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M12 9h4M12 12h4M12 15h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.82" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.8 1.8 0 0 0 15 19.4a1.8 1.8 0 0 0-1 .6 1.8 1.8 0 0 0-.42 1.11V21a2 2 0 0 1-4 0v-.09A1.8 1.8 0 0 0 8.6 19.4a1.8 1.8 0 0 0-1.98.36l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.8 1.8 0 0 0 4.6 15a1.8 1.8 0 0 0-.6-1 1.8 1.8 0 0 0-1.11-.42H2.8a2 2 0 0 1 0-4h.09A1.8 1.8 0 0 0 4.6 8.6a1.8 1.8 0 0 0-.36-1.98l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.8 1.8 0 0 0 8.6 4.6a1.8 1.8 0 0 0 1-.6A1.8 1.8 0 0 0 10 2.89V2.8a2 2 0 0 1 4 0v.09A1.8 1.8 0 0 0 15 4.6a1.8 1.8 0 0 0 1.98-.36l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.8 1.8 0 0 0 19.4 8.6a1.8 1.8 0 0 0 .6 1 1.8 1.8 0 0 0 1.11.42h.09a2 2 0 0 1 0 4h-.09A1.8 1.8 0 0 0 19.4 15z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
    terminal: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M7 9l3 3-3 3M12 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
    rocket: (
      <>
        <path d="M14 4c2.5-.9 4.6-.8 6 0 .8 1.4.9 3.5 0 6l-6.7 6.7-4-4L14 4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="16" cy="8" r="1.5" fill="currentColor" />
        <path d="M9 13l-4 1 1-4M11 17l-1 4 4-1M7 17l-3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="9.5" cy="7" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    bot: (
      <>
        <rect x="5" y="7" width="14" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M12 7V3M8 3h8M9 12h.01M15 12h.01M9 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    wifi: (
      <>
        <path d="M5 12.55a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="12" cy="20" r="1" fill="currentColor" />
      </>
    ),
    checkmark: (
      <path d="M10 17l-3-3 1.4-1.4 1.6 1.6 4.6-4.6 1.4 1.4L10 17z" fill="rgba(255,255,255,0.9)" />
    ),
    spinner: (
      <>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" fill="none" />
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" />
      </>
    ),
    download: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    hash: (
      <>
        <line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="4" y1="15" x2="20" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="10" y1="3" x2="8" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="3" x2="14" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    checkCircle: (
      <>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    xCircle: (
      <>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    fileText: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <polyline points="10 9 9 9 8 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    inbox: (
      <>
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    code: (
      <>
        <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
    activity: (
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    ),
    server: (
      <>
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none" />
        <line x1="6" y1="6" x2="6.01" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="6" y1="18" x2="6.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    key: (
      <>
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
    >
      {icons[name] || null}
    </svg>
  );
};

const MemoizedIcon = React.memo(Icon);

export { Icon };
export default MemoizedIcon;
