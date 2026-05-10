import { NextResponse } from 'next/server';
import { ingestEventFromText } from '@/services/event-ingestion';

// Allow POST requests from Telegram Webhooks
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Determine the text content of the message
    // It could be a standard message or a channel post
    const message = body.message || body.channel_post;
    
    if (!message || !message.text) {
      // Not a text message, skip
      return NextResponse.json({ status: 'ignored', reason: 'no text provided' });
    }

    const textToAnalyze = message.text;
    console.log(`[Telegram Webhook] Received message. Processing...`);

    // Hand the text over to the AI, which will:
    // 1. Analyze if it's an ad or an event
    // 2. Extract structured data if valid
    // 3. Skip duplicates
    // 4. Insert into Supabase
    const eventId = await ingestEventFromText(textToAnalyze);

    if (eventId) {
      console.log(`[Telegram Webhook] Success! Inserted event ID: ${eventId}`);
      return NextResponse.json({ status: 'success', eventId });
    } else {
      // Event was either an ad or a duplicate
      return NextResponse.json({ status: 'ignored', reason: 'ai_filtered_or_duplicate' });
    }

  } catch (error: any) {
    console.error(`[Telegram Webhook] Error processing message:`, error);
    return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
  }
}
