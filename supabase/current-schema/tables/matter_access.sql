CREATE TABLE matter_access (
  matter_id bigint REFERENCES matters(id) NOT NULL,
  shared_with_user_id uuid REFERENCES auth.users(id) NOT NULL,
  access_type character varying NOT NULL CHECK (access_type IN ('view', 'edit')),
  granted_by_uuid uuid REFERENCES auth.users(id) NOT NULL,
  granted_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (matter_id, shared_with_user_id),
  CONSTRAINT no_self_sharing CHECK (
        (shared_with_user_id != granted_by_uuid) OR 
        (shared_with_user_id = granted_by_uuid AND access_type = 'edit')
    )
);

COMMENT ON TABLE matter_access IS 'Manages access control for matters. 
1. Each matter has View rights and edit rights.

2. Users with edit rights can:
2A. Give View rights or edit rights to other users.
2B. Edit the matter name or description.
2C. Soft delete the matter.
2D. Add, Edit or Soft delete -> goals, tasks, events, and files.

3. Users with View rights can only view:
3A. The matter name and description.
3B. Goals (see goals.sql)
3C. Tasks (see tasks.sql)
3D. Events (see events.sql)
3E. Files stored in gitea repository';

-- Indexes for matter_access
CREATE INDEX matter_access_shared_with_user_id_idx ON public.matter_access USING btree (shared_with_user_id);
CREATE INDEX matter_access_granted_by_uuid_idx ON public.matter_access USING btree (granted_by_uuid);

-- RLS for matter_access
ALTER TABLE matter_access ENABLE ROW LEVEL SECURITY;

-- Policies for matter_access
CREATE POLICY "Users can view matter access" ON matter_access
FOR SELECT USING (
    shared_with_user_id = auth.uid()
);

CREATE POLICY "Users with edit access can create shares" ON matter_access
FOR INSERT WITH CHECK (
    matter_id IN (
        SELECT matter_id FROM matter_access 
        WHERE shared_with_user_id = auth.uid() AND access_type = 'edit'
    )
);

CREATE POLICY "Users with edit access can delete shares" ON matter_access
FOR DELETE USING (
    matter_id IN (
        SELECT matter_id FROM matter_access 
        WHERE shared_with_user_id = auth.uid() AND access_type = 'edit'
    )
);
