
import React from "react";

const navItems = [
  { label: "Dashboard", icon: "🏠", href: "#dashboard", badge: 0 },
  { label: "Orders", icon: "📦", href: "#orders", badge: 3 },
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
        <span style={{ fontWeight: 700, fontSize: 20, letterSpacing: 1 }}>ShopEasly</span>
      </div>
    </div>
    <nav className="sidebar-nav" aria-label="Main navigation">
      <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
        {navItems.map((item) => (
          <li className="nav-item" key={item.label} style={{ position: "relative" }}>
            <a
              href={item.href}
              className="nav-btn"
              tabIndex={0}
              aria-current={item.label === "Dashboard" ? "page" : undefined}
            >
              <span style={{ marginRight: 14, fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontWeight: 500 }}>{item.label}</span>
              {item.badge ? (
                <span className="nav-badge" style={{
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "2px 8px",
                  marginLeft: 10,
                  minWidth: 20,
                  display: "inline-block",
                  textAlign: "center",
                  position: "absolute",
                  right: 18,
                  top: "50%",
                  transform: "translateY(-50%)"
                }}>{item.badge}</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
    <div className="sidebar-footer" style={{ marginTop: "auto", color: "var(--text-secondary)", fontSize: 12, paddingTop: 24 }}>
      &copy; {new Date().getFullYear()} ShopEasly
    </div>
  </aside>
);

export default Sidebar;
