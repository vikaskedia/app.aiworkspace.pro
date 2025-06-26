# Goals:
1. AI Workspace.

# Features working:
1. App running from vercel
2. Notification system.
3. Users can upload files to gitea and there is a interface to gitea
4. Task system
5. AI phone

# Future features:
1. Individual users can give feedback by clicking on their profile icon.
2. Users have a forum that they can use to interact with each other.
3. Notification system can realy messages to telegram.
4. oauth from facebook / apple / x 
5. Finding files is always a problem for complex cases so in V2 will make it easy to find the files.
6. Files can be tagged.
7. Give a button called "Create a new motion" when users click this they can choose a set of files that will be used for the motion and give the AI the goal of the motion.

# Tech: 
## Server side:
    1. Supabase.
    2. Python on server side
## Client side:
    1. element-io
    2. Vue
    3. Vite
    4. Drizzle

# How to run on local?
1. in root folder of this repo do npm install
2. copy env.sample to .env and fill in the values
3. npm run dev

# How to run Playwrite on local?
1. In root folder of this repo, use command: npm init playwright@latest
2. Then run npm install, to ensure all dependecies are installed correctly
3. In root folder, if want to run in headless mode, use command: npx playwright test
4. After your test completes, an HTML Reporter will be generated, to view that use command: npx playwright show-report
5. To run your tests with UI Mode, use command: npx playwright test --ui

