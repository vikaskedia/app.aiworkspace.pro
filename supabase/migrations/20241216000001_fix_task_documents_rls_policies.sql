-- Fix RLS policies for task_documents table
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "task_documents_authenticated_read" ON task_documents;
DROP POLICY IF EXISTS "task_documents_authenticated_write" ON task_documents;

-- Recreate the read policy to allow task creators and matter creators
CREATE POLICY "task_documents_authenticated_read" ON task_documents
    FOR SELECT
    TO authenticated
    USING (
        -- Allow if user has access to the task
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN matters m ON t.matter_id = m.id
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

-- Recreate the write policy to allow task creators and matter creators
CREATE POLICY "task_documents_authenticated_write" ON task_documents
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN matters m ON t.matter_id = m.id
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