# 🌸 Pain Relief & Heating Pad Survey Web App + Admin Dashboard

A lightweight, modern, responsive web application designed for collecting community feedback on heating pads and pain relief solutions with a dedicated Question-Wise Admin Dashboard.

## 🌐 Live URLs

- **Public Survey Link**: [https://pain-relief-survey.officialzyanix.workers.dev/](https://pain-relief-survey.officialzyanix.workers.dev/)
- **Admin Dashboard**: [https://pain-relief-survey.officialzyanix.workers.dev/admin](https://pain-relief-survey.officialzyanix.workers.dev/admin)

---

## ✨ Features

### 📋 User Survey Form (`/`)
- **Light & Soothing Aesthetic**: Clean white/rose modern theme, responsive on all mobile & desktop screens. Zero watermarks.
- **5 Flexible & Optional Survey Questions**:
  1. **QN1**: "Heating pad se kya period pain mein relief milta hai?" (Yes/No buttons $\rightarrow$ dynamic 1 to 5 relief scale on selecting Yes).
  2. **QN2**: "Aapke according heating pads ke koi flaws, drawbacks ya problems?" (Text feedback).
  3. **QN3**: "Period pain related aisi cheez jo aapko lagta hai market mein honi chahiye but abhi nahi hai?" (Descriptive feedback).
  4. **QN4**: "Alternate solution for pain relief other than heating pad, and why's that?" (One word or brief description).
  5. **QN5**: "Kya aap kisi aur tarah ka pain face karte hain? Pain area batayein aur kya heating pad usme kaam karta hai?" (Descriptive feedback).
- **Optional Contact Details**: Name, Email Address, and WhatsApp / Mobile number.
- **Smooth Submit & Animated Confirmation Screen**.

---

### 📊 Admin Dashboard (`/admin`)
- **Live KPI Overview**:
  - Total Submissions
  - Q1 Yes/No count
  - Average Relief Rating (out of 5)
  - Contacts Shared Count
- **Question-Wise Tabs (QN1 to QN5)**:
  - **QN1 Tab**: Interactive Chart & breakdown of Relief Ratings (1 to 5) vs No relief.
  - **QN2 to QN5 Tabs**: Filtered feed of all verbatim responses for each specific question.
  - **All Submissions Tab**: Full structured cards with respondent name, contact, answers, and timestamp.
- **Live Search**: Instant keyword search across responses and contact details.
- **1-Click CSV / Excel Export**: Download complete dataset in Excel-compatible CSV format (`/api/export`).
- **Data Deletion**: Delete test or spam submissions directly from the dashboard.

---

## 🛠️ Local Setup & Running

```bash
# Clone the repository
git clone https://github.com/ceo-shubham/pain-relief-survey.git
cd pain-relief-survey

# Install dependencies
npm install

# Start local server
npm start
```

Access locally at:
- Survey Form: `http://localhost:3000/`
- Admin Dashboard: `http://localhost:3000/admin`

---

## ☁️ Cloudflare Deployment

Deploy with Cloudflare Workers + KV Storage:

```bash
npx wrangler deploy
```
