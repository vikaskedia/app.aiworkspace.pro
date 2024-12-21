/* 
Features we want to support:

1. Each matter has View rights and edit rights.

2. Users with edit rights can:
2A. Give View rights or edit rights to other users.
2B. Edit the matter name or description.
2C. Archive the matter.

3. Users with View rights can only view the matter.
*/

CREATE TABLE matter_shares (
  matter_id bigint REFERENCES matters(id) NOT NULL,
  shared_with_user_id uuid REFERENCES auth.users(id) NOT NULL,
  access_type character varying NOT NULL CHECK (access_type IN ('view', 'edit')),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (matter_id, shared_with_user_id),
  CONSTRAINT no_self_sharing CHECK (shared_with_user_id != created_by)
);

COMMENT ON TABLE matter_shares IS 'Tracks matter sharing permissions. View access allows reading only, while edit access allows updating matter details and sharing with others.';

-- Indexes for matter_shares
CREATE INDEX matter_shares_shared_with_user_id_idx ON public.matter_shares USING btree (shared_with_user_id)
CREATE INDEX matter_shares_created_by_idx ON public.matter_shares USING btree (created_by)

-- RLS for matter_shares
ALTER TABLE matter_shares ENABLE ROW LEVEL SECURITY;

-- Policies for matter_shares
CREATE POLICY Users can view matter shares ON matter_shares FOR SELECT USING (((created_by = auth.uid()) OR (shared_with_user_id = auth.uid())));

-- Create policy to allow users to share matters they own
CREATE POLICY "Users can share their own matters" 
ON matter_shares 
FOR INSERT 
WITH CHECK (
    matter_id IN (
        SELECT id 
        FROM matters 
        WHERE created_by = auth.uid()
    )
);

-- Create policy to allow users to view shares they're involved in
CREATE POLICY "Users can view their matter shares" 
ON matter_shares 
FOR SELECT 
USING (
    created_by = auth.uid() OR 
    shared_with_user_id = auth.uid()
);

CREATE POLICY "Users can view shared matters" 
ON matters 
FOR SELECT 
USING (
  id IN (
    SELECT matter_id 
    FROM matter_shares 
    WHERE shared_with_user_id = auth.uid()
  )
);  

-- Add delete policy
CREATE POLICY "Users can delete their matter shares" 
ON matter_shares 
FOR DELETE 
USING (
    created_by = auth.uid() OR 
    matter_id IN (
        SELECT id 
        FROM matters 
        WHERE created_by = auth.uid()
    )
);
