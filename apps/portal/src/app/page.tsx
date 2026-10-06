import { Portal, type Platform } from "./portal";

const PLATFORMS: Platform[] = [
  {
    key: "dd",
    name: "Duty Desk",
    dept: "Resident Officers",
    desc: "Checklists, complaints, maintenance and the duty log.",
    href: process.env.NEXT_PUBLIC_DUTY_DESK_URL || "#",
    icon: "home",
  },
  {
    key: "gh",
    name: "Gatehouse",
    dept: "Security",
    desc: "Incidents, access control, patrols and alerts.",
    href: process.env.NEXT_PUBLIC_GATEHOUSE_URL || "#",
    icon: "shield",
  },
  {
    key: "md",
    name: "Maintenance Desk",
    dept: "Maintenance",
    desc: "The ticket queue and what each fix cost.",
    href: process.env.NEXT_PUBLIC_MAINTENANCE_DESK_URL || "#",
    icon: "wrench",
  },
];

export default function PortalPage() {
  return <Portal platforms={PLATFORMS} />;
}
