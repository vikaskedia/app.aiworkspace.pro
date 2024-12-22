# python3 -m venv python3-venv
# source python3-venv/bin/activate.fish
# python3 -m pip install psycopg2-binary
# python3 schema-drift-detection.py

import psycopg2
import os
import sys
from dotenv import load_dotenv

def get_table_schema(table_name):
    load_dotenv()
    
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres.oqdnbpmmgntqtigstaow",
        password=os.getenv("SUPABASE_DB_PASSWORD"),
        host=os.getenv("SUPABASE_HOST"),
        port="5432"
    )
    
    cur = conn.cursor()
    
    # Get columns
    cur.execute("""
        SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = %s
        ORDER BY ordinal_position;
    """, (table_name,))
    
    columns = cur.fetchall()
    
    # Get policies
    cur.execute("""
        SELECT 
            polname,
            polcmd,
            polqual
        FROM pg_policy
        WHERE polrelid = %s::regclass;
    """, (table_name,))
    
    policies = cur.fetchall()
    
    # Get indexes
    cur.execute("""
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes
        WHERE tablename = %s
        AND schemaname = 'public';
    """, (table_name,))
    
    indexes = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return {
        'columns': columns,
        'policies': policies,
        'indexes': indexes
    }

def compare_with_file(table_name):
    # Get actual schema from database
    db_schema = get_table_schema(table_name)
    
    # Read your schema file
    schema_file_path = f'current-schema/tables/{table_name}.sql'
    try:
        with open(schema_file_path, 'r') as f:
            file_content = f.read()
    except FileNotFoundError:
        print(f"Error: Schema file not found at {schema_file_path}")
        return
    
    # Compare and print differences
    print(f"=== Schema Comparison Report for table '{table_name}' ===\n")
    
    # Print database columns
    print("Database Columns:")
    for col in db_schema['columns']:
        print(f"- {col[0]}: {col[1]} (nullable: {col[2]}, default: {col[3]})")
    
    print("\nDatabase Policies:")
    for policy in db_schema['policies']:
        print(f"- {policy[0]} ({policy[1]})")
    
    print("\nDatabase Indexes:")
    for idx in db_schema['indexes']:
        print(f"- {idx[0]}")
    
    print("\nPlease compare with your schema file content:")
    print(file_content)

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python schema-drift-detection.py <table_name>")
        sys.exit(1)
        
    table_name = sys.argv[1]
    compare_with_file(table_name)
