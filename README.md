# PennyPal Backend - Docker Deployment Tutorial

## 🐳 Docker Setup

### Prerequisites
- Docker Desktop installed
- Git installed
- GitHub account with access to Core-KADA-2025/PennyPal repository

### 1. Local Development with Docker

```bash
# Build and run with docker-compose
docker-compose up --build

# Run in background
docker-compose up -d

# Stop services
docker-compose down
```

### 2. Manual Docker Build

```bash
# Build image
docker build -t pennypal-backend .

# Run container
docker run -p 3000:3000 pennypal-backend
```

## 📦 GitHub Deployment

### Push to GitHub Repository

1. **Clone or initialize repository:**
```bash
# If starting fresh
git init
git remote add origin https://github.com/Core-KADA-2025/PennyPal.git

# If cloning
git clone https://github.com/Core-KADA-2025/PennyPal.git
cd PennyPal
```

2. **Switch to Backend branch:**
```bash
# Create and switch to Backend branch
git checkout -b Backend

# Or switch if branch exists
git checkout Backend
```

3. **Add and commit files:**
```bash
git add .
git commit -m "feat: add Docker setup for backend deployment"
```

4. **Push to GitHub:**
```bash
# First time push
git push -u origin Backend

# Subsequent pushes
git push
```

### 🚀 Quick Deployment

**Option 1: Use Deployment Script (Recommended)**

```bash
# Windows
deploy.bat

# Linux/Mac
./deploy.sh
```

**Option 2: Manual Deployment**

```bash
# Switch to Backend branch
git checkout -b Backend

# Add and commit
git add .
git commit -m "deploy: Docker setup for backend"

# Push to GitHub
git push -u origin Backend
```

### 🚀 Automatic Docker Build

The GitHub Actions workflow will automatically:
- Build Docker image when you push to `Backend` branch
- Push image to GitHub Container Registry (ghcr.io)
- Tag as `latest`
- Available at: `ghcr.io/core-kada-2025/pennypal:latest`

### 🔧 Environment Variables

Create `.env` file with:
```env
MONGODB_URI=mongodb://localhost:27017/pennypal
PORT=3000
NODE_ENV=development
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 📋 Production Deployment

**Using Production Docker Compose:**

```bash
# Create .env file for production
echo "MONGODB_URI=mongodb://mongo:27017/pennypal" > .env
echo "JWT_SECRET=your-production-jwt-secret" >> .env
echo "GOOGLE_CLIENT_ID=your-google-client-id" >> .env
echo "GOOGLE_CLIENT_SECRET=your-google-client-secret" >> .env

# Deploy with production compose
docker-compose -f docker-compose.prod.yml up -d
```

**Manual Docker Run:**

```bash
# Pull from GitHub Container Registry
docker pull ghcr.io/core-kada-2025/pennypal:latest

# Run the image
docker run -p 3000:3000 \
  -e MONGODB_URI=your-mongodb-uri \
  -e JWT_SECRET=your-jwt-secret \
  ghcr.io/core-kada-2025/pennypal:latest
```

### 🏥 Health Check

The Docker container includes a health check endpoint:
- URL: `http://localhost:3000/health`
- Checks every 30 seconds
- 3 retries before marking unhealthy

### 📁 Project Structure

```
PennyPal-Backend/
├── controllers/     # Business logic
├── models/         # Database models
├── routes/         # API endpoints
├── middlewares/    # Custom middleware
├── services/       # External services
├── utils/          # Helper functions
├── dockerfile      # Docker configuration
├── docker-compose.yml # Multi-container setup
└── .github/workflows/deploy.yml # CI/CD pipeline
```