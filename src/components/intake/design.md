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
intakeInterviewID -> Since one user can have multiple intake interviews, we need to store the interview ID
matterID -> While the intake is happening the user may get some files. We need to store the files under the matterID
jsonOfInterviewQnA -> Since the questions are dynamic we need to store the questions and answers in a json format
planAcceptedByUserJson -> The plan that the user accepts is stored in a json format. Since it is dynamic we cannot have fields for the plan.
createdAt
updatedAt

What does the plan consist of?
1. Goals with priority
2. Tasks with priority

Once the user agrees on the plan below the matter the following are created:
1. Goals  
2. Tasks 

During the interview the following below the matter is created:
1. Files
2. Events for the timneline

