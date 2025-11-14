import { ReactNode } from "react";
import { Header } from "@/components/layout/Header";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { LucideIcon } from "lucide-react";
import { User } from "@/hooks/useUser";

export interface NavItem {
  value: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface DashboardLayoutProps {
  user: User | null;
  navItems: NavItem[];
  selectedSection: string;
  onSectionChange: (section: string) => void;
  children: ReactNode;
  notificationCount?: number;
}

export function DashboardLayout({
  user,
  navItems,
  selectedSection,
  onSectionChange,
  children,
  notificationCount = 0,
}: DashboardLayoutProps) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs uppercase tracking-wide text-muted-foreground px-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.value}>
                      <SidebarMenuButton
                        isActive={selectedSection === item.value}
                        onClick={() => onSectionChange(item.value)}
                        data-testid={`nav-${item.value}`}
                        tooltip={item.label}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                            {item.badge}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-4 border-b bg-background sticky top-0 z-40">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1" />
            <Header user={user} notificationCount={notificationCount} />
          </header>

          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
