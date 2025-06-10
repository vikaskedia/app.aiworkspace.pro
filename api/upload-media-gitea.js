import { createClient } from '@supabase/supabase-js'
import multiparty from 'multiparty'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Gitea configuration (server-side only)
const GITEA_HOST = process.env.GITEA_HOST
const GITEA_TOKEN = process.env.GITEA_TOKEN
const GITEA_USERNAME = process.env.GITEA_USERNAME || 'associateattorney'

// Supported file types for MMS
const SUPPORTED_MIME_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'video/mp4',
  'video/3gpp',
  'text/plain',
  'text/vcard'
]

// File size limits (in bytes)
const MAX_FILE_SIZE = 1024 * 1024 // 1MB max per file
const MAX_TOTAL_SIZE = 1024 * 1024 // 1MB max total
const MAX_FILES = 10 // Max 10 files per message

function validateGiteaConfig() {
  const errors = [];
  
  if (!GITEA_HOST) {
    errors.push('GITEA_HOST is not configured');
  }
  
  if (!GITEA_TOKEN) {
    errors.push('GITEA_TOKEN is not configured');
  }
  
  if (errors.length > 0) {
    throw new Error(`Gitea configuration errors: ${errors.join(', ')}`);
  }
}

function getGiteaHeaders() {
  return {
    'Authorization': `token ${GITEA_TOKEN}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  };
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
    md: 'text/markdown'
  };
  return mimeTypes[ext] || 'application/octet-stream';
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Validate Gitea configuration
    validateGiteaConfig();

    // Parse multipart form data
    const form = new multiparty.Form()
    
    const result = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err)
        else resolve({ fields, files })
      })
    })

    const { fields, files } = result
    const matter_id = fields.matter_id?.[0]
    const git_repo = fields.git_repo?.[0]

    if (!matter_id) {
      return res.status(400).json({ error: 'matter_id is required' })
    }

    if (!git_repo) {
      return res.status(400).json({ error: 'git_repo is required' })
    }

    // Use the git_repo directly from frontend (no database lookup needed)
    const matter = { id: matter_id, git_repo }

    // Validate files
    const fileArray = files.files || []
    if (fileArray.length === 0) {
      return res.status(400).json({ error: 'No files provided' })
    }

    if (fileArray.length > MAX_FILES) {
      return res.status(400).json({ error: `Maximum ${MAX_FILES} files allowed` })
    }

    let totalSize = 0
    const uploadedFiles = []

    for (const file of fileArray) {
      const fileType = getFileType(file.originalFilename)
      
      // Validate file type
      if (!SUPPORTED_MIME_TYPES.includes(fileType)) {
        // Clean up temp files
        fileArray.forEach(f => fs.unlinkSync(f.path))
        return res.status(400).json({ 
          error: `Unsupported file type: ${fileType}. Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}` 
        })
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        // Clean up temp files
        fileArray.forEach(f => fs.unlinkSync(f.path))
        return res.status(400).json({ 
          error: `File ${file.originalFilename} exceeds maximum size of 1MB` 
        })
      }

      totalSize += file.size
    }

    // Validate total size
    if (totalSize > MAX_TOTAL_SIZE) {
      // Clean up temp files
      fileArray.forEach(f => fs.unlinkSync(f.path))
      return res.status(400).json({ 
        error: `Total file size exceeds maximum of 1MB` 
      })
    }

    // Upload files to Gitea
    for (const file of fileArray) {
      const fileExtension = path.extname(file.originalFilename)
      const fileName = `${uuidv4()}${fileExtension}`
      const filePath = `messages/${fileName}`

      try {
        // Read file content and convert to base64
        const fileContent = fs.readFileSync(file.path)
        const base64Content = fileContent.toString('base64')

        // Upload to Gitea repository
        const uploadResponse = await fetch(
          `${GITEA_HOST}/api/v1/repos/${GITEA_USERNAME}/${matter.git_repo}/contents/${filePath}`,
          {
            method: 'POST',
            headers: getGiteaHeaders(),
            body: JSON.stringify({
              message: `Upload message attachment: ${file.originalFilename}`,
              content: base64Content,
              branch: 'main'
            })
          }
        )

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error('Gitea upload error:', errorText)
          throw new Error(`Failed to upload to Gitea: ${uploadResponse.status}`)
        }

        const giteaData = await uploadResponse.json()

        // Create public download URL
        const publicUrl = getAuthenticatedDownloadUrl(giteaData.content.download_url)

        uploadedFiles.push({
          id: uuidv4(),
          filename: file.originalFilename,
          size: file.size,
          mimetype: getFileType(file.originalFilename),
          storage_path: giteaData.content.path,
          public_url: publicUrl,
          git_sha: giteaData.content.sha,
          uploaded_at: new Date().toISOString()
        })

        // Clean up temp file
        fs.unlinkSync(file.path)

      } catch (uploadError) {
        console.error('Error uploading file:', uploadError)
        // Clean up remaining temp files
        fileArray.forEach(f => {
          try {
            fs.unlinkSync(f.path)
          } catch (e) {
            // Ignore cleanup errors
          }
        })
        throw uploadError
      }
    }

    return res.status(200).json({
      success: true,
      files: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully to Gitea`
    })

  } catch (error) {
    console.error('Upload error:', error)
    return res.status(500).json({ 
      error: 'Failed to upload files',
      details: error.message 
    })
  }
} 