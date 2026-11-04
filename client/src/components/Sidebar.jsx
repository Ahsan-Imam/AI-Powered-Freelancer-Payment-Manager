import React from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/clients', label: 'Clients', icon: '👥' },
  { to: '/projects', label: 'Projects', icon: '📁' },
  { to: '/invoices', label: 'Invoices', icon: '📄' },
  { to: '/payments', label: 'Payments', icon: '💳' },
  { to: '/ai-assistant', label: 'AI Assistant', icon: '🤖' },
  { to: '/reminders', label: 'Reminders', icon: '🔔' },
  { to: '/insights', label: 'Insights', icon: '📈' },
];

const Sidebar = () => {
  return (
    <aside className="sidebar hidden md:flex flex-col w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-56px)]">
      <nav className="flex-1 py-4 px-3 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-l-4 border-transparent'
              }`
            }
          >
            <span className="text-lg">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
