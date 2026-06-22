Bridge Books
Book Data Integration & Pricing Intelligence System
A South African Edelweiss — Scoped for Claude Code



1. Executive Summary
Bridge Books is an independent bookstore in Johannesburg operating a Shopify-based online store at bridgebooks.co.za and a Shopify POS for in-store sales. The business sources stock from a range of South African and international distributors and publishers, including Booksite, Jonathan Ball, Protea, and several smaller independent publishers and authors.

The core problem is the absence of a centralised book data and pricing intelligence layer. Staff currently capture book details manually on stock receipt, look up metadata through an app called ISBN Express (which has incomplete coverage for SA titles), and have no single view of pricing and availability across all suppliers. Currency conversions for imported titles are managed manually.

This brief describes a system — working title: BookBridge — that aggregates supplier data, enriches it with metadata from multiple sources, exposes it through a clean internal interface, and synchronises authoritative product records into Shopify. A medium-term WhatsApp lookup channel for wholesale buyers is also scoped.




2. Problem Statement
2.1 Current Pain Points
Manual stock capture: Every book received must be manually keyed into Shopify. There is no automated ingestion from supplier files.
No central pricing & availability view: Pricing data lives in separate supplier files accessed via FTP, email, or request. There is no single interface to query across all distributors.
Incomplete SA metadata: Nielsen Book Data, Google Books, and Open Library have poor coverage of South African titles — missing ZAR pricing, local-language titles (Afrikaans, isiZulu, etc.), smaller SA publishers, and key fields like dimensions, weight, and descriptions. Publisher attribution is frequently incorrect.
ONIX/MARC gaps: Many smaller SA publishers and self-published authors have not produced compliant ONIX or MARC records, making integration with standard library and retail systems difficult.
Manual currency conversion: Titles sourced from Gardners (UK) and Ingram (US) require manual GBP/USD to ZAR conversion with a 30% markup applied after shipping and import fees.
No wholesale buyer interface: Informal booksellers who buy wholesale from Bridge Books have no self-service way to check pricing and availability.
2.2 Scope of This Build












3. Data Sources
3.1 Supplier Files
The following suppliers provide structured data files. Each has a different format; the system must normalise all of them into a common schema.



3.2 Metadata Enrichment Sources
Because supplier files often lack full bibliographic metadata, the system should cross-reference the following external sources in priority order:

Priority 1: Google Books API
Good coverage of English-language SA titles. Free tier sufficient for expected volume.
Priority 2: Open Library (Internet Archive)
Open, no API key required. Useful fallback for older or obscure titles.
Priority 3 (optional / fallback): Nielsen Book Data
Previously used by Bridge Books. Known to have gaps for SA titles. Use only where other sources fail. Assess cost vs. coverage benefit.
Priority 4 (fallback): ISBNDB or similar
Consider as a low-cost fallback for dimensions, weight, and page count.

4. System Architecture
4.1 High-Level Components
Ingestion Layer: Automated ingestion of FTP files (Booksite, Jonathan Ball), email attachments (Protea), and Google Form submissions (indie authors).
Normalisation Engine: Maps each supplier's unique column structure to a common BookBridge schema. Field mapping configuration stored per supplier.
Master Catalogue Database: A central PostgreSQL (or similar) database holding normalised book records. ISBN is the primary key. Records include all pricing tiers, availability, and enriched metadata.
Metadata Enrichment Pipeline: On new or incomplete records, automatically queries Google Books, Open Library, and optionally Nielsen to fill missing fields.
Currency Conversion Module: Applies live or scheduled GBP/ZAR and USD/ZAR exchange rates plus the fixed 30% markup formula for imported titles.
Shopify Sync Engine: Pushes authoritative product records to Shopify via the Admin API. Handles create, update, and out-of-stock status (shows 'Order on Request').
Internal Lookup UI: A simple web-based staff interface to search by ISBN, title, or author and see pricing/availability across all suppliers.
WhatsApp Bot (Phase 3): Twilio or similar integration allowing wholesale buyers to query by ISBN, title, or author via WhatsApp.
4.2 Key Data Flows
Inbound: Supplier files → Ingestion Layer → Normalisation Engine → Master Catalogue → Enrichment Pipeline → Shopify Sync.

Lookup: Staff query Internal UI → Master Catalogue → response with pricing, availability, and metadata.

Outbound (Phase 3): Wholesale buyer WhatsApp message → Bot → Master Catalogue → wholesale price + availability response.
4.3 Shopify-Specific Behaviour
Products auto-created in Shopify when a new title is received and not yet listed.
Existing products enriched with metadata from the Master Catalogue if fields are empty.
When stock reaches zero: product set to 'Order on Request' status rather than hidden.
Wholesale pricing tier managed separately — not exposed on the public Shopify store.
Barcode/ISBN scanning at POS triggers lookup in Master Catalogue before falling back to Shopify's own product data.

5. Core Data Schema
Every book record in the Master Catalogue should include the following fields. Fields marked * are required; all others are best-effort from enrichment.




6. Currency & Pricing Logic
For domestically sourced titles (Booksite, Jonathan Ball, Protea, SA publishers), pricing is already in ZAR and should be used directly from the supplier file.

For imported titles (Gardners in GBP, Ingram in USD), the following formula applies:




Exchange rates should be fetched automatically on a daily schedule from a free or low-cost API (e.g. ExchangeRate-API or Open Exchange Rates free tier). The markup multiplier (1.30) should be configurable in the admin interface without requiring a code change.

6.1 Wholesale Pricing Tiers
Standard wholesale: 20% discount off Bridge retail price.
Promotional wholesale: 30% or deeper discount — manually applied per title or per order.
Wholesale prices must not be exposed on the public Shopify storefront.

7. Ingestion & Normalisation
7.1 FTP Ingestion (Booksite & Jonathan Ball)
Scheduler runs daily on working days (Mon–Fri) to pull the latest files from each FTP server.
Files downloaded to a staging area, parsed, and mapped to the common schema.
Field mapping configuration stored as a per-supplier JSON or YAML config file — editable without code changes.
On conflict (same ISBN, different data): supplier file data takes precedence for pricing and availability; enriched metadata fields are preserved unless manually overridden.
7.2 Email Ingestion (Protea & ad hoc publishers)
Protea file arrives by email each weekday morning. Options: monitored inbox with auto-download trigger, or a simple daily manual download prompt for staff.
Ad hoc publisher files: staff upload via the internal admin UI. Same normalisation pipeline applies.
System should detect and flag when Protea's email has not arrived by a configurable threshold time (e.g. 10:00 SAST).
7.3 Independent Author Submissions
Google Form submissions automatically ingested via Google Sheets API or Zapier/Make webhook.
Paper submissions entered manually by staff via a simple admin form in the internal UI.
~10 submissions per month. Each goes into a review queue before being published to Shopify.
Staff review checklist: ISBN validity, NLSA registration, cover image, description, pricing confirmation.
7.4 Second-Hand Titles
ISBN scanned at receiving triggers a lookup in the Master Catalogue first, then Google Books/Open Library.
No supplier file — metadata enrichment only. Staff manually set the second-hand price.
Tagged in Shopify with a 'Second-hand' collection flag.

8. Shopify Integration
The system integrates with Shopify via the official Admin API (REST or GraphQL). A Shopify Custom App should be created for Bridge Books to manage API credentials securely.

Product creation: When a new ISBN appears in the Master Catalogue with no corresponding Shopify product, a new product is created automatically.
Product update: When pricing or metadata changes in the Master Catalogue, the corresponding Shopify product is updated on the next sync cycle (suggested: every 4 hours, or on-demand trigger).
Out-of-stock handling: When all supplier stock is 0 and the book is not available to order, the product is set to display 'Order on Request' using a Shopify metafield or inventory policy setting. Product is NOT hidden.
Cover images: Uploaded to Shopify product media on first create. Updated only if a higher-resolution image is found.
Collections: BISAC/Thema categories map to Shopify collections. Language field used for an 'Afrikaans', 'isiZulu' etc. collection grouping.
POS compatibility: Since Bridge Books uses Shopify POS, all products in the Master Catalogue that are in physical stock are available at POS automatically via Shopify's native POS inventory.

9. Internal Staff Interface
A simple, non-technical web interface accessible only to Bridge Books staff. Design should prioritise clarity over sophistication — this will be used in a busy bookstore environment.

9.1 Core Screens
Dashboard: Today's ingestion summary (files received, new titles, updated prices, errors).
Book Search: Search by ISBN, title, or author. Returns availability and pricing across all suppliers, plus enrichment status.
Supplier Status: Shows last successful sync time per supplier, and flags any failures or missing files.
Review Queue: List of indie author submissions awaiting staff review before Shopify publish.
Price Override: Allows staff to manually set or adjust Bridge's retail price for specific titles.
Currency Settings: Displays current exchange rates and allows adjustment of the import markup percentage.
9.2 Access & Hosting
Authentication: Simple username/password login. No public access.
Hosting: A South African or regional cloud provider is preferred for data sovereignty (e.g. AWS af-south-1 in Cape Town, or a local VPS provider).
The system must function on low-bandwidth connections — staff may be using mobile data.

10. WhatsApp Wholesale Lookup (Phase 3)
This phase is a medium-term goal and should be designed for but not built in Phase 1. The following captures the requirements for future reference.

Channel: WhatsApp Business API via Twilio, Meta Cloud API, or a South African provider such as Clickatell.
Users: Wholesale buyers (informal booksellers) who purchase from Bridge Books.
Lookup inputs: ISBN, title, or author name sent as a WhatsApp message.
Response: Availability (in stock / order on request) and wholesale price in ZAR.
Access control: Registered wholesale buyers only. Phone number whitelist or simple PIN system.
Low-data design: Text-only responses. No images. Short message format optimised for low-bandwidth mobile connections.
Fallback: If the bot cannot find a title, it escalates to a staff member via WhatsApp.

11. ONIX Enrichment (Internal)
Bridge Books has identified an opportunity to assist small SA publishers in producing compliant ONIX records — both as a service to the industry and as a way to improve the quality of the Master Catalogue. This is an internal workflow for now, with no publisher-facing interface required in v1.

Staff can flag a title as 'ONIX enrichment needed' in the internal UI.
A template ONIX record is generated from the Master Catalogue data for that ISBN.
Staff complete missing fields and export a valid ONIX 3.0 XML file.
The completed ONIX file can be shared with the publisher directly.
This workflow should be designed to accommodate a future publisher-facing portal without requiring a full rebuild.

12. Phased Build Plan
Phase 1 — Foundation (Recommended first sprint)
Set up Master Catalogue database with core schema.
Build FTP ingestion for Booksite and Jonathan Ball.
Build email ingestion for Protea (auto-download from monitored inbox).
Normalisation engine with per-supplier field mapping config.
Google Books + Open Library enrichment pipeline.
Shopify Admin API sync (create + update + out-of-stock handling).
Basic internal staff UI: dashboard + book search + supplier status.
Phase 2 — Pricing Intelligence
Currency conversion module with live exchange rates.
Full pricing lookup across all suppliers in the internal UI.
Price override interface.
Google Form / indie author intake pipeline.
ONIX export workflow (internal).
Phase 3 — Wholesale Channel
WhatsApp Business API integration.
Wholesale buyer registration and phone whitelist.
ISBN / title / author lookup via WhatsApp.
Staff escalation flow for unresolved queries.

13. Technical Constraints & Preferences
Builder: Claude Code (primary). Human developer involvement possible but budget-sensitive.
Hosting: South African or regional server preferred (AWS af-south-1 Cape Town, or local VPS). Low-bandwidth optimisation required throughout.
Cost sensitivity: Paid APIs acceptable but should be evaluated for cost. Prefer free tiers (Google Books, Open Library, ExchangeRate-API free tier) wherever sufficient.
Non-technical operation: Day-to-day management must be operable by non-technical staff. New supplier file formats will be rare; when they do occur, a developer will handle mapping config.
Data privacy: Author submissions contain personal information (name, contact details, banking for consignment). These must be stored securely and not exposed in the internal UI beyond what is necessary.
Shopify: Custom App credentials, not a public Shopify app. Shopify POS compatibility is a hard requirement.
Open source stack preferred: PostgreSQL, Python or Node.js backend, simple React or plain HTML/JS frontend.

14. Success Criteria



Staff time spent on manual book data capture reduced by >80%.
Shopify product catalogue complete and accurate for all titles received in the past 6 months.
Pricing and availability from all major suppliers visible in a single search in under 5 seconds.
Zero supplier files missed — all ingestion tracked and failures flagged automatically.
Wholesale buyers (Phase 3) able to self-serve pricing lookups via WhatsApp without staff intervention for standard queries.

15. Open Questions for Developer
FTP credentials: Exact server addresses, usernames, and passwords for Booksite and Jonathan Ball FTP servers — to be provided securely outside this document.
Shopify credentials: Store URL, Admin API key — to be generated via Shopify admin as a Custom App.
Protea email monitoring: Will the system have access to a monitored inbox (e.g. a dedicated orders@bridgebooks.co.za)? Or will staff manually upload Protea files?
Nielsen: Should Nielsen Book Data be retained as a fallback enrichment source? Cost assessment required — Bridge Books has used it previously and found SA coverage poor. Recommend trialling Google Books + Open Library first.
Exchange rate API: Confirm acceptable free-tier provider. Suggested: exchangerate-api.com (1,500 free requests/month) or frankfurter.app (open, free).
Second-hand pricing: Is there a standard margin formula for second-hand titles, or is it always manually set?
Consignment titles: Some indie authors may supply on consignment rather than outright purchase. Does the system need to track consignment stock separately?

End of Brief — Bridge Books Book Data Integration System