import crypto from 'crypto'

/**
 * Middleware to verify Shopify Webhooks.
 * Expects req.body to be a raw Buffer (configured via express.raw() in server.js).
 */
export function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256')
  const secret = process.env.SHOPIFY_API_SECRET

  if (!hmacHeader) {
    console.error('[Shopify Webhook] Missing HMAC header')
    return res.status(401).send('Unauthorized: Missing HMAC')
  }

  if (!secret) {
    console.error('[Shopify Webhook] SHOPIFY_API_SECRET is not configured')
    return res.status(500).send('Internal Server Error')
  }

  try {
    // req.body must be a Buffer for accurate HMAC calculation
    const hash = crypto
      .createHmac('sha256', secret)
      .update(req.body, 'utf8', 'hex')
      .digest('base64')

    if (hash === hmacHeader) {
      // Valid signature! We can safely parse the JSON now for the route handler.
      req.bodyData = JSON.parse(req.body.toString('utf8'))
      next()
    } else {
      console.error('[Shopify Webhook] Invalid HMAC signature')
      res.status(401).send('Unauthorized: Invalid HMAC')
    }
  } catch (err) {
    console.error('[Shopify Webhook] Verification error:', err)
    res.status(500).send('Verification error')
  }
}
