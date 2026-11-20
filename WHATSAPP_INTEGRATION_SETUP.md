# Pradeep Classes Management Platform — WhatsApp Integration Setup Guide

**Architecture:** Meta WhatsApp Cloud API (Official Graph API v18.0+)  
**Notification Scope:** Daily Attendance (Present, Absent, Late, Leave), Fee Payment Receipts, and Published Exam Results  
**Database Queue:** `public.whatsapp_message_queue`  
**Configuration Table:** `public.whatsapp_settings`  

---

## 1. Meta Developer & WhatsApp Business Setup

To enable live WhatsApp delivery to students and parents, complete these steps in Meta Business Manager:

### Step 1: Create Meta Developer App
1. Go to [developers.facebook.com](https://developers.facebook.com/) and log in with your Facebook business account.
2. Click **Create App** and select **Business** as the app type.
3. Name your app (e.g., `Pradeep Classes Notifications`).
4. Add the **WhatsApp** product to your app.

### Step 2: Retrieve API Credentials
From the WhatsApp > **API Setup** dashboard:
1. **WhatsApp Business Account ID (WABA ID):** Copy your 15-16 digit account ID.
2. **Phone Number ID:** Copy the 15-digit ID associated with your sender phone number.
3. **Verified Sender Phone Number:** Enter and verify your institute's official mobile/landline number via SMS/voice OTP.
4. **Permanent System User Access Token:**
   - In Meta Business Settings > **Users** > **System Users**, create an Admin system user (e.g., `pradeep-classes-worker`).
   - Assign the app with permissions `whatsapp_business_messaging` and `whatsapp_business_management`.
   - Click **Generate Token** and select expiration: **Never**.

---

## 2. Notification Message Templates

Create the following message templates in Meta WhatsApp Message Template Manager:

### 2.1. Attendance Templates
- **Template Name:** `pc_attendance_present`  
  - **Category:** Utility  
  - **Language:** English (`en_US`)  
  - **Body Text:**  
    `Hello {{1}}, your attendance at Pradeep Classes has been marked PRESENT for {{2}}. Batch: {{3}}. Keep up the consistent effort!`
- **Template Name:** `pc_attendance_absent`  
  - **Category:** Utility  
  - **Language:** English (`en_US`)  
  - **Body Text:**  
    `Hello {{1}}, your attendance at Pradeep Classes has been marked ABSENT for {{2}}. Batch: {{3}}. Please contact the institute administration if this is incorrect.`
- **Template Name:** `pc_attendance_late`  
  - **Category:** Utility  
  - **Language:** English (`en_US`)  
  - **Body Text:**  
    `Hello {{1}}, your attendance at Pradeep Classes has been marked LATE for {{2}}. Please arrive on time for upcoming classroom sessions.`
- **Template Name:** `pc_attendance_leave`  
  - **Category:** Utility  
  - **Language:** English (`en_US`)  
  - **Body Text:**  
    `Hello {{1}}, your attendance at Pradeep Classes has been marked as LEAVE for {{2}}. Make sure to review study materials for missed topics.`

### 2.2. Fee Receipt Template
- **Template Name:** `pc_fee_receipt`  
  - **Category:** Utility  
  - **Language:** English (`en_US`)  
  - **Body Text:**  
    `Hello {{1}}, we have received your payment of Rs. {{2}} for {{3}}. Receipt No: {{4}}. Outstanding balance: Rs. {{5}}. Thank you for choosing Pradeep Classes.`

### 2.3. Exam Scorecard Template
- **Template Name:** `pc_exam_result`  
  - **Category:** Utility  
  - **Language:** English (`en_US`)  
  - **Body Text:**  
    `Hello {{1}}, results for {{2}} (Subject: {{3}}) have been published. Score: {{4}}/{{5}} ({{6}}%). Grade: {{7}}, Rank: #{{8}}. View your complete scorecard on the student portal.`

---

## 3. Configuring the Application

1. Sign in to `app.pradeepclasses.in` as an **Owner** account.
2. In the navigation sidebar, click **Settings**.
3. Select the **WhatsApp Cloud API Integration** tab.
4. Enter:
   - **Phone Number ID:** (from Meta Dashboard)
   - **WhatsApp Business Account ID (WABA ID):** (from Meta Dashboard)
   - **System User Access Token:** (permanent EAAG... token)
   - **Verified Phone Number:** (e.g., `+91 98765 43210`)
5. Enable or disable specific trigger alerts as needed.
6. Toggle **Test Mode**:
   - **Test Mode ON (Default):** Messages are safely stored in `whatsapp_message_queue` and marked `skipped_test_mode`. This allows full administrative testing without live API keys or Meta message charges.
   - **Test Mode OFF (Production):** The queue dispatcher delivers messages live to student mobile numbers via Meta Graph API.
7. Click **Save WhatsApp Settings**.

---

## 4. Monitoring the Dispatch Queue

Administrative staff can monitor real-time WhatsApp dispatches:
1. Navigate to **Announcements** in the sidebar.
2. Click the **WhatsApp Notification Dispatcher** tab.
3. Review message rows:
   - **Recipient Phone:** Destination number with country code.
   - **Student:** Enrolled student name.
   - **Template / Type:** `present`, `absent`, `late`, `fee_receipt`, `exam_result`.
   - **Status:** `pending`, `sent`, `failed`, or `skipped_test_mode`.
   - **Attempts:** Number of delivery tries (maximum 3).
   - **Actions:** Click **Retry** on failed or skipped messages to trigger immediate re-dispatch.

---

## 5. Deduplication & Concurrency Protection

To guarantee that duplicate messages are never sent even if roll call is saved multiple times:
- The database enforces a unique composite constraint on:
  `(institute_id, student_id, phone_number, message_type, session_date)`
- Subsequent submissions on the same day perform an `ON CONFLICT DO NOTHING`, safely preserving the original delivery record.
