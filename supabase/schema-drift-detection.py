# python3 -m venv python3-venv
# source python3-venv/bin/activate.fish
# python3 -m pip install psycopg2-binary
# python3 schema-drift-detection.py

import psycopg2
import os
from dotenv import load_dotenv

def get_matters_schema():
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
        AND table_name = 'matters'
        ORDER BY ordinal_position;
    """)
    
    columns = cur.fetchall()
    
    # Get policies
    cur.execute("""
        SELECT 
            polname,
            polcmd,
            polqual
        FROM pg_policy
        WHERE polrelid = 'matters'::regclass;
    """)
    
    policies = cur.fetchall()
    
    # Get indexes
    cur.execute("""
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes
        WHERE tablename = 'matters'
        AND schemaname = 'public';
    """)
    
    indexes = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return {
        'columns': columns,
        'policies': policies,
        'indexes': indexes
    }

def compare_with_file():
    # Get actual schema from database
    db_schema = get_matters_schema()
    
    # Read your schema file
    with open('current-schema/tables/matters.sql', 'r') as f:
        file_content = f.read()
    
    # Compare and print differences
    print("=== Schema Comparison Report ===\n")
    
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
    compare_with_file()
