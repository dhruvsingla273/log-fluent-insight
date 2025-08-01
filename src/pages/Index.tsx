import { useState } from 'react';
import { LogUploader } from '@/components/LogUploader';
import { LogSummary } from '@/components/LogSummary';
import { ChatBot } from '@/components/ChatBot';
import { Activity, BarChart3, MessageSquare } from 'lucide-react';

const Index = () => {
  const [currentView, setCurrentView] = useState<'upload' | 'summary' | 'chat'>('upload');
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [currentFilename, setCurrentFilename] = useState<string>('');

  const handleLogUploaded = (logId: string, filename: string) => {
    setCurrentLogId(logId);
    setCurrentFilename(filename);
    setCurrentView('summary');
  };

  const handleStartChat = (logId: string, filename: string) => {
    setCurrentLogId(logId);
    setCurrentFilename(filename);
    setCurrentView('chat');
  };

  const handleBackToSummary = () => {
    setCurrentView('summary');
  };

  const handleBackToUpload = () => {
    setCurrentView('upload');
    setCurrentLogId(null);
    setCurrentFilename('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="container mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="p-3 bg-primary rounded-xl">
              <Activity className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              LogFluent Insight
            </h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            AI-powered log analysis platform that transforms complex log files into actionable insights
          </p>
        </div>

        {/* Features Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="flex items-center space-x-3 p-4 bg-card rounded-lg border">
            <BarChart3 className="w-8 h-8 text-primary" />
            <div>
              <h3 className="font-semibold">Smart Analysis</h3>
              <p className="text-sm text-muted-foreground">AI-powered log summarization</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-card rounded-lg border">
            <MessageSquare className="w-8 h-8 text-primary" />
            <div>
              <h3 className="font-semibold">Interactive Chat</h3>
              <p className="text-sm text-muted-foreground">Ask follow-up questions</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-card rounded-lg border">
            <Activity className="w-8 h-8 text-primary" />
            <div>
              <h3 className="font-semibold">Real-time Processing</h3>
              <p className="text-sm text-muted-foreground">Scalable cloud infrastructure</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          {currentView === 'upload' && (
            <LogUploader onLogUploaded={handleLogUploaded} />
          )}

          {currentView === 'summary' && currentLogId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBackToUpload}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back to Upload
                </button>
              </div>
              <LogSummary
                logId={currentLogId}
                filename={currentFilename}
                onStartChat={handleStartChat}
              />
            </div>
          )}

          {currentView === 'chat' && currentLogId && (
            <ChatBot
              logId={currentLogId}
              filename={currentFilename}
              onBack={handleBackToSummary}
            />
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-16 pt-8 border-t">
          <p className="text-sm text-muted-foreground">
            Powered by AI • Built for scalability • Designed for insights
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
