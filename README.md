# BridgeBooks UI

A modern book management and discovery platform built with **React**, **Vite**, and **Tailwind CSS v4**.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Project Structure

```
src/
├── components/       # Reusable UI components (Button, SearchBar, Layout)
├── pages/            # Route-level page components (Login, Dashboard, Search)
├── services/         # API & backend communication logic
├── main.jsx          # Application entry point
├── App.jsx           # Root component with routing
└── index.css         # Tailwind CSS + design system tokens
```

## Routes

| Path         | Page        | Description                       |
| ------------ | ----------- | --------------------------------- |
| `/`          | —           | Redirects to `/dashboard`         |
| `/login`     | Login       | Authentication screen             |
| `/dashboard` | Dashboard   | Overview stats & recent activity  |
| `/search`    | Search      | Book catalogue search & browse    |

## Tech Stack

- **Vite** — Lightning-fast dev server & bundler
- **React 19** — UI library
- **React Router DOM** — Client-side routing
- **Tailwind CSS v4** — Utility-first CSS framework (via `@tailwindcss/vite`)

## Environment Variables

Copy `.env.example` to `.env.local` and set:

| Variable              | Description              | Default                          |
| --------------------- | ------------------------ | -------------------------------- |
| `VITE_API_BASE_URL`   | Backend API base URL     | `http://localhost:3001/api`      |

## Contributing

1. Create a feature branch from `main`
2. Follow the folder conventions above
3. Run `npm run dev` to test locally
4. Open a pull request for review
