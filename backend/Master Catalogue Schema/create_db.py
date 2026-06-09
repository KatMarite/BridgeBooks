import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

conn = psycopg2.connect('postgresql://postgres:admin123@localhost:5432/postgres')
conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
cur = conn.cursor()
cur.execute('CREATE DATABASE "Bridge_dev";')
cur.close()
conn.close()
