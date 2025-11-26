# 🚀 Paradocs AI – Smart Document & Presentation Generator

*AI-powered DOCX & PPTX generation with real-time editing, AI regeneration, and a modern TipTap-based editor.*

---

## ✨ Features

### 📝 DOCX Editor

* Google Docs–style editor
* Headings, bold/italic/strike, lists
* Font family & size controls
* Insert images and links
* AI regeneration per section
* Firestore real-time sync

### 📊 PPTX Editor

* Slide manager with preview
* Layouts: Title, Title + Bullets, Title + Image
* Background customization
* AI slide regeneration
* Smooth editor experience

### 🧠 AI Backend

* Gemini 2.5 Flash with StrictJSON
* Fully structured DOCX/PPTX generation
* Clean schemas for outline, sections & slides
* Regenerate endpoints

### 🔒 Authentication

* Firebase Auth (Email/Password)
* Firestore storage
* Draft project support

---

# 📦 Project Structure

```
root/
├── backend/
│   ├── main.py
│   ├── GenerateRequest.py
│   ├── RegenerateRequest.py
│   ├── utils.py
│   ├── call_genai_json.py
│   ├── requirements.txt
│   ├── .env
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── firebase.js
│   │   ├── views/
│   │   │   ├── DashboardView.jsx
│   │   │   ├── ConfigurationView.jsx
│   │   │   ├── OutlineView.jsx
│   │   │   ├── InteractiveViewDocx.jsx
│   │   │   ├── InteractiveViewPpt.jsx
│   │   │   ├── InteractiveRouter.jsx
│   ├── index.css
│   ├── vite.config.js
│   ├── .env
│
├── README.md
```

---

# ⚙️ Installation & Setup

## 1️⃣ Clone the Repo

```bash
git clone https://github.com/YOUR_USERNAME/paradocs-ai.git
cd paradocs-ai
```

---

# 🛠 Backend Setup (FastAPI + Gemini)

## 2️⃣ Create a virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate      # macOS/Linux
venv\Scripts\activate         # Windows
```

## 3️⃣ Install dependencies

```bash
pip install -r requirements.txt
```

---

# 🔐 Backend Environment Variables

Create a `.env` file inside `/backend`:

```env
GOOGLE_API_KEY=YOUR_GEMINI_API_KEY
MODEL_NAME=gemini-2.5-flash
STRUCJSON_DEBUG=false
PORT=8000
```

### Variable descriptions

| Variable          | Description                   |
| ----------------- | ----------------------------- |
| `GOOGLE_API_KEY`  | API key from Google AI Studio |
| `MODEL_NAME`      | Gemini model name             |
| `STRUCJSON_DEBUG` | Enable debug logging          |
| `PORT`            | Backend port                  |

---

# ▶️ Run Backend

```bash
uvicorn main:app --reload --port 8000
```

Backend runs at:

```
http://localhost:8000
```

---

# 🌐 Frontend Setup (React + Vite)

Navigate to:

```bash
cd ../frontend
```

Install packages:

```bash
npm install
```

---

# 🔐 Frontend Environment Variables

Create `.env` inside `/frontend`:

```env
VITE_API_URL=http://localhost:8000

VITE_FIREBASE_API_KEY=YOUR_KEY
VITE_FIREBASE_AUTH_DOMAIN=xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxxx
VITE_FIREBASE_STORAGE_BUCKET=xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxx
VITE_FIREBASE_APP_ID=xxxx
```

---

# ▶️ Run Frontend

```bash
npm run dev
```

Frontend available at:

```
http://localhost:5173/
```

---

# 🎉 You're all set!

Welcome to the future of AI document & presentation generation.
