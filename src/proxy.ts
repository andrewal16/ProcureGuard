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

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Skip public assets and APIs
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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let userRole: string | undefined;

  if (user) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    userRole = profile?.role;
  }

  const hasKnownRole = Boolean(userRole && ROLE_HOME[userRole]);

  // 2. Logged in on /login → redirect to role home only when role is valid.
  // If profile is missing/invalid, keep user at /login to avoid redirect loop.
  if (user && path.startsWith("/login")) {
    if (hasKnownRole) {
      return NextResponse.redirect(new URL(ROLE_HOME[userRole!], request.url));
    }

    return response;
  }

  // 3. Logged in user without valid profile role trying to access dashboard route.
  // Send to /login so they can re-authenticate without infinite redirects.
  if (user && !hasKnownRole && !path.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 4. Role-based access control for known roles
  if (user && hasKnownRole) {
    for (const [role, prefix] of Object.entries(ROLE_PREFIXES)) {
      if (path.startsWith(prefix) && role !== userRole) {
        return NextResponse.redirect(new URL(ROLE_HOME[userRole!], request.url));
      }
    }

    // Root path → redirect to role home
    if (path === "/") {
      return NextResponse.redirect(new URL(ROLE_HOME[userRole!], request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
