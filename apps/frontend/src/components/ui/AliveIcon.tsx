import type { ReactElement, SVGProps } from "react";

const ICONS = {
  "arrow-left": <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
  "arrow-right": <><path d="m9 6 6 6-6 6" /><path d="M5 12h10" /></>,
  "arrow-up-right": <><path d="M8 16 16 8" /><path d="M9 8h7v7" /></>,
  "check": <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-left": <path d="m15 18-6-6 6-6" />,
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "close": <><path d="m7 7 10 10" /><path d="M17 7 7 17" /></>,
  "heart": <path d="M20.8 8.6c0 5.2-8.8 10.4-8.8 10.4S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.8 1.9Z" />,
  "heart-broken": <><path d="M12 19S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.8 1.9C20.8 13.8 12 19 12 19Z" /><path d="m13 5-3 5 4 2-3 5" /></>,
  "heart-filled": <path d="M20.8 8.6c0 5.2-8.8 10.4-8.8 10.4S3.2 13.8 3.2 8.6A4.6 4.6 0 0 1 12 6.7a4.6 4.6 0 0 1 8.8 1.9Z" fill="currentColor" />,
  "help": <><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-.9.5-1.4 1-1.4 2.1" /><path d="M12 17h.1" /></>,
  "image": <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.5" /><path d="m5.5 17 4.3-4.2 3.1 3 2.2-2.1 3.4 3.3" /></>,
  "mail": <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4.5 7 7.5 6 7.5-6" /></>,
  "masks": <><path d="M5 5.5c3-1.4 6-1.4 9 0v5.2c0 3.4-2.2 5.8-4.5 6.8C7.2 16.5 5 14.1 5 10.7Z" /><path d="M10 6.1c3-1.1 6-.7 8.5.8v5.2c0 3-1.7 5.2-3.8 6.4" /><path d="M7.6 9.2h.1M11.2 9.2h.1M7.6 13c1.2.8 2.4.8 3.6 0" /></>,
  "memory": <><path d="M9.2 4.2A4.2 4.2 0 0 0 5 8.4c0 .7.2 1.4.5 2A4 4 0 0 0 7 17.8V20l3-1.7h4.2a4.8 4.8 0 0 0 2.4-9A4.2 4.2 0 0 0 9.2 4.2Z" /><path d="M9 8.4c.7-.8 1.5-.8 2.2 0M13.2 8.4c.7-.8 1.5-.8 2.2 0M9.5 13c1.6 1.1 3.3 1.1 4.9 0" /></>,
  "message": <><path d="M20 15a3 3 0 0 1-3 3H9l-5 3v-6a3 3 0 0 1-1-2.2V7a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3Z" /><path d="M8 10h.1M12 10h.1M16 10h.1" /></>,
  "minus": <path d="M5 12h14" />,
  "more": <><circle cx="6" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  "music": <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  "pen": <><path d="m4 20 4.2-1 10.9-10.9a2.2 2.2 0 0 0-3.2-3.2L5 15.8Z" /><path d="m14.5 6.5 3 3" /></>,
  "play": <path d="m9 7 8 5-8 5Z" fill="currentColor" />,
  "plus": <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  "refresh": <><path d="M19 8a7 7 0 1 0 .4 7" /><path d="M19 4v4h-4" /></>,
  "relationship": <><circle cx="7" cy="8" r="3" /><circle cx="17" cy="16" r="3" /><path d="m9.4 10.1 5.2 3.8" /></>,
  "send": <><path d="m4 11 16-7-7 16-2.5-6.5Z" /><path d="M10.5 13.5 20 4" /></>,
  "settings": <><circle cx="12" cy="12" r="3" /><path d="M19 12a7.4 7.4 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.2 7.2 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a7.2 7.2 0 0 0-1.8 1l-2.4-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.2 7.2 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a7.2 7.2 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" /></>,
  "sparkle": <path d="M12 3c.6 4.9 3.1 7.4 8 8-4.9.6-7.4 3.1-8 8-.6-4.9-3.1-7.4-8-8 4.9-.6 7.4-3.1 8-8Z" />,
  "stop": <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
  "sun": <><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  "moon": <path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z" />,
  "swap": <><path d="M7 7h11l-3-3" /><path d="M17 17H6l3 3" /></>,
  "user": <><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>,
  "users": <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.5" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 16a4.5 4.5 0 0 1 6.5 4" /></>,
  "wallet": <><path d="M5 6h12a3 3 0 0 1 3 3v9H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10" /><path d="M14 10h7v5h-7a2.5 2.5 0 0 1 0-5Z" /><path d="M16.5 12.5h.1" /></>,
} as const;

type AliveIconName = keyof typeof ICONS;

interface AliveIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: AliveIconName;
  size?: number;
}

export function AliveIcon({ className = "", name, size = 18, strokeWidth = 1.8, ...props }: AliveIconProps): ReactElement {
  return <svg aria-hidden="true" className={`al-icon ${className}`.trim()} fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} {...props}>{ICONS[name]}</svg>;
}
