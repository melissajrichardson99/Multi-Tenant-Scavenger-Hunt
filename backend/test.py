import psycopg2

try:
    conn = psycopg2.connect(
        host="aws-1-us-west-2.pooler.supabase.com",
        port=5432,
        user="postgres.qcoivvnbukiigykdeblb",   # note: project-ref appended
        password="!Adventure1234!",
        dbname="postgres"
    )
    print("SUCCESS: connected!")
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    print("Query result:", cur.fetchone())
    conn.close()
except Exception as e:
    print("FAILED:", e)