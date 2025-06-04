import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Gmail IMAP configuration
const imapConfig = {
    user: 'catchall@westviewlegal.com',
    password: process.env.GMAIL_APP_PASSWORD,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
};

// Function to sanitize filename
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '');
}

// Function to process attachments
async function processAttachments(attachments) {
    const processedAttachments = [];
    
    for (const attachment of attachments) {
        try {
            const timestamp = Date.now();
            const sanitizedFilename = sanitizeFilename(attachment.filename);
            const filename = `${timestamp}-${sanitizedFilename}`;
            const filePath = `attachments/${filename}`;
            
            const { error: uploadError } = await supabase.storage
                .from('email-attachments')
                .upload(filePath, attachment.content, {
                    contentType: attachment.contentType,
                    upsert: false
                });
                
            if (uploadError) {
                console.error('Error uploading attachment:', uploadError);
                continue;
            }
            
            const { data: { publicUrl } } = supabase.storage
                .from('email-attachments')
                .getPublicUrl(filePath);
                
            processedAttachments.push({
                filename: attachment.filename,
                storagePath: filePath,
                contentType: attachment.contentType,
                size: attachment.size,
                url: publicUrl
            });
        } catch (error) {
            console.error('Error processing attachment:', error);
        }
    }
    
    return processedAttachments;
}

// Main serverless function
export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Allow requests from Vercel's cron system
    const isVercelCron = req.headers['x-vercel-cron'] === '1';
    
    // Verify the request is authorized
    const authHeader = req.headers.authorization;
    /* if (!isVercelCron && (!authHeader || authHeader !== `Bearer ${process.env.API_SECRET_KEY}`)) {
        return res.status(401).json({ error: 'Unauthorized' });
    } */

    try {
        const imap = new Imap(imapConfig);
        
        // Create a promise to handle the IMAP connection
        const processEmails = new Promise((resolve, reject) => {
            imap.once('ready', () => {
                imap.openBox('INBOX', false, (err, box) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    imap.search(['UNSEEN'], (err, results) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        if (results.length === 0) {
                            resolve({ message: 'No new emails found' });
                            imap.end();
                            return;
                        }

                        const fetch = imap.fetch(results, {
                            bodies: '',
                            struct: true,
                            markSeen: false
                        });

                        let processedCount = 0;
                        let processedEmails = [];

                        fetch.on('message', (msg) => {
                            let uid;
                            msg.on('attributes', (attrs) => {
                                uid = attrs.uid;
                            });

                            msg.on('body', (stream) => {
                                simpleParser(stream, async (err, parsed) => {
                                    if (err) {
                                        reject(err);
                                        return;
                                    }

                                    const processedAttachments = await processAttachments(parsed.attachments || []);

                                    const emailData = {
                                        from_address: parsed.from?.text || '',
                                        to_address: parsed.to?.text || '',
                                        cc: parsed.cc?.text || '',
                                        bcc: parsed.bcc?.text || '',
                                        subject: parsed.subject || '',
                                        text_content: parsed.text || '',
                                        html_content: parsed.html || '',
                                        received_date: parsed.date || new Date(),
                                        created_at: new Date(),
                                        processed: false,
                                        attachments: processedAttachments
                                    };

                                    try {
                                        const { data, error } = await supabase
                                            .from('emails')
                                            .insert([emailData]);

                                        if (error) {
                                            console.error('Error storing email:', error);
                                        } else {
                                            processedEmails.push(data);
                                            
                                            imap.addFlags(uid, '\\Seen', (err) => {
                                                if (err) {
                                                    console.error(`Error marking email UID ${uid} as read:`, err);
                                                }
                                                processedCount++;
                                                
                                                if (processedCount === results.length) {
                                                    resolve({
                                                        message: 'All emails processed successfully',
                                                        processedEmails
                                                    });
                                                    imap.end();
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        reject(error);
                                    }
                                });
                            });
                        });

                        fetch.once('error', (err) => {
                            reject(err);
                        });
                    });
                });
            });

            imap.once('error', (err) => {
                reject(err);
            });

            imap.connect();
        });

        const result = await processEmails;
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error processing emails:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
} 