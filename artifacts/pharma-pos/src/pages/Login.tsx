import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Stethoscope, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { getApiBase, readJsonError } from "@/lib/api-base";

const API_BASE = getApiBase();

export default function Login() {
  const { login, refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotForm, setForgotForm] = useState({
    username: "",
    phone: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [forgotLoading, setForgotLoading] = useState(false);
  const [regForm, setRegForm] = useState({
    pharmacyName: "", ownerName: "", username: "", password: "",
    phone: "", city: "", address: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.username, loginForm.password);
      toast({ title: "Login successful!", description: "Welcome back!" });
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.pharmacyName || !regForm.ownerName || !regForm.username || !regForm.password || !regForm.phone) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(regForm),
      });
      if (!res.ok) {
        throw new Error(await readJsonError(res));
      }
      await refresh();
      toast({
        title: "Pharmacy registered!",
        description: "Salana subscription fee ada karke activate karwayen — agli screen par tafseel hai.",
      });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: forgotForm.username.trim(),
          phone: forgotForm.phone.trim(),
          newPassword: forgotForm.newPassword,
        }),
      });
      if (!res.ok) {
        throw new Error(await readJsonError(res));
      }
      const data = (await res.json()) as { message?: string };
      toast({ title: "Password updated", description: data.message || "You can log in with your new password." });
      setForgotOpen(false);
      setForgotForm({ username: "", phone: "", newPassword: "", confirmPassword: "" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Reset failed", description: message, variant: "destructive" });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-2xl mb-4">
            <Stethoscope className="w-10 h-10 text-primary" />
          </div>
          <h1 className="font-display font-extrabold text-3xl text-foreground tracking-tight">Pharmacy POS System</h1>
          <p className="text-muted-foreground mt-2 text-sm">Developed by DevArion Solution</p>
          <a
            href="mailto:contact.devarion@gmail.com"
            className="text-sm text-primary hover:underline mt-1 inline-block"
          >
            contact.devarion@gmail.com
          </a>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-xl shadow-black/5 p-8">
          {/* Toggle */}
          <div className="flex rounded-xl bg-muted p-1 mb-6">
            <button
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === "login" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              onClick={() => setMode("login")}
            >
              <LogIn className="w-4 h-4 inline mr-2" />Login
            </button>
            <button
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === "register" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              onClick={() => setMode("register")}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />Register Pharmacy
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Username</label>
                <Input
                  placeholder="Enter username"
                  value={loginForm.username}
                  onChange={e => setLoginForm(f => ({ ...f, username: e.target.value }))}
                  required autoFocus className="h-12"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Password</label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Enter password"
                    value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    required className="h-12 pr-12"
                  />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:underline"
                    onClick={() => {
                      setForgotForm((f) => ({ ...f, username: loginForm.username }));
                      setForgotOpen(true);
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <Button className="w-full h-12 text-base font-bold mt-2" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Pharmacy Name *</label>
                  <Input placeholder="Al-Shifa Pharmacy" value={regForm.pharmacyName} onChange={e => setRegForm(f => ({...f, pharmacyName: e.target.value}))} required className="h-12" />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Owner Name *</label>
                  <Input placeholder="Dr. Ahmed Khan" value={regForm.ownerName} onChange={e => setRegForm(f => ({...f, ownerName: e.target.value}))} required className="h-12" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Username *</label>
                  <Input placeholder="admin" value={regForm.username} onChange={e => setRegForm(f => ({...f, username: e.target.value}))} required className="h-12" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Password *</label>
                  <Input type="password" placeholder="Strong password" value={regForm.password} onChange={e => setRegForm(f => ({...f, password: e.target.value}))} required className="h-12" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Phone *</label>
                  <Input placeholder="03XX-XXXXXXX" value={regForm.phone} onChange={e => setRegForm(f => ({...f, phone: e.target.value}))} required className="h-12" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">City</label>
                  <Input placeholder="Karachi" value={regForm.city} onChange={e => setRegForm(f => ({...f, city: e.target.value}))} className="h-12" />
                </div>
              </div>
              <Button className="w-full h-12 text-base font-bold" disabled={loading}>
                {loading ? "Registering..." : "Register Pharmacy"}
              </Button>
            </form>
          )}
        </div>

        <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
          <DialogContent className="sm:max-w-md">
            <form onSubmit={handleForgotPassword}>
              <DialogHeader>
                <DialogTitle>Reset password</DialogTitle>
                <DialogDescription>
                  Enter your username and the phone number registered on your account, then choose a new password.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    Username
                  </label>
                  <Input
                    placeholder="Your username"
                    value={forgotForm.username}
                    onChange={(e) => setForgotForm((f) => ({ ...f, username: e.target.value }))}
                    required
                    className="h-11"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    Registered phone
                  </label>
                  <Input
                    placeholder="Same number as pharmacy registration"
                    value={forgotForm.phone}
                    onChange={(e) => setForgotForm((f) => ({ ...f, phone: e.target.value }))}
                    required
                    className="h-11"
                    autoComplete="tel"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    New password
                  </label>
                  <Input
                    type="password"
                    placeholder="At least 6 characters"
                    value={forgotForm.newPassword}
                    onChange={(e) => setForgotForm((f) => ({ ...f, newPassword: e.target.value }))}
                    required
                    minLength={6}
                    className="h-11"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    Confirm new password
                  </label>
                  <Input
                    type="password"
                    placeholder="Repeat new password"
                    value={forgotForm.confirmPassword}
                    onChange={(e) => setForgotForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    required
                    minLength={6}
                    className="h-11"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={forgotLoading}>
                  {forgotLoading ? "Saving..." : "Update password"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
