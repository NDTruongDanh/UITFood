import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Utensils,
  Map,
  BarChart3,
  Settings,
  CircleHelp,
  LogOut,
  Tag,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useLogout } from '@/features/auth/hooks/useLogout';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Orders', url: '/orders', icon: ClipboardList },
  { title: 'Menu', url: '/menu', icon: Utensils },
  { title: 'Delivery Zones', url: '/delivery-zones', icon: Map },
  { title: 'Analytics', url: '/analytics', icon: BarChart3 },
  { title: 'Promotions', url: '/promotions', icon: Tag },
  { title: 'Settings', url: '/settings', icon: Settings },
];

const footerNavItems = [
  {
    title: 'Help',
    url: '/help',
    icon: CircleHelp,
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { logout, isLoggingOut } = useLogout();

  return (
    <Sidebar className="bg-card">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="UITFood logo"
            className="size-11 shrink-0 object-contain"
          />
          <div className="flex min-w-0 flex-col">
            <span className="font-headline text-xl font-extrabold leading-none tracking-tight text-foreground">
              UIT<span className="text-primary">Food</span>
            </span>
            <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Management Portal
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarMenu className="gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={
                    isActive
                      ? 'bg-primary-200 text-primary hover:bg-primary-200 hover:text-primary'
                      : 'text-on-surface-variant'
                  }
                >
                  <Link to={item.url} className="flex items-center gap-3 py-6">
                    <item.icon
                      className={
                        isActive ? 'text-primary' : 'text-on-surface-variant'
                      }
                    />
                    <span className="font-medium">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 gap-4">
        <SidebarMenu className="gap-1">
          {footerNavItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                className="text-on-surface-variant hover:bg-surface-container"
              >
                <Link to={item.url} className="flex items-center gap-3">
                  <item.icon className="text-on-surface-variant" />
                  <span className="font-medium">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              disabled={isLoggingOut}
              className="text-error hover:bg-error/10 hover:text-error focus-visible:text-error active:text-error disabled:opacity-50"
            >
              <LogOut className="text-error" />
              <span className="font-medium text-error">
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
