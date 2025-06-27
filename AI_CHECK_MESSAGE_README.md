# AI Messaging Features

## Overview
Two AI-powered features help users with text messaging: AI Message Check and AI Draft Message (AI-DM). Both use ChatGPT to enhance communication quality and efficiency.

## Features

### AI Message Check (Magic Wand Icon)
#### 1. Smart AI Check Button
- Appears automatically when user types a message in the textarea
- Uses a magic wand icon (MagicStick) for easy recognition
- Available in both main message input and new message dialog

#### 2. AI Analysis
The AI checks messages for:
- **Grammar** errors (red tags)
- **Spelling** mistakes (yellow tags)
- **Clarity** issues (blue tags)
- **Tone** improvements (green tags)

#### 3. User-Friendly Interface
- Shows original message for comparison
- Lists specific issues found with explanations
- Provides an improved version that users can edit
- Users can accept improvements or make their own modifications

### AI Draft Message - AI-DM (Robot Icon)
#### 1. Conversation-Aware Drafting
- Appears when there's an active conversation with message history
- Uses a robot icon for easy recognition
- Analyzes conversation context to suggest appropriate replies

#### 2. Intelligent Reply Suggestions
The AI provides:
- **Contextual replies** based on conversation history
- **Tone matching** (professional, friendly, formal, casual)
- **Alternative options** for different response styles
- **Reasoning explanation** for the suggested response

#### 3. Flexible Usage Options
- **Use This Message**: Adds the draft to input for further editing
- **Use & Send Now**: Immediately sends the AI-drafted message
- **Alternative Selection**: Choose from multiple suggested replies
- **Edit Before Use**: Modify the AI suggestion before applying

## How to Use

### AI Message Check
1. **Type a message** in the message input area
2. **Click the AI check button** (magic wand icon) that appears
3. **Review the AI analysis** in the popup dialog
4. **Edit the improved message** if needed
5. **Click "Use Improved Message"** to apply changes

### AI Draft Message (AI-DM)
1. **Open a conversation** with message history
2. **Click the robot icon** in the input actions area
3. **Wait for AI to analyze** the conversation and draft a reply
4. **Review the suggested message** and AI reasoning
5. **Choose an option**:
   - Edit the suggestion and click "Use This Message"
   - Click "Use & Send Now" to send immediately
   - Select an alternative from the suggestions

## Technical Implementation

### Backend (Serverless Functions)
#### AI Message Check
- **File**: `api/ai-check-message.js`
- **API**: OpenAI GPT-4o-mini
- **Method**: POST to `/api/ai-check-message`
- **Environment Variable Required**: `OPENAI_API_KEY`

#### AI Draft Message
- **File**: `api/ai-draft-message.js`
- **API**: OpenAI GPT-4o-mini
- **Method**: POST to `/api/ai-draft-message`
- **Environment Variable Required**: `OPENAI_API_KEY`

### Frontend (Vue Component)
- **Component**: `AiPhoneCt.vue`
- **AI Check Methods**:
  - `checkMessageWithAI()` - Main message input
  - `checkNewMessageWithAI()` - New message dialog
  - `useImprovedMessage()` - Apply AI suggestions
  - `closeAICheckDialog()` - Clean up dialog state
- **AI Draft Methods**:
  - `draftMessageWithAI()` - Generate conversation-based reply
  - `useDraftMessage()` - Apply draft to input
  - `useDraftAndSend()` - Apply and send immediately
  - `selectAlternative()` - Choose alternative suggestion
  - `closeAIDraftDialog()` - Clean up draft dialog state

### API Request Formats
#### AI Check Message
```json
{
  "message": "The text message to check"
}
```

#### AI Draft Message
```json
{
  "conversation": [
    {
      "direction": "inbound|outbound",
      "text": "message content",
      "timestamp": "ISO date"
    }
  ],
  "contactName": "Contact Name",
  "context": "Professional legal/business communication"
}
```

### API Response Formats
#### AI Check Message
```json
{
  "success": true,
  "originalMessage": "original text",
  "hasIssues": boolean,
  "suggestions": [
    {
      "type": "grammar|spelling|clarity|tone",
      "issue": "description of the issue",
      "suggestion": "suggested improvement"
    }
  ],
  "improvedMessage": "corrected version",
  "explanation": "brief explanation of changes"
}
```

#### AI Draft Message
```json
{
  "success": true,
  "conversationLength": 5,
  "suggestedMessage": "AI-generated reply",
  "reasoning": "explanation for the suggestion",
  "tone": "professional|friendly|formal|casual",
  "alternatives": [
    "alternative reply option 1",
    "alternative reply option 2"
  ]
}
```

## Error Handling
- Network errors are caught and displayed to users
- Invalid API responses are handled gracefully
- Fallback responses provided when AI parsing fails

## Styling
- Responsive design for mobile and desktop
- Color-coded suggestion types for easy identification
- Loading animations and states
- Accessible UI with proper contrast and spacing

## Environment Setup
1. Add `OPENAI_API_KEY` to your environment variables
2. Ensure the serverless function is deployed to `/api/ai-check-message`
3. The feature will automatically be available in the message interface

## Browser Compatibility
- Works with all modern browsers
- Requires JavaScript enabled
- Responsive design for mobile devices 