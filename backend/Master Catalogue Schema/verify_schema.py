import psycopg2

conn = psycopg2.connect('postgresql://postgres:admin123@localhost:5432/Bridge_dev')
cur = conn.cursor()

# Tables
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE 'alembic%' ORDER BY table_name")
print('=== TABLES ===')
for r in cur.fetchall():
    print(f'  {r[0]}')

# Row counts
for table in ['books', 'supplier_prices', 'price_overrides', 'indie_submissions']:
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    print(f'\n  {table}: {cur.fetchone()[0]} rows')

# Submissions breakdown
cur.execute("SELECT status, COUNT(*) FROM indie_submissions GROUP BY status")
print('\n=== Indie Submissions by Status ===')
for r in cur.fetchall():
    print(f'  {r[0]}: {r[1]}')

conn.close()
