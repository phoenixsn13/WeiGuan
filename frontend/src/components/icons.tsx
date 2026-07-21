import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

function LineIcon({ children, title, ...props }: IconProps) {
  return (
    <svg
      aria-hidden={title ? undefined : "true"}
      aria-label={title}
      fill="none"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

function path(d: string, strokeWidth = 1.9) {
  return (
    <path
      d={d}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    />
  );
}

export function BrandGlyph(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 32 32" {...props}>
      <circle cx="16" cy="16" r="15" fill="#F5B12F" />
      <circle cx="16" cy="16" r="5.5" stroke="#0B1220" strokeWidth="3.5" />
      <circle cx="16" cy="16" r="1.7" fill="#0B1220" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9")}
      {path("M13.7 21a2 2 0 0 1-3.4 0")}
    </LineIcon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("M12 3 5 6v5c0 4.4 2.8 8.4 7 10 4.2-1.6 7-5.6 7-10V6l-7-3Z")}
      {path("m9.5 12 1.6 1.6 3.4-4")}
    </LineIcon>
  );
}

export function MessageCircleIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.1-5.1A8.5 8.5 0 1 1 21 11.5Z")}
      {path("M8 10h8M8 14h5")}
    </LineIcon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.9" />
      {path("M3 12h18M12 3c2.3 2.4 3.5 5.4 3.5 9S14.3 18.6 12 21M12 3c-2.3 2.4-3.5 5.4-3.5 9s1.2 6.6 3.5 9")}
    </LineIcon>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("m22 2-7 20-4-9-9-4 20-7Z")}
      {path("M22 2 11 13")}
    </LineIcon>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("M4 7.5h15a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h12")}
      {path("M16 13h3")}
    </LineIcon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.9" />
      {path("m16.5 16.5 4 4")}
    </LineIcon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("M5 12h14M13 6l6 6-6 6")}
    </LineIcon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("m15 18-6-6 6-6")}
    </LineIcon>
  );
}

export function MoreHorizontalIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </LineIcon>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("M12 17v5")}
      {path("M8 3h8l-1 6 3 3v2H6v-2l3-3-1-6Z")}
    </LineIcon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("M3 10.5 12 3l9 7.5")}
      {path("M5 10v10h14V10")}
    </LineIcon>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("M4 6h16M4 12h16M4 18h16")}
    </LineIcon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2")}
      {path("M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z")}
      {path("M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8")}
    </LineIcon>
  );
}

export function ZapIcon(props: IconProps) {
  return (
    <LineIcon {...props}>
      {path("m13 2-2 7h7l-9 13 2-8H4l9-12Z")}
    </LineIcon>
  );
}

export function WeiboIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <ellipse cx="11.4" cy="13.5" fill="#fff" rx="7.5" ry="5.3" />
      <path d="M5.7 12.3c1.2-3.2 5.7-5.1 9.2-3.6 3.9 1.7 3.6 6.2-.4 8.2-4.3 2.2-9.7.8-9.9-2.4-.1-.8.3-1.5 1.1-2.2Z" fill="#E6162D" />
      <path d="M17.4 5.2c2.1.3 3.8 2 4.1 4.1M17.1 8c.9.2 1.7.9 1.9 1.9" stroke="#F5B12F" strokeLinecap="round" strokeWidth="1.8" />
      <ellipse cx="10.5" cy="13.6" fill="#fff" rx="3.8" ry="2.8" transform="rotate(-12 10.5 13.6)" />
      <circle cx="9.3" cy="13.1" r="1.1" fill="#111827" />
      <circle cx="12" cy="14.1" r=".8" fill="#111827" />
    </svg>
  );
}

export function RedditIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="10" fill="#FF4500" />
      <path d="M7.4 12.8c0-2.2 2.1-4 4.7-4s4.7 1.8 4.7 4-2.1 4-4.7 4-4.7-1.8-4.7-4Z" fill="#fff" />
      <circle cx="9.9" cy="12.2" r=".9" fill="#FF4500" />
      <circle cx="14.3" cy="12.2" r=".9" fill="#FF4500" />
      <path d="M10.1 14.4c1 .8 2.9.8 4 0" stroke="#FF4500" strokeLinecap="round" strokeWidth="1.2" />
      <path d="M13.6 8.9 15 6.5l2.1.5" stroke="#fff" strokeLinecap="round" strokeWidth="1.4" />
      <circle cx="17.6" cy="7.2" r="1.1" fill="#fff" />
    </svg>
  );
}

export function MultiPlatformIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <circle cx="7" cy="8" r="4" fill="#8B5CF6" />
      <circle cx="16.5" cy="7.5" r="3.5" fill="#C084FC" />
      <circle cx="12" cy="16" r="4.2" fill="#A855F7" />
      <path d="M10.2 9.8 12 12M14 10.3l-1.4 2" stroke="#fff" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  );
}
