import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Sidebar } from "@/components/Sidebar";
import { SourceGuard } from "@/components/SourceGuard";

export const metadata: Metadata = {
  title: "Statutory Audit Analysis — Document Comparison Engine",
  description:
    "Compares uploaded vouchers against uploaded policies only. No third source is ever used.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <SourceGuard />
              <main className="min-w-0 flex-1 px-5 py-6 md:px-8">{children}</main>
            </div>
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
