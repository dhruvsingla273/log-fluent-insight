import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, message, logId } = await req.json();
    
    if (!sessionId || !message || !logId) {
      throw new Error('Session ID, message, and log ID are required');
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    console.log('Processing chat for session:', sessionId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get log details and summary
    const { data: log, error: logError } = await supabase
      .from('logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (logError || !log) {
      throw new Error('Log not found');
    }

    // Get previous messages for context
    const { data: previousMessages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(10);

    if (messagesError) {
      throw new Error(`Failed to fetch previous messages: ${messagesError.message}`);
    }

    // Store user message
    const { error: userMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: message
      });

    if (userMessageError) {
      throw new Error(`Failed to store user message: ${userMessageError.message}`);
    }

    // Build conversation context
    let conversationContext = `You are an AI assistant helping analyze a log file. Here's the context:

Log filename: ${log.filename}
Log summary: ${log.summary || 'No summary available yet'}

`;

    if (previousMessages && previousMessages.length > 0) {
      conversationContext += 'Previous conversation:\n';
      previousMessages.forEach(msg => {
        conversationContext += `${msg.role}: ${msg.content}\n`;
      });
    }

    conversationContext += `
Current user question: ${message}

Please provide a helpful response based on the log analysis. If you need to reference specific parts of the log, you can ask the user to provide more details.`;

    // Call Gemini API for chat response
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: conversationContext
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${await geminiResponse.text()}`);
    }

    const geminiData = await geminiResponse.json();
    const assistantResponse = geminiData.candidates[0].content.parts[0].text;

    console.log('Generated response for session:', sessionId);

    // Store assistant message
    const { error: assistantMessageError } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: assistantResponse
      });

    if (assistantMessageError) {
      throw new Error(`Failed to store assistant message: ${assistantMessageError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      response: assistantResponse 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in chat-log function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});