# E-Sign Feature for Task Management

## Overview

The E-Sign feature allows internal users to upload PDF documents that require signatures and share them with external users through the task sharing system. External users can then view and electronically sign these documents using a built-in signature pad.

## Features

- **PDF Document Upload**: Internal users can upload PDF documents requiring signatures
- **In-PDF Digital Signatures**: External users can sign directly inside the PDF document by placing signature areas
- **Multi-Step Signing Process**: Guided workflow for document review, signature placement, and signing
- **PDF Manipulation**: Signatures are embedded directly into the PDF using PDF-lib for legal compliance
- **Signature Tracking**: Complete audit trail of who signed when and where with signature positioning
- **Legal Compliance**: Signatures include IP address, timestamp, and user agent for legal validity
- **Status Tracking**: Real-time status updates (pending, signed, rejected)
- **Enhanced Viewing**: Internal users can see signed PDFs with embedded signatures and detailed signature information

## How It Works

### For Internal Users (Task Owners)

1. **Access E-Sign Tab**: Navigate to any task and click the "E-sign" tab
2. **Upload PDF**: Click "Select PDF File" and choose a document that needs signatures
3. **Share Task**: Use the external sharing feature to generate a shareable link
4. **Monitor Status**: View signature status and download signed documents

### For External Users (Signers)

1. **Access Shared Task**: Use the shared link provided by the task owner
2. **Authenticate**: Sign in using Gmail, GitHub, or Twitter authentication
3. **View E-Sign Tab**: Click the "E-sign" tab to see documents requiring signatures
4. **Review Document**: Step 1 - View and review the PDF document with zoom and navigation controls
5. **Place Signature Areas**: Step 2 - Click on the document where signatures are needed to place signature boxes
6. **Sign Document**: Step 3 - Draw signatures in the signature areas using the built-in signature pad
7. **Submit**: Complete the signing process with signer information and legal acknowledgment
8. **Receive Confirmation**: Get confirmation that the signed PDF has been saved with embedded signatures

## Database Schema

### task_documents Table
```sql
- id: Unique document identifier
- task_id: Associated task ID
- name: Document display name
- original_filename: Original file name
- file_path: Storage path for the document
- download_url: Public URL for document access
- size: File size in bytes
- mime_type: Document MIME type
- requires_signature: Boolean flag for signature requirement
- signature_status: Current status (pending, signed, rejected)
- signed_by: Email of the person who signed
- signed_at: Timestamp of signature
- created_at/updated_at: Record timestamps
- created_by_user_id: ID of user who uploaded the document
```

### task_signatures Table
```sql
- id: Unique signature identifier
- task_id: Associated task ID
- document_id: Associated document ID
- user_email: Email of the signer
- signature_image: Base64 encoded signature image
- signature_date: Timestamp of signature
- ip_address: IP address of signer
- user_agent: Browser/device information
- status: Signature status (completed, voided)
- created_at: Record timestamp
```

## API Endpoints

### Document Management
- `GET /api/esign-documents?task_id={id}` - Get documents for a task
- `POST /api/esign-documents` - Upload new document
- `PUT /api/esign-documents?document_id={id}` - Update document
- `DELETE /api/esign-documents?document_id={id}` - Delete document

### Signature Management
- `GET /api/esign-signatures?document_id={id}` - Get signatures for a document
- `POST /api/esign-signatures` - Submit new signature
- `PUT /api/esign-signatures?signature_id={id}` - Update signature status

## Components

### Internal View Components
- **DetailedTaskViewCt.vue**: Main task view with enhanced E-sign tab and signature display
- **E-sign Tab**: Upload interface, document management, and enhanced signature viewing
- **Enhanced Signature Display**: Shows embedded signatures with signer details and timestamps

### External View Components
- **ExternalTaskView.vue**: External user task view with E-sign tab
- **PdfSignatureModal.vue**: Complete in-PDF signing modal with multi-step workflow
  - PDF.js rendering for accurate document display
  - Interactive signature placement with click-to-place functionality
  - Built-in signature pad with touch and mouse support
  - Real-time signature preview and positioning
  - PDF-lib integration for embedding signatures directly into the PDF

### Technical Components
- **PDF.js Integration**: Client-side PDF rendering and manipulation
- **PDF-lib Integration**: Server-side PDF modification and signature embedding
- **Canvas API**: Signature drawing and PDF overlay functionality

## Security Features

- **Authentication Required**: External users must authenticate before accessing
- **Row Level Security (RLS)**: Database policies ensure proper access control
- **Audit Trail**: Complete tracking of signatures with IP and timestamp
- **File Validation**: Only PDF files are accepted for signing
- **Legal Disclaimer**: Users acknowledge legal binding nature of signatures

## File Storage

Documents are stored using Supabase Storage in the `task-files` bucket:
- Path structure: `task_documents/{task_id}/{timestamp}.{extension}`
- Public URLs generated for document access
- Automatic cleanup when documents are deleted

## Legal Compliance

The e-signature implementation includes:
- **Digital timestamp** for when signature was applied
- **IP address** tracking for location verification
- **User agent** information for device/browser identification
- **Email verification** to confirm signer identity
- **Legal disclaimer** acknowledgment before signing

## Usage Examples

### Internal User Workflow
```javascript
// Upload PDF document
const formData = new FormData();
formData.append('file', pdfFile);
await uploadPdfDocument(formData);

// Share task externally
const shareLink = await generateExternalShareLink(taskId);
```

### External User Workflow
```javascript
// Load documents for signing
const documents = await loadEsignDocuments(taskId);

// Submit signature
const signatureData = {
  task_id: taskId,
  document_id: documentId,
  user_email: userEmail,
  signature_image: base64SignatureImage
};
await submitSignature(signatureData);
```

## Implemented Features

- ✅ **In-PDF Signature Placement**: Users can click directly on the PDF to place signature areas
- ✅ **Multi-Step Signing Process**: Guided workflow with document review, placement, and signing
- ✅ **PDF Manipulation**: Direct embedding of signatures into PDFs using PDF-lib
- ✅ **Enhanced Signature Display**: Rich signature information display for internal users
- ✅ **Mobile-Responsive Design**: Optimized for both desktop and mobile devices

## Future Enhancements

- **Pre-defined signature fields** with document templates
- **Advanced PDF annotation** capabilities (text, highlights, etc.)
- **Signature templates** for common document types and repeated signers
- **Bulk signing** for multiple documents at once
- **Integration with DocuSign** or similar third-party services
- **Certificate-based signatures** for enhanced security and legal compliance
- **Signature validation** and verification tools
- **Document versioning** and change tracking
- **API endpoints** for external integrations

## Browser Compatibility

- **Desktop**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile**: iOS Safari, Android Chrome
- **Touch Support**: Optimized for touchscreen signature input
- **Canvas API**: Required for signature pad functionality

## Troubleshooting

### Common Issues
1. **PDF not loading**: Check file size (max 50MB) and ensure valid PDF format
2. **Signature not saving**: Verify network connection and try refreshing
3. **Access denied**: Confirm user has proper authentication and task access
4. **Mobile signing issues**: Use touch gestures, avoid palm rejection

### Support
For technical issues or feature requests, contact the development team or create an issue in the project repository. 