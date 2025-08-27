# JazzMan Housecalls - Full Stack Application

A complete barber housecall booking system with a modern frontend and robust Node.js backend.

## 🚀 Features

### Frontend
- **Modern, responsive design** with beautiful UI/UX
- **Dynamic service and barber selection** loaded from the database
- **Real-time form validation** and user feedback
- **Mobile-friendly** interface
- **Interactive booking form** with visual selection

### Backend
- **Express.js API** with comprehensive security features
- **SQLite database** with automatic table creation
- **JWT authentication** for admin access
- **Rate limiting** and security middleware
- **Email notifications** (configurable)
- **Admin dashboard** for booking management

## 📁 Project Structure

```
jazzman-backend/
├── config/
│   └── database.js          # Database configuration and setup
├── data/
│   └── jazzman.db          # SQLite database file
├── middleware/
│   └── auth.js             # Authentication middleware
├── public/
│   ├── index.html          # Main frontend (booking form)
│   ├── admin.html          # Admin dashboard
│   └── test.html           # Test page
├── routes/
│   ├── admin.js            # Admin API routes
│   ├── auth.js             # Authentication routes
│   ├── bookings.js         # Booking management routes
│   └── public.js           # Public API routes (services, barbers)
├── utils/
│   └── email.js            # Email utility functions
├── server.js               # Main server file
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### 1. Install Dependencies
```bash
cd jazzman-backend
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key-here
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 3. Start the Application
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

## 🌐 Access Points

- **Frontend (Booking Form)**: http://localhost:3000
- **Admin Dashboard**: http://localhost:3000/admin
- **API Health Check**: http://localhost:3000/api/health
- **API Documentation**: Available at each endpoint

## 📊 Database Schema

### Bookings Table
- `id` - Primary key
- `customer_name` - Customer's full name
- `customer_email` - Customer's email (optional)
- `customer_phone` - Customer's phone number
- `address` - Service address
- `preferred_datetime` - Preferred appointment time
- `service_type` - Selected service
- `service_price` - Service price
- `barber_name` - Assigned barber
- `barber_phone` - Barber's phone
- `status` - Booking status (pending, confirmed, completed, cancelled)
- `notes` - Additional notes
- `created_at` - Creation timestamp
- `updated_at` - Last update timestamp

### Services Table
- `id` - Primary key
- `name` - Service name
- `price` - Service price
- `description` - Service description
- `is_active` - Service availability

### Barbers Table
- `id` - Primary key
- `name` - Barber's name
- `phone` - Barber's phone number
- `email` - Barber's email
- `is_active` - Barber availability

## 🔌 API Endpoints

### Public Endpoints (No Authentication Required)
- `GET /api/services` - Get all active services
- `GET /api/barbers` - Get all active barbers
- `POST /api/bookings` - Create a new booking
- `GET /api/health` - Health check

### Admin Endpoints (Authentication Required)
- `GET /api/admin/bookings` - Get all bookings
- `PATCH /api/admin/bookings/:id/status` - Update booking status
- `GET /api/admin/stats` - Get booking statistics

### Authentication Endpoints
- `POST /api/auth/login` - Admin login
- `POST /api/auth/register` - Admin registration

## 🧪 Testing

Run the integration test to verify everything is working:
```bash
node test-integration.js
```

## 🔧 Default Credentials

### Admin Access
- **Username**: admin
- **Password**: admin123
- **Email**: admin@jazzman.com

⚠️ **Important**: Change these credentials in production!

### Default Services
- Bespoke haircut - KSh 3,000
- Scissor cut - KSh 3,500
- Bald haircut - KSh 2,000
- Bald haircut with razor - KSh 2,500
- Kids' Haircut - KSh 2,000
- Senior Citizen Haircut - KSh 2,500

### Default Barbers
- Joseph - 254700888530
- Yusuph - 254113757415
- David - 254116017256

## 🚀 Deployment

### Production Considerations
1. **Change default passwords** in the database
2. **Set up proper environment variables**
3. **Configure email settings** for notifications
4. **Set up SSL/HTTPS**
5. **Configure proper CORS settings**
6. **Set up database backups**

### Docker Deployment (Optional)
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support or questions:
- Email: support@jazzman.com
- Phone: +254 700 888 530

---

**JazzMan Housecalls** - Bringing the barbershop to your door! ✂️
