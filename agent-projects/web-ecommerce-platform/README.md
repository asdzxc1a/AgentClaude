# 🌐 E-Commerce Platform - Web Development Agent Demo

## Project Overview
Modern e-commerce platform demonstrating full-stack web development with React frontend, Node.js backend, and PostgreSQL database. This project showcases typical web development tasks that generate observable events.

## Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │────│  Express API    │────│  PostgreSQL DB  │
│   (Port 3000)   │    │   (Port 8000)   │    │   (Port 5432)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────────┐
                    │ Observability   │
                    │ Event Capture   │
                    └─────────────────┘
```

## Key Components

### Frontend (React)
- **Product Catalog**: Browse and search products
- **Shopping Cart**: Add/remove items, manage quantities
- **User Authentication**: Login, registration, profile management
- **Checkout Process**: Payment integration and order confirmation
- **Admin Dashboard**: Product management, order tracking

### Backend (Node.js/Express)
- **Authentication API**: JWT-based user authentication
- **Product API**: CRUD operations for product management
- **Order API**: Order creation, tracking, and fulfillment
- **Payment API**: Stripe integration for payment processing
- **Admin API**: Administrative functions and analytics

### Database (PostgreSQL)
- **Users Table**: Customer and admin accounts
- **Products Table**: Product catalog with categories
- **Orders Table**: Order history and status tracking
- **Cart Table**: Shopping cart persistence
- **Analytics Table**: User behavior and sales metrics

## Typical Agent Tasks

### Component Development
```bash
# Create new React component
npx create-react-component ProductCard
npm test -- ProductCard.test.js
npm run lint:fix
```

### API Development
```bash
# Add new API endpoint
touch server/routes/analytics.js
npm run test:api
npm run db:migrate
```

### Database Operations
```bash
# Database migrations
npm run db:migrate
npm run db:seed
psql -d ecommerce_dev -c "SELECT * FROM products LIMIT 5;"
```

### Testing & Quality Assurance
```bash
# Run test suite
npm test
npm run test:coverage
npm run lint
npm run build
```

## Observable Events Generated

This project generates rich observability data:

- **PreToolUse**: npm commands, git operations, database queries
- **PostToolUse**: Build results, test outcomes, deployment status
- **UserPromptSubmit**: Feature requests, bug reports, optimization tasks
- **Notification**: Build completions, test failures, deployment alerts

## Development Workflow

1. **Feature Development**: Create React components and API endpoints
2. **Database Management**: Migrations, seeds, and query optimization
3. **Testing**: Unit tests, integration tests, E2E testing
4. **Build & Deploy**: Production builds, Docker containerization
5. **Monitoring**: Performance analysis, error tracking, user analytics

## Getting Started

```bash
# Install dependencies
npm install

# Set up database
createdb ecommerce_dev
npm run db:migrate
npm run db:seed

# Start development servers
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Environment Variables
```env
DATABASE_URL=postgresql://localhost:5432/ecommerce_dev
JWT_SECRET=your_jwt_secret_here
STRIPE_SECRET_KEY=sk_test_...
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

This project provides a realistic web development scenario where Claude Code agents can demonstrate:
- Frontend/backend coordination
- Database-driven development
- Testing and quality assurance
- Performance optimization
- Security implementation