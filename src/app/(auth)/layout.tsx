import type { Viewport } from "next";
import { TopNav } from "@/components/top-nav";
import "../styles/auth.css";

export const viewport: Viewport = {
  themeColor: "#f5f1e8",
  viewportFit: "cover",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-product-chrome auth-product-chrome">
      <TopNav layout="app" />
      {children}
    </div>
  );
}
