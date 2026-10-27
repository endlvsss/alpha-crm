import type { ComponentType, SVGProps } from "react";
import {
  CalendarIcon,
  ChipIcon,
  CoinsIcon,
  GridIcon,
  InboxIcon,
  KanbanIcon,
  PlugIcon,
  ReceiptIcon,
  TicketIcon,
  UsersIcon,
  WrenchIcon,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const NAV: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ href: "/", label: "Inicio", icon: GridIcon }] },
  {
    title: "Ventas",
    items: [
      { href: "/ventas", label: "Tablero", icon: KanbanIcon },
      { href: "/clientes", label: "Clientes", icon: UsersIcon },
      { href: "/ordenes", label: "Órdenes y pagos", icon: ReceiptIcon },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarIcon },
      { href: "/visitas", label: "Visitas", icon: InboxIcon },
      { href: "/tecnicos", label: "Técnicos", icon: WrenchIcon },
      { href: "/dispositivos", label: "Dispositivos", icon: ChipIcon },
    ],
  },
  {
    title: "Soporte y cobro",
    items: [
      { href: "/soporte", label: "Soporte", icon: TicketIcon },
      { href: "/cobros", label: "Suscripciones y cobro", icon: CoinsIcon },
    ],
  },
  { title: "Sistema", items: [{ href: "/integraciones", label: "Integraciones", icon: PlugIcon }] },
];
