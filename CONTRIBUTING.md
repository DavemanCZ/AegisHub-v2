# Contributing to Aegis Hub

We welcome contributions from the community! Whether you are fixing bugs, improving the UI, or adding new features to the Go backend, your help is appreciated.

## Getting Started

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally.

## Development Environment

### Frontend (React/Vite)
The frontend is located in the `frontend/` directory.
```bash
cd frontend
npm install
npm run dev
```

### Backend (Go)
The backend is located in the `backend/` directory.
```bash
cd backend
go mod download
go run main.go
```
*Note: You will need a local PostgreSQL database running and a local `.env` file configured for the backend to connect successfully.*

## Code Style
- **Frontend:** Follow strict TypeScript guidelines. Use Prettier for formatting. Ensure all new components utilize the existing CSS variable design system (glassmorphism tokens) found in `index.css`.
- **Backend:** Follow standard `gofmt` and idiomatic Go practices. 

## Submitting a Pull Request
1. Create a feature branch: `git checkout -b feature/my-new-feature`
2. Commit your changes: `git commit -m 'Add some feature'`
3. Push to the branch: `git push origin feature/my-new-feature`
4. Open a Pull Request against the `main` branch.

Please ensure your PR describes the problem you are solving and any architectural implications, especially concerning cryptography.
