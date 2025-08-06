import { createClient } from '@supabase/supabase-js'
import multer from 'multer'
import fs from 'fs'
import path from 'path'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Gitea configuration
const GITEA_HOST = process.env.VITE_GITEA_HOST
const GITEA_TOKEN = process.env.VITE_GITEA_TOKEN
const GITEA_USERNAME = 'associateattorney'

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: '/tmp/uploads/',
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
  })
})

// Helper function to get authenticated download URL
function getAuthenticatedDownloadUrl(downloadUrl) {
  if (!downloadUrl) return '';
  
  try {
    const url = new URL(downloadUrl);
    url.searchParams.set('token', GITEA_TOKEN);
    return url.toString();
  } catch (error) {
    console.error('Error creating authenticated URL:', error);
    return downloadUrl;
  }
}

// Export the handler function
export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Use multer middleware
  upload.array('files', 10)(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: 'File upload error', details: err.message });
    }

    try {
      console.log('🔍 MMS Upload API called');
      
      const files = req.files
      const { workspace_id, git_repo } = req.body

      if (!workspace_id || !git_repo) {
        return res.status(400).json({ error: 'workspace_id and git_repo are required' })
      }

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' })
      }

      console.log(`📁 Processing ${files.length} files for workspace ${workspace_id}`);

      const uploadedFiles = [];

      for (const file of files) {
        try {
          // Add timestamp to prevent conflicts
          const timestamp = Date.now();
          const fileExtension = path.extname(file.originalname);
          const baseName = path.basename(file.originalname, fileExtension);
          const uniqueName = `${baseName}_${timestamp}${fileExtension}`;
          const filePath = `messages/${uniqueName}`;

          console.log(`⬆️ Uploading ${file.originalname} as ${uniqueName}`);

          // Read file and convert to base64 for Gitea
          const fileContent = fs.readFileSync(file.path, { encoding: 'base64' });

          // Upload to Gitea
          const response = await fetch(
            `${GITEA_HOST}/api/v1/repos/${GITEA_USERNAME}/${git_repo}/contents/${filePath}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `token ${GITEA_TOKEN}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
              },
              body: JSON.stringify({
                message: `Upload message attachment: ${file.originalname}`,
                content: fileContent,
                branch: 'main'
              })
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Gitea upload error:', errorText);
            throw new Error(`Failed to upload to Gitea: ${response.status}`);
          }

          const giteaData = await response.json();
          const publicUrl = getAuthenticatedDownloadUrl(giteaData.content.download_url);

          const fileData = {
            id: giteaData.content.sha,
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            storage_path: giteaData.content.path,
            public_url: publicUrl,
            git_sha: giteaData.content.sha,
            uploaded_at: new Date().toISOString()
          };

          uploadedFiles.push(fileData);
          console.log(`✅ Uploaded: ${file.originalname}`);

          // Clean up temporary file
          fs.unlinkSync(file.path);

        } catch (uploadError) {
          console.error(`❌ Failed to upload ${file.originalname}:`, uploadError);
          // Clean up temporary file even if upload fails
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
          // Continue with other files
        }
      }

      return res.status(200).json({
        success: true,
        files: uploadedFiles,
        message: `${uploadedFiles.length} file(s) uploaded successfully`
      });

    } catch (error) {
      console.error('❌ Upload error:', error);
      return res.status(500).json({ 
        error: 'Failed to upload files',
        details: error.message 
      });
    }
  });
} 