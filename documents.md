#Purpose.

Small application with the intention of automating the scheduling events, set avilability, and sending invite to customers.

##Requirements:
### 1. Database -> Table -> Name: "Assets"
**Purpose:** To store inventory sets, quantities, and pricing.

| Column Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `asset_id` | `VARCHAR(36)` / `UUID` | Primary Key, Auto-generated | Unique identifier for the asset |
| `asset_name` | `VARCHAR(100)` | NOT NULL, Unique | Name of the set/item |
| `asset_amount` | `INT` | NOT NULL, DEFAULT 0 | Total quantity available in inventory |
| `asset_color` | `VARCHAR(50)` | Nullable | Primary color scheme or theme |
| `asset_measures` | `VARCHAR(100)` | Nullable | Dimensions or size specifications |
| `asset_price` | `DECIMAL(10,2)` | NOT NULL | Rental price per event |

---

### 2. Database -> Table -> Name: "Events"
**Purpose:** To store customer booking and payment tracking information.

| Column Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `event_no` | `INT` / `VARCHAR(20)` | Primary Key, Auto-increment | Unique tracking number for the event able to be set by every business owner|
| `customer_name` | `VARCHAR(150)` | NOT NULL | Full name of the client |
| `customer_phone` | `VARCHAR(20)` | NOT NULL | Contact telephone number |
| `customer_email` | `VARCHAR(255)` | Nullable, Valid Email | Client email address for automated invites |
| `event_address` | `TEXT` | NOT NULL | Venue location address |
| `notes` | `TEXT` | Nullable | Special instructions or setup notes |
| `date` | `DATE` | NOT NULL | Scheduled event date (YYYY-MM-DD) |
| `start_time` | `TIME` | NOT NULL | Event start time |
| `end_time` | `TIME` | NOT NULL | Event end time |
| `asset_id` | `VARCHAR(36)` | Foreign Key -> `Assets.asset_id` | The specific set/asset being rented |
| `down_payment_amount` | `DECIMAL(10,2)` | DEFAULT 0.00 | Deposit paid upfront |
| `payment_complete` | `BOOLEAN` | DEFAULT FALSE | Flag indicating if fully paid |
| `pending_payment` | `DECIMAL(10,2)` | Calculated / Stored | Balance remaining |
| `discount` | `DECIMAL(10,2)` | DEFAULT 0.00 | Applied discount amount |
| `rent_total_price` | `DECIMAL(10,2)` | NOT NULL | Final calculated total price |

### 3. Database -> Table -> Name: "Purchases"
**Purpose:** To store inventory sets purchases, price, and provider.

| Column Name | Data Type | Constraints / Attributes | Description |
| :--- | :--- | :--- | :--- |
| `purchase_id` | `VARCHAR(36)` / `UUID` | Primary Key, Auto-generated | Unique identifier for the purchase record |
| `asset_name` | `VARCHAR(100)` | NOT NULL | Name of the set/item being purchased |
| `quantity` | `INT` | NOT NULL, DEFAULT 1 | Number of units purchased |
| `provider` | `VARCHAR(150)` | NOT NULL | Name or vendor ID of the supplier |
| `asset_color` | `VARCHAR(50)` | Nullable | Primary color scheme or theme of the purchased items |
| `asset_measures` | `VARCHAR(100)` | Nullable | Dimensions or size specifications |
| `purchase_status` | `ENUM` / `VARCHAR(50)` | NOT NULL, DEFAULT 'pending purchase' | Status options: 'pending purchase', 'paid', 'in delivery', 'received', 'completed' |
| `price` | `DECIMAL(10,2)` | NOT NULL | Unit price per item |
| `total_amount` | `DECIMAL(10,2)` | Calculated / Stored | Total cost (`price` times `quantity`) |

## 4. Authentication & User Flow

### Step 4.1: Landing & Authentication
- **Provider:** Google OAuth (future-proofing placeholders for Apple and Microsoft can be omitted or noted for later).
- **Behavior:** Upon successful login, redirect the user to a main dashboard containing three core action options.

### Step 5: Main Dashboard Options
1. **Register Purchases:** 
   - A form interface to insert records into the `Purchases` table (capturing item name, quantity, provider, color, measures, status, price, and auto-calculating total amount).
2. **Set Setup (Inventory Bundling):** 
   - An interface fed by the `Purchases` table items. 
   - Allows business owners to bundle individual purchased items into logical "Sets" (e.g., *Set Cisne* containing specific assets) and define rental prices for each set.
3. **Register Customer & Event:** 
   - An interface to book an event, feeding directly into the `Events` table.
   - Includes a trigger button to **Send Invite via Google Calendar**, which simultaneously sends calendar invites to the business owner and the `customer_email`.

   ## 5. Google Calendar Integration Specifications

- **Calendar Event Title Format:** 
  `[Business Name] - [Customer Name] - [Customer Phone]`
  *(Example: BebecitosGdl - Carlos Antonio Rodriguez Almanza - 3322574249)*[cite: 1]

- **Event Timing:** 
  - Date, start time, and end time mapped directly from the `Events` table (`date`, `start_time`, `end_time`)[cite: 1].
  - Set reminders for **2 hours before** and **1 day before** the event[cite: 1].

- **Calendar Event Body Template (Description Markdown):**
  When building the Google Calendar API payload, format the event description block using this exact structure:

  ```text
  Cliente: [customer_name]
  Teléfono: [customer_phone]
  Correo: [customer_email]
  Dirección: [event_address]
  Fecha: [date]
  Horario: [start_time] - [end_time]

  📦 Mobiliario:
  - [List of items included in the chosen Set based on Set Setup]

  Notas: [notes]
  💰 Anticipo = $[down_payment_amount]
  💰 Descuentos = $[discount]
  💰 Pago Pendiente = $[pending_payment]
  💰 Renta Total = $[rent_total_price]
