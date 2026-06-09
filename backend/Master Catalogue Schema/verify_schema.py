import psycopg2

conn = psycopg2.connect('postgresql://postgres:admin123@localhost:5432/Bridge_dev')
cur = conn.cursor()

# 1. List tables
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
print('=== TABLES ===')
for r in cur.fetchall():
    print(f'  {r[0]}')

# 2. supplier_prices columns
print('\n=== supplier_prices columns ===')
cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'supplier_prices' ORDER BY ordinal_position")
for r in cur.fetchall():
    print(f'  {r[0]:20s} {r[1]:20s} nullable={r[2]}')

# 3. New books columns
print('\n=== new books columns ===')
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'books' ORDER BY ordinal_position")
for r in cur.fetchall():
    print(f'  {r[0]:25s} {r[1]}')

# 4. Row counts
cur.execute("SELECT COUNT(*) FROM books")
print(f'\nBooks count: {cur.fetchone()[0]}')
cur.execute("SELECT COUNT(*) FROM supplier_prices")
print(f'Supplier prices count: {cur.fetchone()[0]}')

conn.close()
