// Dynamic favicon utility for changing favicons based on content type

// SVG favicons as data URIs
const FAVICONS = {
  default: '/favicon.svg', // Uses the existing default favicon
  
  task: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="4"/>
      <text x="16" y="24" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">T</text>
    </svg>
  `)}`,
  
  spreadsheet: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="2"/>
      <!-- Table grid -->
      <rect x="4" y="6" width="24" height="20" fill="white" stroke="#1a1a1a" stroke-width="1"/>
      <!-- Horizontal lines -->
      <line x1="4" y1="12" x2="28" y2="12" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="4" y1="18" x2="28" y2="18" stroke="#1a1a1a" stroke-width="1"/>
      <!-- Vertical lines -->
      <line x1="12" y1="6" x2="12" y2="26" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="20" y1="6" x2="20" y2="26" stroke="#1a1a1a" stroke-width="1"/>
      <!-- Header row highlighting -->
      <rect x="4" y="6" width="24" height="6" fill="#3b82f6" opacity="0.3"/>
    </svg>
  `)}`,
  
  files: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="4"/>
      <!-- Folder icon -->
      <path d="M6 8h6l2 2h12v16H6V8z" fill="#f39c12" stroke="white" stroke-width="1"/>
      <rect x="6" y="10" width="20" height="14" fill="#f39c12" stroke="white" stroke-width="1"/>
    </svg>
  `)}`,
  
  goals: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="4"/>
      <!-- Target/bullseye icon -->
      <circle cx="16" cy="16" r="10" fill="none" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="none" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="2" fill="#e74c3c"/>
    </svg>
  `)}`,
  
  events: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="4"/>
      <!-- Calendar icon -->
      <rect x="6" y="8" width="20" height="18" fill="white" stroke="#1a1a1a" stroke-width="1"/>
      <rect x="6" y="8" width="20" height="4" fill="#3b82f6"/>
      <!-- Calendar grid -->
      <line x1="10" y1="12" x2="10" y2="26" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="14" y1="12" x2="14" y2="26" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="18" y1="12" x2="18" y2="26" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="22" y1="12" x2="22" y2="26" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="6" y1="16" x2="26" y2="16" stroke="#1a1a1a" stroke-width="1"/>
      <line x1="6" y1="20" x2="26" y2="20" stroke="#1a1a1a" stroke-width="1"/>
    </svg>
  `)}`,
  
  outlines: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="4"/>
      <!-- Hierarchical list icon -->
      <rect x="6" y="8" width="3" height="2" fill="white"/>
      <rect x="11" y="8" width="15" height="2" fill="white"/>
      <rect x="8" y="12" width="3" height="2" fill="white"/>
      <rect x="13" y="12" width="13" height="2" fill="white"/>
      <rect x="8" y="16" width="3" height="2" fill="white"/>
      <rect x="13" y="16" width="13" height="2" fill="white"/>
      <rect x="6" y="20" width="3" height="2" fill="white"/>
      <rect x="11" y="20" width="15" height="2" fill="white"/>
    </svg>
  `)}`,
  
  phone: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="4"/>
      <!-- Phone icon -->
      <rect x="10" y="6" width="12" height="20" rx="2" fill="white"/>
      <rect x="11" y="8" width="10" height="14" fill="#1a1a1a"/>
      <circle cx="16" cy="24" r="1" fill="#1a1a1a"/>
    </svg>
  `)}`,
  
  settings: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="4"/>
      <!-- Gear icon -->
      <path d="M16 6l1.5 4h3l-2.5 3.5 1 4-3-2-3 2 1-4L11 10h3L16 6z" fill="white"/>
      <circle cx="16" cy="16" r="8" fill="none" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="3" fill="none" stroke="white" stroke-width="2"/>
    </svg>
  `)}`,
  
  dashboard: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="4"/>
      <!-- Dashboard grid -->
      <rect x="6" y="6" width="8" height="8" fill="white" rx="1"/>
      <rect x="18" y="6" width="8" height="8" fill="white" rx="1"/>
      <rect x="6" y="18" width="8" height="8" fill="white" rx="1"/>
      <rect x="18" y="18" width="8" height="8" fill="white" rx="1"/>
      <!-- Chart elements -->
      <rect x="7" y="10" width="1" height="3" fill="#1a1a1a"/>
      <rect x="9" y="8" width="1" height="5" fill="#1a1a1a"/>
      <rect x="11" y="9" width="1" height="4" fill="#1a1a1a"/>
    </svg>
  `)}`,
  
  communication: `data:image/svg+xml,${encodeURIComponent(`
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#1a1a1a" rx="4"/>
      <!-- Email/message icon -->
      <rect x="6" y="10" width="20" height="12" fill="white" rx="1"/>
      <path d="M6 10l10 8 10-8" stroke="#1a1a1a" stroke-width="2" fill="none"/>
    </svg>
  `)}`
};

let currentFavicon = 'default';

/**
 * Changes the page favicon
 * @param {string} type - The type of favicon to set ('default', 'task', 'spreadsheet')
 */
export function setFavicon(type = 'default') {
  if (currentFavicon === type) return; // Avoid unnecessary DOM operations
  
  const faviconUrl = FAVICONS[type] || FAVICONS.default;
  
  // Find existing favicon link
  let faviconLink = document.querySelector('link[rel="icon"]');
  
  if (!faviconLink) {
    // Create new favicon link if it doesn't exist
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.type = 'image/svg+xml';
    document.head.appendChild(faviconLink);
  }
  
  // Update the favicon
  faviconLink.href = faviconUrl;
  currentFavicon = type;
}

/**
 * Resets the favicon to the default
 */
export function resetFavicon() {
  setFavicon('default');
}
