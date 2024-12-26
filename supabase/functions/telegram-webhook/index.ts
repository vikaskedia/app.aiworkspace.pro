/* 

 > curl https://api.telegram.org/bot7831997528:AAH0y6oLQgMthUBrCdBjVZn5QQrnrN8mCfA/setWebhook \
                                               -H "Content-Type: application/json" \
                                               -d '{"url": "https://oqdnbpmmgntqtigstaow.supabase.co/functions/v1/telegram-webhook"}'

 > supabase functions deploy telegram-webhook --project-ref oqdnbpmmgntqtigstaow

 > supabase secrets set TELEGRAM_BOT_TOKEN=<YOUR_BOT_TOKEN>

 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      })
    }

    // Parse the webhook data from Telegram
    const payload = await req.json()
    
    // Handle /getchatid command
    if (payload.message?.text === '/getchatid') {
      const chatId = payload.message.chat.id
      
      // Send chat ID back to user
      await fetch(
        `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `Your Chat ID is: ${chatId}`
          })
        }
      )
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    return new Response(error.message, { status: 500 })
  }
}) 