
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Inbox from './pages/Inbox';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Integrations from './pages/Integrations';
import KnowledgeBase from './pages/KnowledgeBase';
import PhoneNumbers from './pages/PhoneNumbers';
import Workflows from './pages/Workflows';
import WebsiteHome from './pages/WebsiteHome';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Pricing from './pages/Pricing';
import Privacy from './pages/Privacy';
import Security from './pages/Security';
import Terms from './pages/Terms';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  // Manage public pages navigation (home, login, signup, pricing, privacy, security, terms)
  const [publicView, setPublicView] = useState('home');

  const handleLogin = () => {
    setIsLoggedIn(true);
    setCurrentView('dashboard');
  };

  const renderAuthenticatedView = () => {
    switch (currentView) {
      case 'inbox':
        return <Inbox />;
      case 'dashboard':
        return <Dashboard />;
      case 'integrations':
        return <Integrations />;
      case 'knowledge':
        return <KnowledgeBase />;
      case 'phone-numbers':
        return <PhoneNumbers />;
      case 'workflows':
        return <Workflows />;
      case 'settings':
        return <Settings />;
      default:
        return (
            <div className="flex items-center justify-center h-full flex-col bg-slate-50">
                <div className="p-8 text-center">
                    <h2 className="text-2xl font-bold text-slate-400 mb-2">Work in Progress</h2>
                    <p className="text-slate-400">The {currentView} module is coming soon.</p>
                    <button onClick={() => setCurrentView('dashboard')} className="mt-4 text-indigo-600 hover:underline">Go back Dashboard</button>
                </div>
            </div>
        );
    }
  };

  if (!isLoggedIn) {
    switch (publicView) {
      case 'login':
        return <Login onLogin={handleLogin} onNavigate={setPublicView} />;
      case 'signup':
        return <Signup onSignup={handleLogin} onNavigate={setPublicView} />;
      case 'pricing':
        return <Pricing onNavigate={setPublicView} />;
      case 'privacy':
        return <Privacy onNavigate={setPublicView} />;
      case 'security':
        return <Security onNavigate={setPublicView} />;
      case 'terms':
        return <Terms onNavigate={setPublicView} />;
      case 'home':
      default:
        return <WebsiteHome onNavigate={setPublicView} />;
    }
  }

  return (
    <div className="flex h-screen w-screen bg-slate-100 font-sans text-slate-900 overflow-hidden animate-fade-in">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        {renderAuthenticatedView()}
      </main>
    </div>
  );
};

export default App;
