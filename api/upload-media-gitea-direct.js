import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Gitea configuration (using VITE_ variables like FilesCt.vue)
const GITEA_HOST = process.env.VITE_GITEA_HOST
const GITEA_TOKEN = process.env.VITE_GITEA_TOKEN
const GITEA_USERNAME = 'associateattorney'

function getGiteaHeaders() {
  return {
    'Authorization': `token ${GITEA_TOKEN}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };
}

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

function getFileType(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    png: 'image/png',  
    jpg: 'image/jpeg', 
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    mp4: 'video/mp4',
    '3gp': 'video/3gpp',
    '3gpp': 'video/3gpp',
    vcf: 'text/vcard',
    md: 'text/markdown'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('🔍 MMS Upload API called');
    
    const { files, matter_id, git_repo } = req.body;

    if (!matter_id || !git_repo) {
      return res.status(400).json({ error: 'matter_id and git_repo are required' })
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' })
    }

    console.log(`📁 Processing ${files.length} files for matter ${matter_id}`);

    const uploadedFiles = [];

    for (const file of files) {
      const { name, content, size } = file;
      
      if (!name || !content) {
        console.error('Invalid file data:', { name: !!name, content: !!content });
        continue;
      }

      try {
        // Add timestamp to prevent conflicts (MMS files often have same names)
        const timestamp = Date.now();
        const fileExtension = name.includes('.') ? '.' + name.split('.').pop() : '';
        const baseName = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
        const uniqueName = `${baseName}_${timestamp}${fileExtension}`;
        const filePath = `messages/${uniqueName}`;

        console.log(`⬆️ Uploading ${name} as ${uniqueName}`);

        // Upload to Gitea (same approach as FilesCt.vue)
        const response = await fetch(
          `${GITEA_HOST}/api/v1/repos/${GITEA_USERNAME}/${git_repo}/contents/${filePath}`,
          {
            method: 'POST',
            headers: getGiteaHeaders(),
            body: JSON.stringify({
              message: `Upload message attachment: ${name}`,
              content: content, // Base64 content from frontend
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
          id: giteaData.content.sha, // Use git SHA as ID (like FilesCt.vue)
          filename: name,
          size: size || 0,
          mimetype: getFileType(name),
          storage_path: giteaData.content.path,
          public_url: publicUrl,
          git_sha: giteaData.content.sha,
          uploaded_at: new Date().toISOString()
        };

        uploadedFiles.push(fileData);
        console.log(`✅ Uploaded: ${name}`);

      } catch (uploadError) {
        console.error(`❌ Failed to upload ${name}:`, uploadError);
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
} 