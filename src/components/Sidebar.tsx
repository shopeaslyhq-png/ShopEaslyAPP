import React from "react";

const navItems = [
  { label: "Dashboard", icon: "🏠", href: "#dashboard" },
  { label: "Orders", icon: "📦", href: "#orders" },
  { label: "Products", icon: "🛒", href: "#products" },
  { label: "Materials", icon: "🧵", href: "#materials" },
  { label: "Ideas Hub", icon: "💡", href: "#ideas" },
  { label: "Settings", icon: "⚙️", href: "#settings" },
];

export const Sidebar: React.FC = () => (
  <aside className="sidebar">
    <div className="sidebar-header">
      <div className="logo">
        <img src="/images/shopeasly-logo.png" alt="ShopEasly Logo" style={{ height: 36 }} />
        <span>ShopEasly</span>
      </div>
    </div>
    <nav className="sidebar-nav">
      <ul>
        {navItems.map((item) => (
          <li className="nav-item" key={item.label}>
            <a href={item.href}>
              <span style={{ marginRight: 12 }}>{item.icon}</span>
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
    <div className="sidebar-footer" style={{ marginTop: "auto", color: "var(--text-secondary)", fontSize: 12 }}>
      &copy; {new Date().getFullYear()} ShopEasly
    </div>
  </aside>
);

export default Sidebar;
