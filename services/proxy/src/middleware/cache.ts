import type { Request, Response, NextFunction } from 'express';

// 1 hour immutable (for timestamped or stable tiles)
export function immutable1h(_req: Request, res: Response, next: NextFunction) {
  // Only set if not already provided by route
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
  }
  next();
}

// 24 hour immutable (very stable basemap tiles)
export function immutable24h(_req: Request, res: Response, next: NextFunction) {
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  }
  next();
}

// 1 minute short-lived (rapidly updating imagery)
export function shortLived60(_req: Request, res: Response, next: NextFunction) {
  if (!res.getHeader('Cache-Control')) {
    res.setHeader('Cache-Control', 'public, max-age=60');
  }
  next();
}
