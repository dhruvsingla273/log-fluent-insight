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
    const { logId, content } = await req.json();
    
    if (!logId || !content) {
      throw new Error('Log ID and content are required');
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    console.log('Processing log summarization for log ID:', logId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update log status to processing
    await supabase
      .from('logs')
      .update({ status: 'processing' })
      .eq('id', logId);

    // Call Gemini API for summarization
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Please analyze and summarize this log file. Provide:
1. Overall summary (2-3 sentences)
2. Key events or errors identified
3. Critical issues that need attention
4. Performance insights if applicable
5. Recommendations for action

Log content:
${content.slice(0, 50000)}` // Limit to avoid token limits
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      }),
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${await geminiResponse.text()}`);
    }

    const geminiData = await geminiResponse.json();
    const summary = geminiData.candidates[0].content.parts[0].text;

    console.log('Generated summary for log:', logId);

    // Update log with summary and completed status
    const { error: updateError } = await supabase
      .from('logs')
      .update({ 
        summary: summary,
        status: 'completed',
        original_content: content 
      })
      .eq('id', logId);

    if (updateError) {
      throw new Error(`Database update error: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      summary: summary,
      logId: logId 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in summarize-log function:', error);
    
    // Try to update log status to error if possible
    try {
      const { logId } = await req.json();
      if (logId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        await supabase
          .from('logs')
          .update({ status: 'error' })
          .eq('id', logId);
      }
    } catch (e) {
      console.error('Failed to update log status to error:', e);
    }

    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});