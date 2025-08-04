-- Import tables
\ir tables/workspaces.sql
\ir tables/workspace_access.sql
\ir tables/events.sql
\ir tables/tasks.sql
\ir tables/task_comments.sql
\ir tables/goals.sql
\ir tables/file_content.sql
\ir tables/file_meta.sql
\ir tables/folders.sql
\ir tables/notifications.sql

-- Import functions
\ir functions/update_updated_at_column.sql
\ir functions/get_user_id_by_email.sql
\ir functions/get_user_info_by_email.sql
\ir functions/get_user_info_by_id.sql

-- Import triggers
\ir triggers/update_timestamps.sql
