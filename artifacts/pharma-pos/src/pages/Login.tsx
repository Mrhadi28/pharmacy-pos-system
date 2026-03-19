import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Stethoscope, Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export default function Login() {
  const { login, refresh } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
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
        const err = await res.json();
        throw new Error(err.error || "Registration failed");
      }
      await refresh();
      toast({ title: "Pharmacy registered!", description: `Welcome to PharmaPOS, ${regForm.pharmacyName}!` });
    } catch (err: any) {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
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
          <h1 className="font-display font-extrabold text-3xl text-foreground tracking-tight">PharmaPOS</h1>
          <p className="text-muted-foreground mt-1">Pakistan's Pharmacy Management System</p>
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
              </div>
              <Button className="w-full h-12 text-base font-bold mt-2" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>
              <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground text-center mt-4">
                <p className="font-semibold mb-1">Demo Credentials</p>
                <p>Username: <span className="font-mono font-bold text-foreground">admin</span></p>
                <p>Password: <span className="font-mono font-bold text-foreground">admin123</span></p>
              </div>
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

        <p className="text-center text-xs text-muted-foreground mt-6">
          PharmaPOS Pakistan — Professional Pharmacy Management System
        </p>
      </div>
    </div>
  );
}
