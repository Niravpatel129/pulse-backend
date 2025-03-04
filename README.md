# Pulse Backend API

A RESTful API for the Pulse application built with Node.js, Express, and MongoDB.

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

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/pulse-backend.git
   cd pulse-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:
