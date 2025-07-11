/**
 * CSRF Token API Endpoint
 *
 * This endpoint provides CSRF tokens to clients for secure form submissions.
 * It generates a new token and sets it as an HTTP-only cookie.
 */

import { NextRequest } from "next/server";
import { generateCSRFTokenResponse } from "../../../middleware/csrfProtection";

/**
 * GET /api/csrf-token
 *
 * Generates and returns a new CSRF token.
 * The token is also set as an HTTP-only cookie for automatic inclusion in requests.
 */
export function GET(request: NextRequest) {
  return generateCSRFTokenResponse();
}