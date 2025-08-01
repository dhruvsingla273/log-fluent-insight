import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FileText, MessageSquare, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface Log {
  id: string;
  filename: string;
  summary: string | null;
  status: string;
  created_at: string;
}

interface LogSummaryProps {
  logId: string;
  filename: string;
  onStartChat: (logId: string, filename: string) => void;
}

export const LogSummary = ({ logId, filename, onStartChat }: LogSummaryProps) => {
  const [log, setLog] = useState<Log | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchLog = async () => {
    try {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('id', logId)
        .single();

      if (error) throw error;
      setLog(data);
    } catch (error) {
      console.error('Error fetching log:', error);
      toast({
        title: "Error loading log",
        description: "Failed to load log details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLog();

    // Set up real-time subscription for log updates
    const channel = supabase
      .channel('log-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'logs',
          filter: `id=eq.${logId}`
        },
        (payload) => {
          setLog(payload.new as Log);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [logId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'processing': return 'secondary';
      case 'error': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Analysis Complete';
      case 'processing': return 'Analyzing...';
      case 'error': return 'Analysis Failed';
      default: return 'Uploaded';
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    );
  }

  if (!log) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">Log not found</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg">{filename}</h3>
          </div>
          <div className="flex items-center space-x-3">
            <Badge variant={getStatusColor(log.status) as any}>
              {getStatusText(log.status)}
            </Badge>
            {log.status === 'processing' && (
              <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {log.status === 'processing' && (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-lg font-medium">AI is analyzing your log file...</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take a few moments depending on the log size
            </p>
          </div>
        )}

        {log.status === 'completed' && log.summary && (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-3">AI Analysis Summary</h4>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {log.summary}
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <Button
                onClick={() => onStartChat(log.id, filename)}
                className="w-full"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Start Chat for Follow-up Questions
              </Button>
            </div>
          </div>
        )}

        {log.status === 'error' && (
          <div className="text-center py-8">
            <p className="text-lg font-medium text-destructive">Analysis Failed</p>
            <p className="text-sm text-muted-foreground mt-2">
              There was an error analyzing your log file. Please try uploading again.
            </p>
            <Button 
              variant="outline" 
              onClick={fetchLog}
              className="mt-4"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-4 border-t">
          Uploaded: {new Date(log.created_at).toLocaleString()}
        </div>
      </div>
    </Card>
  );
};