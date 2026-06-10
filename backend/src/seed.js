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

    // ── Seed indie submissions ──
    const SUBMISSIONS = [
      { title: 'The Karoo Dreamweaver', authorName: 'Lindiwe Mokoena', authorEmail: 'lindiwe.mokoena@gmail.com', synopsis: 'A magical realism novel set in the vast Karoo landscape, where a young shepherd discovers she can weave dreams into reality.', pageCount: 312, suggestedPrice: 289.99, submissionDate: '2026-05-28T09:14:00Z', status: 'pending' },
      { title: 'Echoes of Table Mountain', authorName: 'James van der Berg', authorEmail: 'jvdberg.writes@outlook.com', synopsis: 'A literary thriller following a Cape Town journalist who uncovers a decades-old conspiracy buried in the archives of the District Six Museum.', pageCount: 278, suggestedPrice: 265.00, submissionDate: '2026-05-30T14:22:00Z', status: 'pending' },
      { title: 'Ubuntu Kitchen: Recipes for Community', authorName: 'Fatima Abrahams', authorEmail: 'fatima.abrahams@cookza.co.za', synopsis: 'A cookbook celebrating the diverse culinary traditions of South Africa with over 120 recipes.', pageCount: 224, suggestedPrice: 445.00, submissionDate: '2026-06-01T08:45:00Z', status: 'pending' },
      { title: 'The Algorithm of Us', authorName: 'Thabo Nkosi', authorEmail: 'thabo.nkosi@techmail.com', synopsis: 'A near-future romance set in Johannesburg where two AI researchers fall in love while building an algorithm.', pageCount: 198, suggestedPrice: 225.00, submissionDate: '2026-06-02T11:30:00Z', status: 'pending' },
      { title: 'Wildflower Coast', authorName: 'Sarah du Plessis', authorEmail: 'sarah.duplessis@writersza.org', synopsis: 'A coming-of-age novel following three friends through a summer on the West Coast.', pageCount: 256, suggestedPrice: 249.99, submissionDate: '2026-05-15T16:00:00Z', status: 'approved', reviewedBy: 'Admin User', reviewedAt: '2026-05-20T10:30:00Z' },
      { title: 'Code of the Savanna', authorName: 'Mpho Dlamini', authorEmail: 'mpho.d@gmail.com', synopsis: 'A children\'s adventure book where a young programmer from Soweto creates a game that opens a portal to the African savanna.', pageCount: 144, suggestedPrice: 189.99, submissionDate: '2026-05-10T13:15:00Z', status: 'approved', reviewedBy: 'Staff Member', reviewedAt: '2026-05-18T09:00:00Z' },
      { title: 'Midnight in Maboneng', authorName: 'Zinhle Khumalo', authorEmail: 'zinhle.k@artmail.co.za', synopsis: 'A poetry collection exploring urban life, identity, and love in Johannesburg\'s vibrant Maboneng precinct.', pageCount: 96, suggestedPrice: 175.00, submissionDate: '2026-05-12T10:00:00Z', status: 'approved', reviewedBy: 'Admin User', reviewedAt: '2026-05-22T14:45:00Z' },
      { title: 'Get Rich Quick with Crypto', authorName: 'Derek Schoeman', authorEmail: 'derek.crypto99@mail.com', synopsis: 'Learn the secrets the banks don\'t want you to know!', pageCount: 88, suggestedPrice: 599.99, submissionDate: '2026-05-08T07:30:00Z', status: 'rejected', reviewedBy: 'Admin User', reviewedAt: '2026-05-09T08:00:00Z', rejectionReason: 'Content makes unsubstantiated financial claims and promises guaranteed returns.' },
      { title: 'Whispers of the Drakensberg', authorName: 'Nomusa Cele', authorEmail: 'nomusa.cele@kznwriters.co.za', synopsis: 'A historical novel set during the Anglo-Zulu War, told from the perspective of a young Zulu healer.', pageCount: 340, suggestedPrice: 310.00, submissionDate: '2026-06-04T15:20:00Z', status: 'pending' },
      { title: 'My Manifesto (Unedited)', authorName: 'Anonymous Author', authorEmail: 'truth.seeker.2026@protonmail.com', synopsis: 'A raw, unedited collection of political opinions.', pageCount: 412, suggestedPrice: 150.00, submissionDate: '2026-05-05T22:10:00Z', status: 'rejected', reviewedBy: 'Staff Member', reviewedAt: '2026-05-07T11:30:00Z', rejectionReason: 'Manuscript does not meet editorial standards.' },
    ]

    let subsInserted = 0
    for (const sub of SUBMISSIONS) {
      const subRes = await client.query(
        `INSERT INTO indie_submissions (title, author_name, author_email, synopsis, page_count, suggested_price, submission_date, status, reviewed_by, reviewed_at, rejection_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT DO NOTHING`,
        [sub.title, sub.authorName, sub.authorEmail, sub.synopsis, sub.pageCount, sub.suggestedPrice, sub.submissionDate, sub.status, sub.reviewedBy || null, sub.reviewedAt || null, sub.rejectionReason || null]
      )
      if (subRes.rowCount && subRes.rowCount > 0) subsInserted++
    }
    console.log(`✅ Seeded ${subsInserted} indie submissions.`)

    // ── Seed ingestion events (for a populated dashboard) ──
    const EVENTS = [
      { supplier: 'booksite', status: 'success', file: 'booksite_stock_20260608.csv', processed: 1247, inserted: 89, updated: 1158, errors: 0, message: 'Booksite import: 1247 books, 1247 prices upserted', hoursAgo: 2 },
      { supplier: 'jonathanBall', status: 'success', file: 'JBPStock.csv', processed: 3402, inserted: 210, updated: 3192, errors: 0, message: 'Jonathan Ball import: 3402 books, 3402 prices upserted', hoursAgo: 3 },
      { supplier: 'protea', status: 'warning', file: 'protea_catalogue_jun2026.xlsx', processed: 856, inserted: 45, updated: 798, errors: 13, message: 'Protea import: 843 books, 843 prices upserted (13 rows skipped)', hoursAgo: 5 },
      { supplier: 'booksite', status: 'success', file: 'booksite_stock_20260607.csv', processed: 1245, inserted: 12, updated: 1233, errors: 0, message: 'Booksite import: 1245 books, 1245 prices upserted', hoursAgo: 26 },
      { supplier: 'jonathanBall', status: 'success', file: 'JBPStock.csv', processed: 3398, inserted: 5, updated: 3393, errors: 0, message: 'Jonathan Ball import: 3398 books, 3398 prices upserted', hoursAgo: 27 },
      { supplier: 'protea', status: 'error', file: 'protea_catalogue_jun2026.xlsx', processed: 0, inserted: 0, updated: 0, errors: 1, message: 'Protea import failed: Email attachment not found', hoursAgo: 29 },
      { supplier: 'booksite', status: 'success', file: 'booksite_stock_20260606.csv', processed: 1240, inserted: 8, updated: 1232, errors: 0, message: 'Booksite import: 1240 books, 1240 prices upserted', hoursAgo: 50 },
      { supplier: 'jonathanBall', status: 'warning', file: 'JBPStock.csv', processed: 3395, inserted: 3, updated: 3387, errors: 5, message: 'Jonathan Ball import: 3390 books, 3390 prices (5 invalid ISBNs)', hoursAgo: 51 },
    ]

    let eventsInserted = 0
    for (const evt of EVENTS) {
      const completedAt = new Date(Date.now() - evt.hoursAgo * 60 * 60 * 1000)
      const startedAt = new Date(completedAt - 45 * 1000) // ~45 seconds earlier
      const evtRes = await client.query(
        `INSERT INTO ingestion_events (supplier_name, status, file_name, records_processed, records_inserted, records_updated, errors_count, message, started_at, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [evt.supplier, evt.status, evt.file, evt.processed, evt.inserted, evt.updated, evt.errors, evt.message, startedAt, completedAt]
      )
      if (evtRes.rowCount && evtRes.rowCount > 0) {
        eventsInserted++
        const eventId = evtRes.rows[0].id

        // Seed matching errors for events that had them
        if (evt.errors > 0 && evt.status === 'warning') {
          const errorMessages = [
            'Invalid ISBN-13 format: not 13 digits',
            'Missing required field "title"',
            'Non-numeric value in retail_price column',
            'Publication date format invalid — expected YYYY-MM-DD',
            'Duplicate entry detected, skipping',
          ]
          for (let i = 0; i < Math.min(evt.errors, errorMessages.length); i++) {
            await client.query(
              `INSERT INTO ingestion_errors (event_id, supplier_name, file_name, message, created_at)
               VALUES ($1, $2, $3, $4, $5)`,
              [eventId, evt.supplier, evt.file, `Row ${100 + i * 37}: ${errorMessages[i]}`, completedAt]
            )
          }
        } else if (evt.status === 'error') {
          await client.query(
            `INSERT INTO ingestion_errors (event_id, supplier_name, file_name, message, created_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [eventId, evt.supplier, evt.file, evt.message, completedAt]
          )
        }
      }
    }
    console.log(`✅ Seeded ${eventsInserted} ingestion events.`)


  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Seed failed:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
