import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_PREFIXES: Record<string, string> = {
  owner: "/owner",
  manager: "/manager",
  vendor: "/vendor",
  admin: "/admin",
};

const ROLE_HOME: Record<string, string> = {
  owner: "/owner",
  manager: "/manager",
  vendor: "/vendor",
  admin: "/admin",
};

const PUBLIC_PATHS = ["/login", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip public assets
  if (
    path.startsWith("/_next/") ||
    path.startsWith("/api/") ||
    path.includes(".") ||
    PUBLIC_PATHS.some((p) => path.startsWith(p))
  ) {
    if (!path.startsWith("/login")) {
      return NextResponse.next();
    }
  }

  const { supabase, user, response } = await updateSession(request);

  // 1. Not logged in → redirect to /login
  if (!user && !path.startsWith("/login")) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Logged in but on /login → redirect to role home
  if (user && path.startsWith("/login")) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "manager";
    return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
  }

  // 3. Role-based access control
  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = profile?.role;

    if (userRole) {
      // Check if user is accessing a role-specific route that isn't theirs
      for (const [role, prefix] of Object.entries(ROLE_PREFIXES)) {
        if (path.startsWith(prefix) && role !== userRole) {
          return NextResponse.redirect(
            new URL(ROLE_HOME[userRole], request.url)
          );
        }
      }
    }

    // Root path → redirect to role home
    if (path === "/") {
      const role = userRole || "manager";
      return NextResponse.redirect(new URL(ROLE_HOME[role], request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
