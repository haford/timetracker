import {
  LayoutDashboard,
  FolderOpen,
  Clock3,
  CalendarDays,
  FileText,
  ChartNoAxesCombined,
  Wallet,
  Tags,
} from "lucide-react";

export const navigation = [
  {
    href: "/dashboard",
    label: "Oversikt",
    icon: LayoutDashboard,
    group: "Arbeidsrom",
  },
  { href: "/cases", label: "Saker", icon: FolderOpen, group: "Arbeidsrom" },
  { href: "/timer", label: "Timeføring", icon: Clock3, group: "Arbeidsrom" },
  {
    href: "/kalender",
    label: "Kalender",
    icon: CalendarDays,
    group: "Arbeidsrom",
  },
  {
    href: "/begrunnelser",
    label: "Begrunnelser",
    icon: FileText,
    group: "Arbeidsrom",
  },
  {
    href: "/reports",
    label: "Innsikt & rapporter",
    icon: ChartNoAxesCombined,
    group: "Administrasjon",
  },
  { href: "/okonomi", label: "Økonomi", icon: Wallet, group: "Administrasjon" },
  {
    href: "/categories",
    label: "Kategorier",
    icon: Tags,
    group: "Administrasjon",
  },
];
