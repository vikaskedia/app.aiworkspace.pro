/* 

 > curl https://api.telegram.org/bot7831997528:AAH0y6oLQgMthUBrCdBjVZn5QQrnrN8mCfA/setWebhook \
                                               -H "Content-Type: application/json" \
                                               -d '{"url": "https://oqdnbpmmgntqtigstaow.supabase.co/functions/v1/telegram-webhook"}'

 > supabase functions deploy telegram-webhook --project-ref oqdnbpmmgntqtigstaow

 > supabase secrets set TELEGRAM_BOT_TOKEN=<YOUR_BOT_TOKEN>

> curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
if bottoen is 123 then the url is https://api.telegram.org/bot123/getWebhookInfo
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
    console.log('Received webhook payload:', JSON.stringify(payload, null, 2))

    // Handle any message
    if (payload.message) {
      const chatId = payload.message.chat.id
      const messageText = payload.message.text
      
      console.log(`Received message "${messageText}" from chat ID ${chatId}`)

      // Handle /getchatid command
      if (messageText === '/getchatid' || messageText === '/start') {
        console.log('Sending chat ID response')
        
        const response = await fetch(
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

        const responseData = await response.json()
        console.log('Telegram API response:', JSON.stringify(responseData, null, 2))

        if (!response.ok) {
          throw new Error(`Telegram API error: ${JSON.stringify(responseData)}`)
        }
      }
    }

    return new Response('OK', { status: 200 })
  } catch (error) {
    console.error('Error in webhook handler:', error)
    return new Response(error.message, { status: 500 })
  }
}) 