# Zavi Asset Hub 📦🔧

Zavi Asset Hub is a modern, high-performance, and beautifully styled asset and inventory tracking system. Designed for engineering environments, teams, and garage managers, it features real-time inventory updates, QR code camera scanning, label print queues, and multi-location tracking.

---

## Key Features

- **Double-Mode Inventory Directory:**
  - **Grouped View:** Consolidates identical items (SKU/Name matches) across multiple locations into a single row showing total stock, low stock warnings, and an inline collapsible garage breakdown with location-specific adjusters.
  - **Individual View:** Displays raw serialized physical tags.
- **Webcam & Camera Scan (QR System):**
  - Integrated QR scanner supporting device cameras, instant check-in/out, stock adjustments, and a quick **Edit Location** route directly from scan results to re-assign physical devices.
- **Access Controls & User Administration:**
  - Standard users can change their own passwords.
  - User password resets for other team members are strictly restricted to **Administrator** accounts.
- **Flexible Deployment Options:**
  - Full local development hot-reload support.
  - Docker Compose packaging.
  - Capacitor Android app wrapper with camera zoom and auto-focus fixes.
- **Configurable Connection Endpoint:**
  - Simple interface to input and save default API connection URLs to bridge the native wrapper app with the production server.
- **Label Print Queue:**
  - Add assets to a print queue to generate clean, scan-ready layout labels with custom QR codes.

---

## Tech Stack

### Frontend
- **Framework:** React + Vite
- **Styling:** Custom HSL-tailored CSS with a high-fidelity glassmorphism dark theme, custom glows, and micro-animations.
- **Icons:** Lucide React

### Backend
- **Server:** Node.js + Express
- **Database:** SQLite (persisted locally)
- **Encryption:** bcryptjs (secure user passwords)

### Native Mobile Wrapper
- **Framework:** Capacitor (Android targets)

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- npm (v9+)
- *Optional:* Docker & Docker Compose (for containerized hosting)

### 2. Local Development Setup

To install dependencies across the root, frontend, and backend packages:
```bash
npm run install-all
```

To run both the backend server (port 5000) and the Vite frontend dev server (port 5173) concurrently:
```bash
npm run dev
```

The app will be accessible at `http://localhost:5173/`.

### 3. Docker Deployment

Deploying the stack with a persistent volume for the database is simple:
```bash
docker-compose up -d --build
```
This serves the application on port `5000` (exposing backend endpoints at `/api` and serving static frontend production files directly from `/`).

---

## Configuration & Environment Variables

The server behaves based on the following variables:
* `PORT` (Default: `5000`) - Port the Express server listens on.
* `DATABASE_PATH` (Default: `server/data/inventory.db`) - Absolute path to persist the SQLite database.
* `JWT_SECRET` - Key used to sign authorization tokens.

---

## Compiling for Android (Capacitor)

To compile the React web application assets and sync them with the native Android wrapper:

1. Build the production package inside the `frontend` folder:
   ```bash
   cd frontend
   npm run build
   ```
2. Sync compiled assets with the Android Studio workspace:
   ```bash
   npx cap sync
   ```
3. Open the Android project in Android Studio to run on devices or compile the production APK:
   ```bash
   npx cap open android
   ```
