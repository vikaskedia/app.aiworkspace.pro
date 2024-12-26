import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
}

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

    // Verify request method
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    // Get telegram_id from request body
    const { telegram_id } = await req.json()

    if (!telegram_id) {
      throw new Error('Telegram ID is required')
    }

    // Try to send a test message to the user
    const message = 'This is a verification message from Legal Studio. If you receive this, your Telegram integration is working correctly!'
    
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: telegram_id,
          text: message,
        }),
      }
    )

    const result: TelegramResponse = await response.json()

    if (!result.ok) {
      throw new Error(result.description || 'Failed to verify Telegram ID')
    }

    return new Response(
      JSON.stringify({
        verified: true,
        message: 'Telegram ID verified successfully'
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({
        verified: false,
        error: error.message
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        status: 400,
      }
    )
  }
}) 