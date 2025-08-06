-- Create task_documents table for storing documents that need to be signed
CREATE TABLE IF NOT EXISTS task_documents (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_path TEXT,
    download_url TEXT,
    size BIGINT,
    mime_type VARCHAR(100),
    requires_signature BOOLEAN DEFAULT false,
    signature_status VARCHAR(50) DEFAULT 'pending', -- pending, signed, rejected
    signed_by VARCHAR(255),
    signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by_user_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create task_signatures table for storing signature data
CREATE TABLE IF NOT EXISTS task_signatures (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL,
    document_id BIGINT NOT NULL REFERENCES task_documents(id) ON DELETE CASCADE,
    user_email VARCHAR(255) NOT NULL,
    signature_image TEXT NOT NULL, -- Base64 encoded signature image
    signature_date TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'completed', -- completed, voided
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_task_documents_task_id ON task_documents(task_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_signature_status ON task_documents(signature_status);
CREATE INDEX IF NOT EXISTS idx_task_documents_requires_signature ON task_documents(requires_signature);

CREATE INDEX IF NOT EXISTS idx_task_signatures_task_id ON task_signatures(task_id);
CREATE INDEX IF NOT EXISTS idx_task_signatures_document_id ON task_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_task_signatures_user_email ON task_signatures(user_email);
CREATE INDEX IF NOT EXISTS idx_task_signatures_created_at ON task_signatures(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE task_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_signatures ENABLE ROW LEVEL SECURITY;

-- Policy for task_documents: Allow read access for external users with valid share tokens
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

-- Policy for task_documents: Allow authenticated users to read documents for their accessible tasks
CREATE POLICY "task_documents_authenticated_read" ON task_documents
    FOR SELECT
    TO authenticated
    USING (
        -- Allow if user has access to the task
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN workspaces m ON t.workspace_id = m.id
            WHERE t.id = task_documents.task_id
            AND (
                -- Allow if user is the task creator
                t.created_by = auth.uid()
                OR
                -- Allow if user is the workspace creator
                m.created_by = auth.uid()
                OR
                -- Allow if user has explicit access to the workspace
                EXISTS (
                    SELECT 1 FROM workspace_access ma
                    WHERE ma.workspace_id = m.id
                    AND ma.shared_with_user_id = auth.uid()
                )
            )
        )
    );

-- Policy for task_documents: Allow authenticated users to insert/update documents
CREATE POLICY "task_documents_authenticated_write" ON task_documents
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN workspaces m ON t.workspace_id = m.id
            WHERE t.id = task_documents.task_id
            AND (
                -- Allow if user is the task creator
                t.created_by = auth.uid()
                OR
                -- Allow if user is the workspace creator
                m.created_by = auth.uid()
                OR
                -- Allow if user has explicit access to the workspace
                EXISTS (
                    SELECT 1 FROM workspace_access ma
                    WHERE ma.workspace_id = m.id
                    AND ma.shared_with_user_id = auth.uid()
                )
            )
        )
    );

-- Policy for task_signatures: Allow external users to insert signatures
CREATE POLICY "task_signatures_external_insert" ON task_signatures
    FOR INSERT
    WITH CHECK (
        -- Allow if user has access to the task through external sharing
        EXISTS (
            SELECT 1 FROM task_external_shares tes
            WHERE tes.task_id = task_signatures.task_id
            AND tes.expires_at > NOW()
        )
    );

-- Policy for task_signatures: Allow reading signatures for accessible tasks
CREATE POLICY "task_signatures_read" ON task_signatures
    FOR SELECT
    USING (
        -- Allow if user has access to the task (either authenticated or external)
        EXISTS (
            SELECT 1 FROM task_external_shares tes
            WHERE tes.task_id = task_signatures.task_id
            AND tes.expires_at > NOW()
        )
        OR
        (
            auth.uid() IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM tasks t
                JOIN workspaces m ON t.workspace_id = m.id
                JOIN workspace_access ma ON m.id = ma.workspace_id
                WHERE t.id = task_signatures.task_id
                AND ma.shared_with_user_id = auth.uid()
            )
        )
    );

-- Policy for authenticated users to manage signatures
CREATE POLICY "task_signatures_authenticated_all" ON task_signatures
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN workspaces m ON t.workspace_id = m.id
            JOIN workspace_access ma ON m.id = ma.workspace_id
            WHERE t.id = task_signatures.task_id
            AND ma.shared_with_user_id = auth.uid()
        )
    );

-- Add updated_at trigger for task_documents
CREATE OR REPLACE FUNCTION update_task_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_documents_updated_at_trigger
    BEFORE UPDATE ON task_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_task_documents_updated_at();

-- Insert some sample data for testing (optional)
-- This can be removed in production
INSERT INTO task_documents (task_id, name, original_filename, download_url, size, mime_type, requires_signature, signature_status, created_at)
VALUES 
    (1, 'Sample Contract.pdf', 'contract.pdf', '/sample-contract.pdf', 153600, 'application/pdf', true, 'pending', NOW())
ON CONFLICT DO NOTHING; 