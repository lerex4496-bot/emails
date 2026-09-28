import React, { useState } from 'react';
import { Shell, NavTab } from './components/layout/Shell.js';
import { Dashboard } from './pages/Dashboard.js';
import { MessagesPage } from './pages/Messages.js';
import { MessageDetails } from './pages/MessageDetails.js';
import { ActivityPage } from './pages/Activity.js';
import { LinksPage } from './pages/Links.js';
import { RepliesPage } from './pages/Replies.js';
import { SettingsPage } from './pages/Settings.js';
import { DiagnosticsPage } from './pages/Diagnostics.js';
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
            <Dashboard
              onSelectMessage={handleSelectMessage}
              onOpenComposer={() => setIsComposerOpen(true)}
            />
          )}

          {activeTab === 'messages' && (
            <MessagesPage
              onSelectMessage={handleSelectMessage}
              onOpenComposer={() => setIsComposerOpen(true)}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityPage onSelectMessage={handleSelectMessage} />
          )}

          {activeTab === 'links' && (
            <LinksPage onSelectMessage={handleSelectMessage} />
          )}

          {activeTab === 'replies' && (
            <RepliesPage onSelectMessage={handleSelectMessage} />
          )}

          {activeTab === 'settings' && <SettingsPage />}

          {activeTab === 'diagnostics' && <DiagnosticsPage />}

          {activeTab === 'docs' && <DocumentationPage />}
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
