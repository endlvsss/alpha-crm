import { Sidebar } from "@/components/shell/sidebar";
import { DemoBanner } from "@/components/shell/demo-banner";
import { ToastProvider } from "@/components/ui/toast";
import { ServicesProvider } from "@/services";

export default function CrmLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <ServicesProvider>
        <div className="lg:flex">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <DemoBanner />
            <main id="contenido" className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8">
              {children}
            </main>
          </div>
        </div>
      </ServicesProvider>
    </ToastProvider>
  );
}
