import type { ReactNode, SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const OverviewIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M3.5 10 L10 4.5 L16.5 10" />
    <path d="M5.5 8.7 V16 H14.5 V8.7" />
  </Icon>
);

export const DiscoveryIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="10" cy="10" r="7" />
    <path d="M12.8 7.2 L11 11 L7.2 12.8 L9 9 Z" />
  </Icon>
);

export const PipelineIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="3" y="4" width="4" height="12" rx="1" />
    <rect x="8" y="4" width="4" height="8" rx="1" />
    <rect x="13" y="4" width="4" height="10" rx="1" />
  </Icon>
);

export const UpskillIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M2.5 7 L10 3.5 L17.5 7 L10 10.5 Z" />
    <path d="M5.5 8.6 V13 C5.5 14.5 14.5 14.5 14.5 13 V8.6" />
  </Icon>
);

export const SalaryIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="10" cy="10" r="7" />
    <path d="M10 6.5 V13.5 M12 8 C12 6.9 11.1 6.5 10 6.5 C8.9 6.5 8 6.9 8 8 C8 10 12 9 12 11.5 C12 12.6 11.1 13.5 10 13.5 C8.9 13.5 8 12.6 8 11.5" />
  </Icon>
);

export const ProfileIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="10" cy="7" r="3" />
    <path d="M4 17 C4 13 7 11.5 10 11.5 C13 11.5 16 13 16 17" />
  </Icon>
);

export const RunsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <rect x="2.5" y="3.5" width="15" height="13" rx="1.5" />
    <path d="M5.5 8 L8.5 10 L5.5 12" />
    <line x1="10.5" y1="12.5" x2="14.5" y2="12.5" />
  </Icon>
);

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <circle cx="9" cy="9" r="5" />
    <line x1="13" y1="13" x2="17" y2="17" />
  </Icon>
);

export const SettingsIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M10 3 L16.06 6.5 V13.5 L10 17 L3.94 13.5 V6.5 Z" />
    <circle cx="10" cy="10" r="2.6" />
  </Icon>
);

export const MenuIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <line x1="3.5" y1="6" x2="16.5" y2="6" />
    <line x1="3.5" y1="10" x2="16.5" y2="10" />
    <line x1="3.5" y1="14" x2="16.5" y2="14" />
  </Icon>
);

export const ChevronLeftIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <path d="M12 5 L7 10 L12 15" />
  </Icon>
);

export const PlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <Icon {...props}>
    <line x1="10" y1="4" x2="10" y2="16" />
    <line x1="4" y1="10" x2="16" y2="10" />
  </Icon>
);
