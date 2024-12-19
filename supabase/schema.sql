-- this stores the current schema after all the migrations have been applied

-- Create tables

CREATE TABLE file_content (
    file_content jsonb,
    id bigint NOT NULL,
    created_by bigint,
    created_at date
);

CREATE TABLE file_meta (
    file_content_id bigint,
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    file_name character varying
);

CREATE TABLE folders (
    parent_folder_id bigint,
    file_meta_ids json,
    folder_name character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by bigint,
    id bigint NOT NULL
);


-- Create indexes


-- Set up RLS (Row Level Security)


-- Create policies


-- Create function to update updated_at timestamp


-- Create trigger for updated_at


