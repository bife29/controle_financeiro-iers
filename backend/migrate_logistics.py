import sqlite3

conn = sqlite3.connect('iers_local.db')
c = conn.cursor()

# Add columns to retreats
c.execute('PRAGMA table_info(retreats)')
cols = [r[1] for r in c.fetchall()]
if 'bus_capacity' not in cols:
    c.execute('ALTER TABLE retreats ADD COLUMN bus_capacity INTEGER')
    print('Added bus_capacity to retreats')
if 'bed_capacity' not in cols:
    c.execute('ALTER TABLE retreats ADD COLUMN bed_capacity INTEGER')
    print('Added bed_capacity to retreats')

# Add columns to retreat_participants
c.execute('PRAGMA table_info(retreat_participants)')
cols = [r[1] for r in c.fetchall()]
if 'bus_option' not in cols:
    c.execute("ALTER TABLE retreat_participants ADD COLUMN bus_option VARCHAR(10) DEFAULT 'Sim'")
    print('Added bus_option to retreat_participants')
if 'bed_option' not in cols:
    c.execute("ALTER TABLE retreat_participants ADD COLUMN bed_option VARCHAR(10) DEFAULT 'Sim'")
    print('Added bed_option to retreat_participants')
if 'inscription_status' not in cols:
    c.execute("ALTER TABLE retreat_participants ADD COLUMN inscription_status VARCHAR(20) DEFAULT 'Confirmado'")
    print('Added inscription_status to retreat_participants')

conn.commit()
conn.close()
print('Migration complete')
