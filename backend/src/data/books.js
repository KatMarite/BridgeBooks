/**
 * books.js — Mock book catalogue for BridgeBooks development.
 *
 * Contains 20 realistic entries spanning South African and international
 * titles with multi-supplier pricing and availability data.
 *
 * Each book follows the Master Catalogue schema shape that the frontend expects:
 *   { id, title, author, isbn, publicationDate, coverImageUrl, suppliers }
 *
 * Suppliers modelled: Booksite, Jonathan Ball, Protea
 */

export const BOOKS = [
  // ── South African Fiction ──
  {
    id: '9780143185611',
    title: 'Disgrace',
    author: 'J.M. Coetzee',
    isbn: '9780143185611',
    publicationDate: '1999-07-01',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 215.00, inStock: true, qty: 18 },
      jonathanBall: { price: 225.00, inStock: true, qty: 6 },
      protea: { price: 220.00, inStock: true, qty: 3 },
    },
  },
  {
    id: '9781415207000',
    title: 'Cry, the Beloved Country',
    author: 'Alan Paton',
    isbn: '9781415207000',
    publicationDate: '1948-02-01',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 180.00, inStock: true, qty: 22 },
      jonathanBall: { price: 195.00, inStock: true, qty: 10 },
      protea: { price: 189.00, inStock: false, qty: 0 },
    },
  },
  {
    id: '9780143026563',
    title: 'The Conservationist',
    author: 'Nadine Gordimer',
    isbn: '9780143026563',
    publicationDate: '1974-06-15',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 199.00, inStock: true, qty: 8 },
      jonathanBall: { price: 210.00, inStock: false, qty: 0 },
      protea: { price: 205.00, inStock: true, qty: 2 },
    },
  },
  {
    id: '9781868423576',
    title: 'Triomf',
    author: 'Marlene van Niekerk',
    isbn: '9781868423576',
    publicationDate: '1994-01-01',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 265.00, inStock: true, qty: 5 },
      jonathanBall: { price: 275.00, inStock: true, qty: 3 },
      protea: { price: 270.00, inStock: true, qty: 1 },
    },
  },
  {
    id: '9780316769488',
    title: 'The Catcher in the Rye',
    author: 'J.D. Salinger',
    isbn: '9780316769488',
    publicationDate: '1951-07-16',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 175.00, inStock: true, qty: 15 },
      jonathanBall: { price: 185.00, inStock: true, qty: 7 },
      protea: { price: 180.00, inStock: true, qty: 4 },
    },
  },

  // ── International Classics ──
  {
    id: '9780141182636',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    isbn: '9780141182636',
    publicationDate: '1925-04-10',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 199.00, inStock: true, qty: 12 },
      jonathanBall: { price: 210.00, inStock: true, qty: 4 },
      protea: { price: 205.00, inStock: false, qty: 0 },
    },
  },
  {
    id: '9780061120084',
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    isbn: '9780061120084',
    publicationDate: '1960-07-11',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 179.00, inStock: false, qty: 0 },
      jonathanBall: { price: 189.00, inStock: true, qty: 7 },
      protea: { price: 185.00, inStock: true, qty: 2 },
    },
  },
  {
    id: '9780451524935',
    title: '1984',
    author: 'George Orwell',
    isbn: '9780451524935',
    publicationDate: '1949-06-08',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 159.00, inStock: true, qty: 9 },
      jonathanBall: { price: 169.00, inStock: false, qty: 0 },
      protea: { price: 165.00, inStock: true, qty: 1 },
    },
  },
  {
    id: '9780141439518',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    isbn: '9780141439518',
    publicationDate: '1813-01-28',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 149.00, inStock: true, qty: 5 },
      jonathanBall: { price: 155.00, inStock: true, qty: 3 },
      protea: { price: 152.00, inStock: false, qty: 0 },
    },
  },
  {
    id: '9780060935467',
    title: 'To Kill a Mockingbird (50th Anniversary)',
    author: 'Harper Lee',
    isbn: '9780060935467',
    publicationDate: '2010-05-11',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 295.00, inStock: true, qty: 3 },
      jonathanBall: { price: 310.00, inStock: false, qty: 0 },
      protea: { price: 299.00, inStock: true, qty: 1 },
    },
  },

  // ── South African Non-Fiction ──
  {
    id: '9781868425846',
    title: 'Long Walk to Freedom',
    author: 'Nelson Mandela',
    isbn: '9781868425846',
    publicationDate: '1994-11-01',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 320.00, inStock: true, qty: 30 },
      jonathanBall: { price: 335.00, inStock: true, qty: 15 },
      protea: { price: 325.00, inStock: true, qty: 8 },
    },
  },
  {
    id: '9781770105461',
    title: 'Born a Crime',
    author: 'Trevor Noah',
    isbn: '9781770105461',
    publicationDate: '2016-11-15',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 289.00, inStock: true, qty: 25 },
      jonathanBall: { price: 299.00, inStock: true, qty: 12 },
      protea: { price: 295.00, inStock: true, qty: 6 },
    },
  },
  {
    id: '9780795708572',
    title: 'My Traitor\'s Heart',
    author: 'Rian Malan',
    isbn: '9780795708572',
    publicationDate: '1990-03-01',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 245.00, inStock: true, qty: 7 },
      jonathanBall: { price: 255.00, inStock: true, qty: 4 },
      protea: { price: 250.00, inStock: false, qty: 0 },
    },
  },

  // ── Children's & Young Adult ──
  {
    id: '9780747532743',
    title: 'Harry Potter and the Philosopher\'s Stone',
    author: 'J.K. Rowling',
    isbn: '9780747532743',
    publicationDate: '1997-06-26',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 225.00, inStock: true, qty: 40 },
      jonathanBall: { price: 235.00, inStock: true, qty: 20 },
      protea: { price: 230.00, inStock: true, qty: 10 },
    },
  },
  {
    id: '9780439064873',
    title: 'Harry Potter and the Chamber of Secrets',
    author: 'J.K. Rowling',
    isbn: '9780439064873',
    publicationDate: '1998-07-02',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 230.00, inStock: true, qty: 35 },
      jonathanBall: { price: 240.00, inStock: true, qty: 18 },
      protea: { price: 235.00, inStock: true, qty: 7 },
    },
  },
  {
    id: '9781868728527',
    title: 'The Smell of Apples',
    author: 'Mark Behr',
    isbn: '9781868728527',
    publicationDate: '1993-01-01',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 195.00, inStock: false, qty: 0 },
      jonathanBall: { price: 210.00, inStock: true, qty: 3 },
      protea: { price: 199.00, inStock: true, qty: 2 },
    },
  },

  // ── Poetry & Drama ──
  {
    id: '9780143027065',
    title: 'Collected Poems',
    author: 'Breyten Breytenbach',
    isbn: '9780143027065',
    publicationDate: '2009-10-01',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 345.00, inStock: true, qty: 4 },
      jonathanBall: { price: 355.00, inStock: false, qty: 0 },
      protea: { price: 350.00, inStock: true, qty: 1 },
    },
  },
  {
    id: '9780620443227',
    title: 'Master Harold and the Boys',
    author: 'Athol Fugard',
    isbn: '9780620443227',
    publicationDate: '1982-03-12',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 165.00, inStock: true, qty: 11 },
      jonathanBall: { price: 175.00, inStock: true, qty: 5 },
      protea: { price: 170.00, inStock: true, qty: 3 },
    },
  },

  // ── Contemporary SA Fiction ──
  {
    id: '9781415209882',
    title: 'Thirteen Cents',
    author: 'K. Sello Duiker',
    isbn: '9781415209882',
    publicationDate: '2000-01-01',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 189.00, inStock: true, qty: 6 },
      jonathanBall: { price: 199.00, inStock: true, qty: 2 },
      protea: { price: 195.00, inStock: false, qty: 0 },
    },
  },
  {
    id: '9781485903963',
    title: 'The Promise',
    author: 'Damon Galgut',
    isbn: '9781485903963',
    publicationDate: '2021-04-01',
    coverImageUrl: '',
    suppliers: {
      booksite: { price: 310.00, inStock: true, qty: 14 },
      jonathanBall: { price: 320.00, inStock: true, qty: 9 },
      protea: { price: 315.00, inStock: true, qty: 5 },
    },
  },
]
