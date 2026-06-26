#!/bin/bash
set -e

# 1. Setup Backend
cd /var/www/bridgebooks/backend
cat << 'EOF' > .env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@bridgebooks-db.c1ik8o8oeljf.af-south-1.rds.amazonaws.com:5432/postgres?sslmode=require
GOOGLE_BOOKS_API_KEY=YOUR_API_KEY_HERE
SHOPIFY_STORE_URL=bridge-bookshop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpca_YOUR_TOKEN
SHOPIFY_API_SECRET=shpss_YOUR_SECRET
PORT=3001
EOF

npm install
pm2 delete bridgebooks-api || true
pm2 start src/server.js --name bridgebooks-api --node-args="--env-file=.env"
pm2 save

# 2. Setup Database schema
cd "/var/www/bridgebooks/backend/Master Catalogue Schema"
python3 -m venv venv
source venv/bin/activate
pip install alembic psycopg2-binary
sed -i 's|sqlalchemy.url = .*|sqlalchemy.url = postgresql://postgres:YOUR_PASSWORD@bridgebooks-db.c1ik8o8oeljf.af-south-1.rds.amazonaws.com:5432/postgres?sslmode=require|g' alembic.ini
alembic upgrade head

# 3. Setup Frontend
cd /var/www/bridgebooks
cat << 'EOF' > .env.local
VITE_API_BASE_URL=http://bookbridge.bridgebooks.co.za/api
EOF

npm install
npm run build

# 4. Setup Nginx
cat << 'EOF' | sudo tee /etc/nginx/sites-available/bridgebooks
server {
    listen 80;
    server_name bookbridge.bridgebooks.co.za 13.246.194.181;

    location / {
        root /var/www/bridgebooks/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/bridgebooks /etc/nginx/sites-enabled/ || true
sudo rm -f /etc/nginx/sites-enabled/default
sudo systemctl restart nginx
