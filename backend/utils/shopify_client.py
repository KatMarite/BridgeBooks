"""
shopify_client.py — Shopify Admin API Client for BridgeBooks.

Handles authentication, REST API requests, dynamic location fetching,
product management, and strict rate limiting (leaky bucket algorithm).
"""

import os
import time
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

SHOPIFY_STORE_URL = os.getenv("SHOPIFY_STORE_URL")
SHOPIFY_ACCESS_TOKEN = os.getenv("SHOPIFY_ACCESS_TOKEN")
API_VERSION = "2024-01"


class ShopifyAPIError(Exception):
    pass


class ShopifyClient:
    def __init__(self, store_url=None, access_token=None):
        self.store_url = store_url or SHOPIFY_STORE_URL
        self.access_token = access_token or SHOPIFY_ACCESS_TOKEN
        
        if not self.store_url or not self.access_token:
            raise ValueError("Shopify credentials (SHOPIFY_STORE_URL, SHOPIFY_ACCESS_TOKEN) are missing.")
            
        # Strip protocol if provided accidentally
        self.store_url = self.store_url.replace("https://", "").replace("http://", "").rstrip('/')
        self.base_url = f"https://{self.store_url}/admin/api/{API_VERSION}"
        
        self.session = requests.Session()
        self.session.headers.update({
            "X-Shopify-Access-Token": self.access_token,
            "Content-Type": "application/json",
            "Accept": "application/json"
        })
        
        self._primary_location_id = None

    def _request(self, method, endpoint, **kwargs):
        """
        Internal request wrapper that handles Shopify's rate limit.
        Monitors X-Shopify-Shop-Api-Call-Limit (e.g., '38/40') and sleeps if near limit.
        Automatically retries on 429 Too Many Requests.
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        while True:
            resp = self.session.request(method, url, **kwargs)
            
            # Handle rate limit headers proactively
            limit_header = resp.headers.get("X-Shopify-Shop-Api-Call-Limit")
            if limit_header:
                current, max_limit = map(int, limit_header.split('/'))
                # If we are within 5 calls of the max, sleep to let the bucket drain
                # (Standard limit is 40, leaks at 2/sec)
                if current >= max_limit - 5:
                    print(f"  [Shopify] Approaching rate limit ({current}/{max_limit}). Pausing 2s...")
                    time.sleep(2)
            
            if resp.status_code == 429:
                retry_after = float(resp.headers.get("Retry-After", 2.0))
                print(f"  [Shopify] 429 Too Many Requests. Retrying in {retry_after}s...")
                time.sleep(retry_after)
                continue
                
            try:
                resp.raise_for_status()
            except requests.exceptions.HTTPError as e:
                error_msg = resp.text
                raise ShopifyAPIError(f"HTTP {resp.status_code} for {method} {url}: {error_msg}") from e
                
            return resp.json()

    def get_primary_location(self):
        """Fetch the store's primary active location ID for inventory management."""
        if self._primary_location_id:
            return self._primary_location_id
            
        data = self._request("GET", "locations.json")
        for loc in data.get("locations", []):
            if loc.get("active"):
                self._primary_location_id = loc["id"]
                return self._primary_location_id
                
        raise ShopifyAPIError("No active location found for this Shopify store.")

    def get_location_by_name(self, name):
        """Fetch the store's active location ID by its name."""
        data = self._request("GET", "locations.json")
        for loc in data.get("locations", []):
            if loc.get("name") == name and loc.get("active"):
                return loc["id"]
                
        raise ShopifyAPIError(f"No active location found with name '{name}'.")

    def create_product(self, product_data):
        """
        Create a new product.
        product_data should match Shopify's Product resource schema.
        """
        data = self._request("POST", "products.json", json={"product": product_data})
        return data.get("product")

    def update_product(self, product_id, product_data):
        """
        Update an existing product by its Shopify ID.
        """
        data = self._request("PUT", f"products/{product_id}.json", json={"product": product_data})
        return data.get("product")
        
    def delete_product(self, product_id):
        """
        Delete a product by its Shopify ID.
        """
        self._request("DELETE", f"products/{product_id}.json")
        return True

    def set_inventory(self, inventory_item_id, available_quantity, location_id=None):
        """
        Set the absolute available inventory quantity for an inventory item.
        """
        loc_id = location_id or self.get_primary_location()
        
        payload = {
            "location_id": loc_id,
            "inventory_item_id": inventory_item_id,
            "available": available_quantity
        }
        
        data = self._request("POST", "inventory_levels/set.json", json=payload)
        return data.get("inventory_level")

