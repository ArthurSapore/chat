import type { NextFunction, Request, Response } from "express"

import type { AuthService } from "@/modules/auth/auth-service"
import { AppError } from "@/shared/errors"

/** Exige `Authorization: Bearer <token>` e guarda o usuário em `res.locals`. */
export function requireAuth(authService: AuthService) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : null

    const user = authService.verifyToken(token)
    if (!user) throw AppError.unauthorized()

    res.locals.userId = user.userId
    next()
  }
}

/** Lê o userId garantido pelo `requireAuth`. */
export function authUserId(res: Response): string {
  const userId: unknown = res.locals.userId
  if (typeof userId !== "string") throw AppError.unauthorized()
  return userId
}
