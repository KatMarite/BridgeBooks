from sqlalchemy import create_engine, text
import os

# Read from environment variable; fall back to local dev default
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:admin123@localhost:5432/Bridge_dev"
)

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    conn.execute(text("""
        INSERT INTO books (
            isbn_13,
            title,
            author,
            publisher,
            publication_date,
            supplier_cost_price,
            retail_price,
            currency,
            stock_quantity,
            description,
            cover_image_url,
            page_count
        )
        VALUES
        (
            '9780143127741',
            'The Alchemist',
            'Paulo Coelho',
            'HarperOne',
            '1993-05-01',
            120.00,
            180.00,
            'ZAR',
            25,
            'A philosophical novel about destiny.',
            NULL,
            208
        ),
        (
            '9780061120084',
            'To Kill a Mockingbird',
            'Harper Lee',
            'J.B. Lippincott & Co.',
            '1960-07-11',
            150.00,
            220.00,
            'ZAR',
            18,
            'Classic novel about justice and race.',
            NULL,
            336
        );
    """))

    conn.commit()

print("Dummy book records inserted successfully!")