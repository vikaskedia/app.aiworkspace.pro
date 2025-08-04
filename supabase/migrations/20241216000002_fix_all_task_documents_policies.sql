-- Fix all RLS policies for task_documents table
-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "task_documents_external_read" ON task_documents;
DROP POLICY IF EXISTS "task_documents_authenticated_read" ON task_documents;
DROP POLICY IF EXISTS "task_documents_authenticated_write" ON task_documents;

-- Recreate the external read policy
CREATE POLICY "task_documents_external_read" ON task_documents
    FOR SELECT
    USING (
        -- Allow if user has access to the task through external sharing
        EXISTS (
            SELECT 1 FROM task_external_shares tes
            WHERE tes.task_id = task_documents.task_id
            AND tes.expires_at > NOW()
        )
    );

-- Recreate the authenticated read policy
CREATE POLICY "task_documents_authenticated_read" ON task_documents
    FOR SELECT
    TO authenticated
    USING (
        -- Allow if user has access to the task
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN workspaces m ON t.matter_id = m.id
            WHERE t.id = task_documents.task_id
            AND (
                -- Allow if user is the task creator
                t.created_by = auth.uid()
                OR
                -- Allow if user is the matter creator
                m.created_by = auth.uid()
                OR
                -- Allow if user has explicit access to the matter
                EXISTS (
                    SELECT 1 FROM workspace_access ma
                    WHERE ma.matter_id = m.id
                    AND ma.shared_with_user_id = auth.uid()
                )
            )
        )
    );

-- Recreate the authenticated write policy
CREATE POLICY "task_documents_authenticated_write" ON task_documents
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN workspaces m ON t.matter_id = m.id
            WHERE t.id = task_documents.task_id
            AND (
                -- Allow if user is the task creator
                t.created_by = auth.uid()
                OR
                -- Allow if user is the matter creator
                m.created_by = auth.uid()
                OR
                -- Allow if user has explicit access to the matter
                EXISTS (
                    SELECT 1 FROM workspace_access ma
                    WHERE ma.matter_id = m.id
                    AND ma.shared_with_user_id = auth.uid()
                )
            )
        )
    ); 

-- Allow authenticated users to upload files to task-files bucket
CREATE POLICY "Allow authenticated upload to task-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-files'
);

-- Allow authenticated users to read files from task-files bucket
CREATE POLICY "Allow authenticated read from task-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-files'
);

-- Allow authenticated users to update files in task-files bucket
CREATE POLICY "Allow authenticated update to task-files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'task-files'
);

-- Allow authenticated users to delete files from task-files bucket
CREATE POLICY "Allow authenticated delete from task-files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-files'
); 