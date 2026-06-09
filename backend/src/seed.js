import { BOOKS } from './data/books.js'
import { pool, connectDb, isDbConnected } from './db.js'

/**
 * seed.js — Node.js seed script for BridgeBooks PostgreSQL database.
 * 
 * Inserts the 20 mock books into the `books` table and their associated
 * multi-supplier pricing into the `supplier_prices` table.
 * Uses ON CONFLICT DO NOTHING so it can be run safely multiple times.
 */

async function seed() {
  const connected = await connectDb()
  if (!connected) {
    console.error('❌ Cannot seed database: Connection failed.')
    process.exit(1)
  }

  console.log('🌱 Starting database seed...')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    let booksInserted = 0
    let pricesInserted = 0

    for (const book of BOOKS) {
      // 1. Insert Book
      const bookRes = await client.query(
        `INSERT INTO books (
          isbn_13, title, author, publication_date, cover_image_url
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (isbn_13) DO NOTHING
        RETURNING isbn_13`,
        [
          book.isbn,
          book.title,
          book.author,
          book.publicationDate || null,
          book.coverImageUrl || null
        ]
      )

      if (bookRes.rowCount && bookRes.rowCount > 0) {
        booksInserted++
      }

      // 2. Insert Supplier Prices
      for (const [supplierKey, data] of Object.entries(book.suppliers)) {
        const priceRes = await client.query(
          `INSERT INTO supplier_prices (
            isbn_13, supplier_name, retail_price, in_stock, stock_quantity
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (isbn_13, supplier_name) DO NOTHING`,
          [
            book.isbn,
            supplierKey,
            data.price,
            data.inStock,
            data.qty
          ]
        )
        if (priceRes.rowCount && priceRes.rowCount > 0) {
          pricesInserted++
        }
      }
    }

    await client.query('COMMIT')
    console.log(`✅ Seed complete! Inserted ${booksInserted} new books and ${pricesInserted} supplier prices.`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
