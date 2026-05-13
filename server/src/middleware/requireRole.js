import { StatusCodes } from "http-status-codes";
import { httpError } from "../utils/httpError.js";

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return next(httpError(StatusCodes.FORBIDDEN, "You do not have access to this resource"));
    }
    next();
  };
}

