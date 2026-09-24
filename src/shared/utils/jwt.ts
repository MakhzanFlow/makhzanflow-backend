import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

export interface TokenPayload {
  id: string;
  email: string;
  purpose: 'access' | 'refresh';
}

export const generateAccessToken = (payload: { id: string; email: string }): string => {
  return jwt.sign({ ...payload, purpose: 'access' }, env.JWT_SECRET, { expiresIn: '15m', issuer: 'makhzanflow', audience: 'makhzanflow-api' });
};

export const generateRefreshToken = (payload: { id: string; email: string }): string => {
  return jwt.sign({ ...payload, purpose: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: '30d', issuer: 'makhzanflow', audience: 'makhzanflow-api' });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'makhzanflow', audience: 'makhzanflow-api' }) as any;
  if (decoded?.purpose !== 'access') {
    throw new jwt.JsonWebTokenError('Invalid token purpose');
  }
  return decoded as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'makhzanflow', audience: 'makhzanflow-api' }) as any;
  if (decoded?.purpose !== 'refresh') {
    throw new jwt.JsonWebTokenError('Invalid token purpose');
  }
  return decoded as TokenPayload;
};
