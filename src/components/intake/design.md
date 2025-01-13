# Legal Matter Intake System Design

## Overview
The intake system uses AI to conduct an interactive interview with users to gather information about their legal matter and create a structured plan of action.

## Tech implementation

- accessed from route /intake
- user has to be logged in
- once user is logged in there are 3 possibilites:
  -- 0 matter ->            system detects if there is no matter then it automatically sends the user to /intake.
  -- 1 matter ->            if there is a single matter then the user is sent to https://app.associateattorney.ai/matter/40/dashboard
  -- more than 1 matter ->  if there is more than one matter the user is sent to https://app.associateattorney.ai/all-matters/dashboard
- Intake can also be accessed by clicking on profile icon and then clicking on Intake.


## System Components

### 1. AI Interview System
- Uses a conversational AI model to dynamically generate and ask relevant questions
- Core question areas:
    -- Events
    -- Documents
    -- Goals
    

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
Goals with priority and below each goal:
    -- Tasks with priority

Once the user agrees on the plan below the matter the following are created:
1. Events
2. Files
3. Goals  
4. Tasks 

During the intake questions there is a button to access "Shared board" in the shared board the user can see the:
1. Events
2. Files
3. Goals  
4. Tasks 
5. Possible Outcome 
That has been generated during the intake interview.

As the user answers the questions the shared board is updated with the new information.

The user can go to shared board and edit the previous answers.
