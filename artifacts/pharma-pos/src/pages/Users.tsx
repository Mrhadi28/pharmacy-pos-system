import { useState } from "react";
import { useGetUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { UserCog, Plus, Pencil, Trash2, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const ROLES = [
  { value: "owner", label: "Owner", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "admin", label: "Admin", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "cashier", label: "Cashier", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "pharmacist", label: "Pharmacist", color: "bg-orange-100 text-orange-700 border-orange-200" },
];

const getRoleBadge = (role: string) => ROLES.find(r => r.value === role) || ROLES[1];

export default function Users() {
  const { user: currentUser } = useAuth();
  const { data: users = [], isLoading, refetch } = useGetUsers();
  const { mutate: createUser, isPending: isCreating } = useCreateUser();
  const { mutate: updateUser, isPending: isUpdating } = useUpdateUser();
  const { mutate: deleteUser } = useDeleteUser();

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ username: "", password: "", fullName: "", role: "cashier", phone: "" });

  const canManage = currentUser?.role === "owner" || currentUser?.role === "admin";

  const handleCreate = () => {
    if (!form.username || !form.password || !form.fullName) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    createUser({ data: form }, {
      onSuccess: () => {
        toast({ title: "User created!", description: `${form.fullName} added successfully.` });
        setShowCreate(false);
        setForm({ username: "", password: "", fullName: "", role: "cashier", phone: "" });
        refetch();
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const handleUpdate = () => {
    if (!editUser) return;
    updateUser({ id: editUser.id, data: { fullName: editUser.fullName, role: editUser.role, phone: editUser.phone, isActive: editUser.isActive } }, {
      onSuccess: () => {
        toast({ title: "User updated!" });
        setEditUser(null);
        refetch();
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  const handleDelete = (user: any) => {
    if (!confirm(`Delete user "${user.fullName}"? This cannot be undone.`)) return;
    deleteUser({ id: user.id }, {
      onSuccess: () => {
        toast({ title: "User deleted" });
        refetch();
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" })
    });
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-md shadow-black/5 h-full flex flex-col">
      <div className="p-6 border-b border-border flex items-center justify-between bg-muted/10">
        <div>
          <h2 className="font-display font-bold text-2xl flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" /> User Management
          </h2>
          <p className="text-muted-foreground text-sm">Manage staff access and roles for your pharmacy</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Staff
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user: any) => {
              const roleMeta = getRoleBadge(user.role);
              const isMe = user.id === currentUser?.id;
              return (
                <div key={user.id} className={`bg-background border rounded-2xl p-5 relative transition-all hover:shadow-md ${isMe ? "border-primary/30 ring-1 ring-primary/20" : "border-border"}`}>
                  {isMe && <span className="absolute top-3 right-3 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">You</span>}
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {user.fullName[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate">{user.fullName}</p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Role</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${roleMeta.color}`}>{roleMeta.label}</span>
                    </div>
                    {user.phone && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium">{user.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={user.isActive ? "secondary" : "destructive"} className="text-xs">
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Joined</span>
                      <span className="font-medium">{formatDate(user.createdAt)}</span>
                    </div>
                  </div>
                  {canManage && !isMe && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                      <Button
                        variant="outline" size="sm" className="flex-1"
                        onClick={() => setEditUser({ ...user })}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(user)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add New Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Full Name *</label>
              <Input placeholder="Muhammad Ali" value={form.fullName} onChange={e => setForm(f => ({...f, fullName: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Username *</label>
                <Input placeholder="ali_cashier" value={form.username} onChange={e => setForm(f => ({...f, username: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Password *</label>
                <Input type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Phone</label>
                <Input placeholder="03XX-XXXXXXX" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Role *</label>
                <select
                  className="w-full border border-border rounded-xl px-3 h-10 text-sm bg-background"
                  value={form.role}
                  onChange={e => setForm(f => ({...f, role: e.target.value}))}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating}>{isCreating ? "Creating..." : "Create User"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit User</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Full Name</label>
                <Input value={editUser.fullName} onChange={e => setEditUser((u: any) => ({...u, fullName: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Role</label>
                  <select
                    className="w-full border border-border rounded-xl px-3 h-10 text-sm bg-background"
                    value={editUser.role}
                    onChange={e => setEditUser((u: any) => ({...u, role: e.target.value}))}
                  >
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Phone</label>
                  <Input value={editUser.phone || ""} onChange={e => setEditUser((u: any) => ({...u, phone: e.target.value}))} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={editUser.isActive} onChange={e => setEditUser((u: any) => ({...u, isActive: e.target.checked}))} className="w-4 h-4" />
                <label htmlFor="isActive" className="text-sm font-medium">Active (can login)</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>{isUpdating ? "Saving..." : "Save Changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
