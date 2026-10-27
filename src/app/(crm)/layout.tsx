import { Sidebar } from "@/components/shell/sidebar";

export default function CrmLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <p className="bg-amber-soft px-4 py-1.5 text-center text-xs font-medium text-amber sm:px-8">
          Mockup con datos ficticios. Webpay, GPSTracker, Service Desk y mensajería están simulados.
        </p>
        <main className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
