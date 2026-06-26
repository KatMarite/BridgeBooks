#!/bin/bash
set -e

echo "Updating system..."
sudo apt-get update
sudo apt-get upgrade -y

echo "Installing dependencies..."
sudo apt-get install -y curl wget gnupg2 ca-certificates lsb-release apt-transport-https software-properties-common postgresql-client python3 python3-pip python3-venv nginx

echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "Installing PM2..."
sudo npm install -g pm2

echo "Setting up directory..."
sudo mkdir -p /var/www/bridgebooks
sudo chown -R ubuntu:ubuntu /var/www/bridgebooks

echo "Extracting code..."
tar -xzvf ~/bridgebooks.tar.gz -C /var/www/bridgebooks

echo "Setup complete!"
