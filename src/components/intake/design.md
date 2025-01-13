# Legal Matter Intake System Design

## Overview
The intake system uses AI to conduct an interactive interview with users to gather information about their legal matter and create a structured plan of action.

## System Components

### 1. AI Interview System
- Uses a conversational AI model to dynamically generate and ask relevant questions
- Questions adapt based on user responses
- Core question areas:
  - Legal matter details and background
  - Relevant documents in possession
  - Fact pattern collection
  - Timeline of events
  - Desired outcomes

### 2. Document Collection
- Allows users to upload relevant legal documents during interview
- AI analyzes documents to extract key information
- Documents are stored securely and linked to the matter

### 3. Database Schema (Supabase)

#### intake-interviews Table
userID
intakeInterviewID
matterID
jsonOfInterviewQnA
planAcceptedByUserJson
createdAt
updatedAt

