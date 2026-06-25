import sys
sys.path.insert(0, 'c:/Users/Katleho/Desktop/BridgeBooks/backend')
from utils.shopify_client import ShopifyClient
try:
    client = ShopifyClient()
    data = client._request('GET', 'locations.json')
    print([(l['id'], l['name'], l['active']) for l in data.get('locations', [])])
except Exception as e:
    print(f"Error: {e}")
