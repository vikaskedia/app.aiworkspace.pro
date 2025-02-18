import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );
    return res.status(200).end();
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed' 
    });
  }

  try {
    const { 
      from = "support@trial-zr6ke4nd9kegon12.mlsender.net",//"system@grmtech.com", // Default sender email
      fromName = "Aassociate Attorney AI", // Default sender name
      to, // Required
      subject = "Notification from Associate Attorney AI", // Default subject
      text, // Plain text version
      html // HTML version
    } = req.body;

    // Validate required fields
    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Recipient email (to) is required'
      });
    }

    const mailerSend = new MailerSend({
      apiKey: process.env.MAILERSEND_API_KEY,
    });

    const emailParams = new EmailParams()
      .setFrom(new Sender(from, fromName))
      .setTo([new Recipient(to)])
      .setSubject(subject);

    // Set email content
    if (html) {
      emailParams.setHtml(html);
    }
    if (text) {
      emailParams.setText(text);
    } else if (!html) {
      // If neither HTML nor text is provided, set a default message
      emailParams.setText("No content provided");
    }

    // Send the email
    const response = await mailerSend.email.send(emailParams);

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
      messageId: response.headers['x-message-id']
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: error.message
    });
  }
}