Our Associate attorney AI system has matters and below each matter there are:
1. Events - input from the user
2. Files - input from the user
3. Goals - output from the AI
4. Tasks - output from the AI

# Legal Matter Initial consultation Design

## Overview
The initial consultation system uses AI to conduct an interactive interview with users to gather information (i.e. Events and files) about their legal matter and create a structured plan of action (i.e. Goals and Tasks).

## Tech implementation

- accessed from route /initial-consultation
- user has to be logged in
- once user is logged in there are 3 possibilites:
  -- 0 matter ->            system detects if there is no matter then it automatically sends the user to /initial-consultation
  -- 1 matter ->            if there is a single matter then the user is sent to https://app.associateattorney.ai/matter/40/dashboard
  -- more than 1 matter ->  if there is more than one matter the user is sent to https://app.associateattorney.ai/all-matters/dashboard
- initial-consultation can also be accessed by clicking on profile icon and then clicking on Initial consultation.


## System Components

### 1. AI Interview System
- Uses a conversational AI model to dynamically generate and ask relevant questions to get Events and Files
    
### 3. Database Schema (Supabase)

#### initial-consultation Table
userID
initialConsultationID -> Since one user can have multiple initial consultations, we need to store the consultation ID
matterID -> While the initial consultation is happening the user may get some files. We need to store the files under the matterID
jsonOfInterviewQnA -> Since the questions are dynamic we need to store the questions and answers in a json format
planAcceptedByUserJson -> The plan that the user accepts is stored in a json format. Since it is dynamic we cannot have fields for the plan.
createdAt
updatedAt

What is the output of the intial consultation?
Goals with priority and below each goal:
    -- Tasks with priority

Once the user agrees on the plan below the matter the following are created:
1. Events
2. Files
3. Goals  
4. Tasks 

During the initial consultation there is a button to access "Shared notepad" in the shared notepad the user can see the:
1. Events
2. Files
3. Goals  
4. Tasks 
5. Possible Outcome 
That has been generated during the initial consultation by the AI. This is the notepad of the human attorney that we are sharing live with the user.

As the user answers the questions the shared notepad is updated with the new information.

We want the user to be able to edit the previous answers and as the answers change see the change in the Goals, Tasks and Laws that protect the user along with the protection that they give.

Previous answers can be edited by going to the previous slide.