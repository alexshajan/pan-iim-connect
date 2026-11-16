// Simplified brand marks for calendar apps. Brand colours are fixed by the
// owners' guidelines, so they are not themed tokens.

export function GoogleCalendarLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="#fff" />
      <path d="M3 7.5V5.5A2.5 2.5 0 0 1 5.5 3h13A2.5 2.5 0 0 1 21 5.5v2Z" fill="#4285F4" />
      <path d="M17 21h1.5a2.5 2.5 0 0 0 2.5-2.5V17l-4 4Z" fill="#EA4335" />
      <path d="M3 17v1.5A2.5 2.5 0 0 0 5.5 21H7v-4Z" fill="#188038" />
      <path d="M17 21v-4h4Z" fill="#FBBC04" />
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill="none" stroke="#dadce0" strokeWidth="0.8" />
      <text x="12" y="16.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#4285F4" fontFamily="system-ui,sans-serif">31</text>
    </svg>
  );
}

export function AppleCalendarLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="#fff" stroke="#d1d1d6" strokeWidth="0.8" />
      <text x="12" y="8.6" textAnchor="middle" fontSize="4" fontWeight="700" fill="#FF3B30" fontFamily="system-ui,sans-serif">FRI</text>
      <text x="12" y="17.8" textAnchor="middle" fontSize="9" fontWeight="500" fill="#1c1c1e" fontFamily="system-ui,sans-serif">27</text>
    </svg>
  );
}

export function OutlookLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="8" y="4" width="13" height="16" rx="2" fill="#0F6CBD" />
      <path d="M8 9h13v3l-6.5 4L8 12Z" fill="#28A8EA" />
      <rect x="3" y="7" width="10" height="10" rx="1.6" fill="#0A4F8F" />
      <ellipse cx="8" cy="12" rx="2.6" ry="3" fill="none" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
