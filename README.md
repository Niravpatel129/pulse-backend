# Pulse Backend

The backend infrastructure powering [HourBlock](https://hourblock.com) - a modern project and time management platform.

## Overview

This repository contains the backend API and server infrastructure for HourBlock. The main application can be accessed at [hourblock.com](https://hourblock.com).

## Tech Stack

- Node.js
- MongoDB with Mongoose
- Express.js
- RESTful API architecture

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/pulse-backend.git
cd pulse-backend
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server

```bash
npm run dev
```

## API Documentation

API documentation is available at `/api/docs` when running the development server.

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting any pull requests.

## License

This project is proprietary software. All rights reserved.

## Contact

For any inquiries, please reach out to our team at support@hourblock.com

## Table of Contents

- [Pulse Backend API](#pulse-backend-api)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)

## Features

- User authentication with JWT
- Password hashing with bcrypt
- MongoDB database integration
- RESTful API design
- Input validation with Joi
- Authentication middleware with Passport

## Environment Variables

Create a `.env` file in the root directory with the following variables:
