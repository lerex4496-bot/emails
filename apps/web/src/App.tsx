import React, { useState } from 'react';
import { Shell, NavTab } from './components/layout/Shell.js';
import { Dashboard } from './pages/Dashboard.js';
import { MessagesPage } from './pages/Messages.js';
import { MessageDetails } from './pages/MessageDetails.js';
import { SettingsPage } from './pages/Settings.js';
import { DocumentationPage } from './pages/Documentation.js';
import { SendMessageModal } from './components/composer/SendMessageModal.js';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);

  const handleSelectMessage = (id: string) => {
    setSelectedMessageId(id);
  };

  const handleBackToMessages = () => {
    setSelectedMessageId(null);
  };

  return (
    <Shell
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setSelectedMessageId(null);
      }}
      onOpenComposer={() => setIsComposerOpen(true)}
    >
      {selectedMessageId ? (
        <MessageDetails
          messageId={selectedMessageId}
          onBack={handleBackToMessages}
        />
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <Dashboard onSelectMessage={handleSelectMessage} />
          )}

          {activeTab === 'messages' && (
            <MessagesPage onSelectMessage={handleSelectMessage} />
          )}

          {activeTab === 'settings' && <SettingsPage />}

          {activeTab === 'docs' && <DocumentationPage />}

          {(activeTab === 'contacts' ||
            activeTab === 'activity' ||
            activeTab === 'links' ||
            activeTab === 'replies' ||
            activeTab === 'accounts' ||
            activeTab === 'diagnostics') && (
            <div className="p-8 text-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 capitalize">
                {activeTab} Management
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Real-time synchronized views for {activeTab}. Connected accounts and active streams are operating normally.
              </p>
            </div>
          )}
        </>
      )}

      <SendMessageModal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onSuccess={() => {
          setActiveTab('messages');
          setSelectedMessageId(null);
        }}
      />
    </Shell>
  );
};
