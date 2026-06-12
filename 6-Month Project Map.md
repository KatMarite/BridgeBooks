# **ClickUp Project Generation Prompt: BookBridge (6-Month Roadmap)**

**Context for ClickUp:**

Please generate a comprehensive project hierarchy in ClickUp for a software development project called "BookBridge." BookBridge is a centralised book data and pricing intelligence system for an independent bookstore. The project will take 6 months (24 weeks) and is staffed by three Junior Developers:

* **Assignee 1:** Data Engineer (Dev 1\)  
* **Assignee 2:** Integration Engineer (Dev 2\)  
* **Assignee 3:** Frontend/Infrastructure (Dev 3\)

**Hierarchy Required:**

* **Space:** BookBridge Development  
* **Folder:** 6-Month Roadmap  
* **Lists:** 1\. Phase 1: Foundation MVP (Weeks 1-5)  
  2\. Phase 2: Pricing & Workflows (Weeks 6-10)  
  3\. Phase 3: Wholesale Bot (Weeks 11-14)  
  4\. Phase 4: Beta Testing & Refinement (Weeks 15-20)  
  5\. Phase 5: Launch & Onboarding (Weeks 21-24)

Please create the following Tasks and Subtasks under each list, assigning them to the specified roles. Add the descriptions and estimated timeframes as Custom Fields or within the Task descriptions.

### **LIST 1: Phase 1 \- Foundation MVP (Weeks 1-5)**

**Description:** Establish the core data ingestion pipeline, normalisation engine, Master Catalogue database, and Shopify synchronization.

* **Task: Environment & Database Setup (Week 1\)**  
  * *Subtask:* Provision AWS af-south-1 hosting environment \[Assignee: UI/Infra\]  
  * *Subtask:* Initialize web framework (React/HTML) & deployment pipelines \[Assignee: UI/Infra\]  
  * *Subtask:* Install & configure PostgreSQL database \[Assignee: Data Engineer\]  
  * *Subtask:* Draft Master Catalogue schema (ISBN-13 as primary key) & run migrations \[Assignee: Data Engineer\]  
  * *Subtask:* Create Shopify Custom App & configure Admin API keys \[Assignee: Integration Engineer\]  
* **Task: Primary Supplier Ingestion (Week 2\)**  
  * *Subtask:* Set up automated FTP connection for Booksite \[Assignee: Data Engineer\]  
  * *Subtask:* Build normalisation engine to map Booksite columns \[Assignee: Data Engineer\]  
  * *Subtask:* Register Google Books API free tier & build metadata enrichment pipeline \[Assignee: Integration Engineer\]  
  * *Subtask:* Build simple auth system (username/password) & core UI shell \[Assignee: UI/Infra\]  
* **Task: Secondary Suppliers & Search UI (Week 3\)**  
  * *Subtask:* Replicate FTP ingestion pipeline for Jonathan Ball \[Assignee: Data Engineer\]  
  * *Subtask:* Implement graceful failure logic for corrupt CSVs \[Assignee: Data Engineer\]  
  * *Subtask:* Integrate Open Library API as secondary metadata fallback \[Assignee: Integration Engineer\]  
  * *Subtask:* Build internal cross-supplier book search tool (ISBN/Title/Author) \[Assignee: UI/Infra\]  
* **Task: Shopify Sync Engine & Email Parsing (Week 4\)**  
  * *Subtask:* Build Protea email attachment auto-downloader script \[Assignee: Data Engineer\]  
  * *Subtask:* Develop core sync engine to push new ISBN records to Shopify \[Assignee: Integration Engineer\]  
  * *Subtask:* Write metadata update function for existing Shopify products \[Assignee: Integration Engineer\]  
  * *Subtask:* Scaffold daily ingestion dashboard screen for staff \[Assignee: UI/Infra\]  
* **Task: Conflict Rules & E2E Testing (Week 5\)**  
  * *Subtask:* Write logic prioritizing supplier pricing/availability over external metadata \[Assignee: Data Engineer\]  
  * *Subtask:* Build queuing/retry systems for Shopify API rate limits \[Assignee: Integration Engineer\]  
  * *Subtask:* Implement logic to set products to 'Order on Request' when out of stock \[Assignee: Integration Engineer\]  
  * *Subtask:* Optimize UI for low-bandwidth mobile connections & deploy supplier status page \[Assignee: UI/Infra\]

### **LIST 2: Phase 2 \- Pricing Intelligence & Workflows (Weeks 6-10)**

**Description:** Implement dynamic pricing, foreign exchange rate APIs, staff price overrides, and Indie Author management.

* **Task: Dynamic Pricing Engine (Weeks 6-7)**  
  * *Subtask:* Integrate free-tier exchange rate API (exchangerate-api.com or frankfurter.app) \[Assignee: Integration Engineer\]  
  * *Subtask:* Build formula to calculate ZAR retail price (foreign price \+ shipping \+ 30% margin) \[Assignee: Data Engineer\]  
  * *Subtask:* Define margin formulas specifically for second-hand titles \[Assignee: Data Engineer\]  
  * *Subtask:* Build Price Override interface for staff in the internal UI \[Assignee: UI/Infra\]  
* **Task: Indie Author & Consignment Pipeline (Weeks 8-9)**  
  * *Subtask:* Create Google Form \+ Webhook/Sheets API ingestion for indie submissions \[Assignee: Integration Engineer\]  
  * *Subtask:* Update database schema to track 'Consignment' stock separately \[Assignee: Data Engineer\]  
  * *Subtask:* Build staff review queue in UI to approve/reject indie titles \[Assignee: UI/Infra\]  
* **Task: ONIX 3.0 Export Functionality (Week 10\)**  
  * *Subtask:* Map Master Catalogue data to ONIX 3.0 XML standards \[Assignee: Data Engineer\]  
  * *Subtask:* Build XML generation script and validate output against ONIX strict schemas \[Assignee: Integration Engineer\]  
  * *Subtask:* Add "Export ONIX" button and download feature to UI \[Assignee: UI/Infra\]

### **LIST 3: Phase 3 \- Wholesale Bot (Weeks 11-14)**

**Description:** Build the WhatsApp self-serve lookup channel for wholesale buyers.

* **Task: WhatsApp API Infrastructure (Week 11\)**  
  * *Subtask:* Register & configure Meta Cloud API / Twilio WhatsApp Sandbox \[Assignee: Integration Engineer\]  
  * *Subtask:* Setup webhook listener for incoming WhatsApp messages \[Assignee: Integration Engineer\]  
* **Task: Access Control & Whitelisting (Week 12\)**  
  * *Subtask:* Build phone number whitelist schema in database \[Assignee: Data Engineer\]  
  * *Subtask:* Build "Manage Wholesale Buyers" UI for staff to add/remove phone numbers \[Assignee: UI/Infra\]  
  * *Subtask:* Write authentication script to block non-whitelisted numbers from querying the bot \[Assignee: Integration Engineer\]  
* **Task: Chatbot Logic & Escalation (Weeks 13-14)**  
  * *Subtask:* Develop lookup parser (detect ISBN vs. Title queries) \[Assignee: Integration Engineer\]  
  * *Subtask:* Format text-only responses detailing ZAR wholesale price and stock \[Assignee: Data Engineer\]  
  * *Subtask:* Implement staff escalation feature (routing unknown queries to human staff) \[Assignee: UI/Infra\]

### **LIST 4: Phase 4 \- Beta Testing & Refinement (Weeks 15-20)**

**Description:** Real-world testing with live data. Exposing edge cases, handling massive supplier files, and hardening the system.

* **Task: Load Testing & Error Handling (Weeks 15-16)**  
  * *Subtask:* Run full historical supplier files through ingestion engine \[Assignee: Data Engineer\]  
  * *Subtask:* Audit and fix dropped rows, bad headers, or API timeout failures \[Assignee: Data Engineer\]  
  * *Subtask:* Monitor Shopify API sync for 7 days to ensure rate limits hold up \[Assignee: Integration Engineer\]  
* **Task: UI/UX Audit (Weeks 17-18)**  
  * *Subtask:* Conduct internal staff mock-sessions on mobile devices \[Assignee: UI/Infra\]  
  * *Subtask:* Fix mobile layout bugs and improve search speed (sub-5 seconds target) \[Assignee: UI/Infra\]  
* **Task: Edge Case Resolution (Weeks 19-20)**  
  * *Subtask:* Resolve metadata conflicts between Google Books and Open Library \[Assignee: Integration Engineer\]  
  * *Subtask:* Test full second-hand and consignment stock flow \[Assignee: Data Engineer\]

### **LIST 5: Phase 5 \- Launch & Onboarding (Weeks 21-24)**

**Description:** Final polish, creating documentation, and transitioning bookstore staff from manual processes to BookBridge.

* **Task: System Documentation (Week 21\)**  
  * *Subtask:* Write Data Schema and API endpoint documentation \[Assignee: Integration Engineer\]  
  * *Subtask:* Write UI manual and troubleshooting guide for staff \[Assignee: UI/Infra\]  
* **Task: Staff Training (Weeks 22-23)**  
  * *Subtask:* Shadow staff during morning receiving to ensure dashboard usage is intuitive \[Assignee: UI/Infra\]  
  * *Subtask:* Address final workflow bottlenecks reported by staff \[Assignee: Data Engineer\]  
* **Task: Official Cut-Over (Week 24\)**  
  * *Subtask:* Officially sunset manual ISBN Express usage \[Assignee: Data Engineer\]  
  * *Subtask:* Activate live Shopify sync for the entire store catalogue \[Assignee: Integration Engineer\]  
  * *Subtask:* Whitelist first 5 external wholesale buyers on WhatsApp Bot \[Assignee: UI/Infra\]