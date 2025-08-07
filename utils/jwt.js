import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export const signToken = (payload, options = {}) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d', ...options });
};

export const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};