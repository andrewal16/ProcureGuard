"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, Eye, EyeOff } from "lucide-react";

const ROLE_HOME: Record<string, string> = {
  owner: "/owner",
  manager: "/manager",
  vendor: "/vendor",
  admin: "/admin",
};

const DEMO_ACCOUNTS = [
  { email: "owner@procureguard.demo", role: "Owner", color: "bg-purple-100 text-purple-700" },
  { email: "manager.jkt@procureguard.demo", role: "Manager Jakarta", color: "bg-blue-100 text-blue-700" },
  { email: "manager.bdg@procureguard.demo", role: "Manager Bandung", color: "bg-blue-100 text-blue-700" },
  { email: "vendor.tepung@procureguard.demo", role: "Vendor", color: "bg-green-100 text-green-700" },
  { email: "admin@procureguard.demo", role: "Admin / Finance", color: "bg-gray-100 text-gray-700" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message === "Invalid login credentials"
        ? "Email atau password salah. Coba gunakan salah satu akun demo di bawah."
        : authError.message
      );
      setIsLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Session login tidak ditemukan. Coba login ulang.");
      setIsLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const redirectPath = profile?.role ? ROLE_HOME[profile.role] : undefined;

    if (!redirectPath) {
      setError("Role akun tidak valid. Hubungi admin.");
      await supabase.auth.signOut();
      setIsLoading(false);
      return;
    }

    router.refresh();
    router.replace(redirectPath);
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("password123");
    setError(null);
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">ProcureGuard</CardTitle>
          <CardDescription>Transparent Procurement System</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Masuk...
                </>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Demo Accounts (password: password123)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              onClick={() => fillDemo(acc.email)}
              className="flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm hover:bg-gray-50 transition-colors"
            >
              <span className="font-mono text-xs truncate mr-2">{acc.email}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${acc.color}`}>
                {acc.role}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
