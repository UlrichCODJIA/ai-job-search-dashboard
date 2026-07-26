import type { ComponentType, SVGProps } from "react";
import {
  DiscoveryIcon,
  OverviewIcon,
  PipelineIcon,
  ProfileIcon,
  RunsIcon,
  SalaryIcon,
  SettingsIcon,
  UpskillIcon,
} from "../icons";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  end: boolean;
}

export const ALL_NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Overview", icon: OverviewIcon, end: true },
  { to: "/discovery", label: "Discovery", icon: DiscoveryIcon, end: false },
  { to: "/pipeline", label: "Pipeline", icon: PipelineIcon, end: false },
  { to: "/upskill", label: "Upskill", icon: UpskillIcon, end: false },
  { to: "/salary", label: "Salary", icon: SalaryIcon, end: false },
  { to: "/profile", label: "Profile", icon: ProfileIcon, end: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, end: false },
  { to: "/runs", label: "Runs", icon: RunsIcon, end: false },
];

const CORE_PATHS = new Set(["/", "/discovery", "/pipeline", "/runs"]);
export const CORE_NAV_ITEMS = ALL_NAV_ITEMS.filter((i) => CORE_PATHS.has(i.to));
export const RAIL_NAV_ITEMS = ALL_NAV_ITEMS.filter(
  (i) => !CORE_PATHS.has(i.to),
);
