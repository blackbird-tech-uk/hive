import {
  Box,
  CalendarDays,
  LayoutDashboard,
  Radio,
  Settings,
  Wrench,
} from "lucide-react";
import { NavLink } from "react-router-dom";

const navigationItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Devices", icon: Radio, path: "/devices" },
  { label: "Events", icon: CalendarDays, path: "/events" },
  { label: "Inventory", icon: Box, path: "/inventory" },
  { label: "Repairs", icon: Wrench, path: "/repairs" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          H
        </div>

        <div>
          <p className="eyebrow">BLACKBIRD</p>
          <h1>Hive</h1>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigationItems.map(({ label, icon: Icon, path }) => (
          <NavLink
            className={({ isActive }) =>
              `nav-item${isActive ? " nav-item-active" : ""}`
            }
            key={path}
            to={path}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="status-dot" />

        <div>
          <strong>Hive API</strong>
          <p>Connected locally</p>
        </div>
      </div>
    </aside>
  );
}