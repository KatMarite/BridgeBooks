import crypto from 'crypto'
import 'dotenv/config'

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET
if (!SHOPIFY_API_SECRET) throw new Error('Missing SHOPIFY_API_SECRET in environment')
const PORT = 3001

async function run() {
  console.log('Sending Test Webhook...')
  
  // Create a mock payload
  const payload = {
    id: 123456789,
    name: '#1001',
    customer: { first_name: 'Test', last_name: 'User' },
    line_items: [
      {
        sku: '9780060935467', // Our mock book
        title: 'To Kill a Mockingbird',
        quantity: 1
      }
    ]
  }

  const rawBody = JSON.stringify(payload)
  
  // Calculate valid HMAC
  const hmac = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64')

  try {
    const res = await fetch(`http://localhost:${PORT}/api/webhooks/shopify/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': hmac
      },
      body: rawBody
    })
    
    console.log(`Response Status: ${res.status}`)
    const text = await res.text()
    console.log(`Response Body: ${text}`)

    if (res.status === 200) {
      console.log('✅ Webhook accepted successfully!')
    } else {
      console.error('❌ Webhook failed!')
    }

    // Now test an invalid HMAC
    console.log('\nSending Invalid Webhook...')
    const badRes = await fetch(`http://localhost:${PORT}/api/webhooks/shopify/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': 'INVALID_HMAC_STRING'
      },
      body: rawBody
    })
    
    console.log(`Response Status: ${badRes.status}`)
    if (badRes.status === 401) {
      console.log('✅ Invalid webhook rejected correctly!')
    } else {
      console.error('❌ Invalid webhook was NOT rejected with 401!')
    }

  } catch (err) {
    console.error('Fetch error:', err)
  }
}

run()
