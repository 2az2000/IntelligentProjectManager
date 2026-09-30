import 'express';

export interface AuthUser {
  id: number;
}

declare module 'http' {
  interface IncomingMessage {
    id?: string | number | object;
  }
}

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth. */
      user?: AuthUser;
    }
  }
}
