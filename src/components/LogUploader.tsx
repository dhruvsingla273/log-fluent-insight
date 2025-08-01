import { useState, useCallback } from 'react';
import { Upload, File, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface LogUploaderProps {
  onLogUploaded: (logId: string, filename: string) => void;
}

export const LogUploader = ({ onLogUploaded }: LogUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const logFile = files.find(file => 
      file.type === 'text/plain' || 
      file.name.endsWith('.log') || 
      file.name.endsWith('.txt')
    );
    
    if (logFile) {
      setSelectedFile(logFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a .log or .txt file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }, []);

  const processLogFile = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // Read file content
      const content = await selectedFile.text();
      
      // Create log entry
      const { data: log, error: logError } = await supabase
        .from('logs')
        .insert({
          filename: selectedFile.name,
          file_path: `logs/${Date.now()}-${selectedFile.name}`,
          original_content: content,
          status: 'uploaded'
        })
        .select()
        .single();

      if (logError) throw logError;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('log-files')
        .upload(log.file_path, selectedFile);

      if (uploadError) {
        console.warn('Storage upload failed:', uploadError);
        // Continue anyway since we have the content in the database
      }

      // Start summarization process
      const response = await supabase.functions.invoke('summarize-log', {
        body: {
          logId: log.id,
          content: content
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Log uploaded successfully!",
        description: "AI is analyzing your log file...",
      });

      onLogUploaded(log.id, selectedFile.name);
      setSelectedFile(null);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload log file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="p-8">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Upload Log File</h2>
          <p className="text-muted-foreground">
            Upload your log file to get AI-powered analysis and insights
          </p>
        </div>

        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-lg p-12 transition-colors cursor-pointer ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drop your log file here or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Supports .log and .txt files
            </p>
            <input
              id="file-input"
              type="file"
              accept=".log,.txt,text/plain"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center space-x-3">
                <File className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={processLogFile}
                disabled={isUploading}
                className="flex-1"
              >
                {isUploading ? 'Processing...' : 'Analyze Log'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedFile(null)}
                disabled={isUploading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};