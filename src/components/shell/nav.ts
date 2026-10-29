import type { ComponentType, SVGProps } from "react";
import { URL_SITIO } from "@/services/eventos";
import {
  CalendarIcon,
  ChartIcon,
  ChipIcon,
  CoinsIcon,
  GridIcon,
  HomeIcon,
  InboxIcon,
  KanbanIcon,
  PlayIcon,
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
  /** Abre otro sistema en una pestaña nueva. */
  externo?: boolean;
}

// Ordenado por el flujo del administrador: vender → instalar → cobrar y atender.
export const NAV: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [
      { href: "/", label: "Inicio", icon: GridIcon },
      { href: "/demo", label: "Recorrido demo", icon: PlayIcon },
    ],
  },
  {
    title: "Ventas",
    items: [
      { href: "/ventas", label: "Pipeline", icon: KanbanIcon },
      { href: "/clientes", label: "Clientes", icon: UsersIcon },
      { href: "/ordenes", label: "Órdenes y pagos", icon: ReceiptIcon },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { href: "/agenda", label: "Agenda", icon: CalendarIcon },
      { href: "/visitas", label: "Instalaciones", icon: InboxIcon },
      { href: "/tecnicos", label: "Técnicos", icon: WrenchIcon },
      { href: "/dispositivos", label: "Dispositivos", icon: ChipIcon },
    ],
  },
  {
    title: "Postventa",
    items: [
      { href: "/cobros", label: "Suscripciones", icon: CoinsIcon },
      { href: "/finanzas", label: "Finanzas", icon: ChartIcon },
      { href: "/soporte", label: "Soporte", icon: TicketIcon },
    ],
  },
  { title: "Sistema", items: [{ href: "/integraciones", label: "Integraciones", icon: PlugIcon }] },
  {
    title: "Otros sistemas (demo)",
    items: [
      { href: URL_SITIO, label: "Sitio y checkout", icon: HomeIcon, externo: true },
      { href: `${URL_SITIO}/instalador`, label: "Portal del técnico", icon: WrenchIcon, externo: true },
    ],
  },
];
