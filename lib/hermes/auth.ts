import { NextRequest, NextResponse } from "next/server";

export function authenticateHermesRequest(request: NextRequest): { authenticated: boolean; errorResponse?: NextResponse } {
  const configuredApiKey = process.env.HERMES_API_KEY;

  // If no HERMES_API_KEY configured in environment, allow access (or optional auth)
  if (!configuredApiKey || !configuredApiKey.trim()) {
    return { authenticated: true };
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return {
      authenticated: false,
      errorResponse: NextResponse.json(
        {
          code: 401,
          message: "Unauthorized: missing Authorization header with Bearer token",
          data: null,
        },
        { status: 401 }
      ),
    };
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].trim() !== configuredApiKey.trim()) {
    return {
      authenticated: false,
      errorResponse: NextResponse.json(
        {
          code: 401,
          message: "Unauthorized: invalid or expired HERMES_API_KEY",
          data: null,
        },
        { status: 401 }
      ),
    };
  }

  return { authenticated: true };
}
