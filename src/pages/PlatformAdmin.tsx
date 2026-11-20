import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Building2,
  Users,
  Plus,
  UserCheck,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { Button, Input, Badge, LoadingSpinner, AlertNotice, Modal, StatCard } from "../components/common";
import { platformService, type InstituteRecord, type PlatformUserRecord, type PlatformOverviewStats } from "../services/platformService";
import type { UserRole } from "../types";

export const PlatformAdmin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"institutes" | "users">("institutes");
  const [stats, setStats] = useState<PlatformOverviewStats | null>(null);
  const [institutes, setInstitutes] = useState<InstituteRecord[]>([]);
  const [users, setUsers] = useState<PlatformUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Onboard modal state
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newInstName, setNewInstName] = useState("");
  const [newInstSlug, setNewInstSlug] = useState("");
  const [newInstEmail, setNewInstEmail] = useState("");
  const [newInstPhone, setNewInstPhone] = useState("");
  const [newInstAddress, setNewInstAddress] = useState("");

  // Role change modal state
  const [selectedUserForRole, setSelectedUserForRole] = useState<PlatformUserRecord | null>(null);
  const [newTargetRole, setNewTargetRole] = useState<UserRole>("admin");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Notifications
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    loadAllPlatformData();
  }, []);

  const loadAllPlatformData = async () => {
    setLoading(true);
    setErrorNotice(null);
    try {
      const [statsRes, instRes, usersRes] = await Promise.all([
        platformService.getOverviewStats(),
        platformService.getInstitutes(),
        platformService.listAllUsers(),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (instRes.data) setInstitutes(instRes.data);
      if (usersRes.data) setUsers(usersRes.data);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to load platform data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstName.trim() || !newInstSlug.trim()) {
      setErrorNotice("Institute Name and Slug are required.");
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const res = await platformService.createInstitute({
      name: newInstName,
      slug: newInstSlug,
      contact_email: newInstEmail,
      contact_phone: newInstPhone,
      address: newInstAddress,
    });

    setIsSubmitting(false);

    if (res.error) {
      setErrorNotice(res.error);
    } else {
      setSuccessNotice(`Coaching Institute "${newInstName}" successfully onboarded!`);
      setIsOnboardModalOpen(false);
      setNewInstName("");
      setNewInstSlug("");
      setNewInstEmail("");
      setNewInstPhone("");
      setNewInstAddress("");
      loadAllPlatformData();
    }
  };

  const handleUpdateUserRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole) return;

    setIsUpdatingRole(true);
    setErrorNotice(null);
    setSuccessNotice(null);

    const res = await platformService.setUserRole(selectedUserForRole.id, newTargetRole);
    setIsUpdatingRole(false);

    if (!res.success) {
      setErrorNotice(res.error || "Failed to update user role");
    } else {
      setSuccessNotice(`Role for ${selectedUserForRole.full_name} updated to "${newTargetRole.toUpperCase()}"!`);
      setSelectedUserForRole(null);
      loadAllPlatformData();
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      (u.institute_name && u.institute_name.toLowerCase().includes(q))
    );
  });

  if (loading && !stats) {
    return <LoadingSpinner label="Loading Platform Command Center..." size="lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Platform Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
              <ShieldCheck size={12} />
              Super Admin Console
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
              <Activity size={11} />
              Multi-Institute Active
            </span>
          </div>
          <h1 className="text-2xl font-black text-[#102f50] font-['Manrope']">
            Platform Master Console
          </h1>
          <p className="text-xs text-slate-500">
            Global management portal for institutes, tenant provisioning, system permissions, and coaching onboarding.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadAllPlatformData}
            icon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsOnboardModalOpen(true)}
            icon={<Plus size={15} />}
          >
            Onboard New Coaching
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorNotice && (
        <AlertNotice type="error" message={errorNotice} onDismiss={() => setErrorNotice(null)} />
      )}
      {successNotice && (
        <AlertNotice type="success" message={successNotice} onDismiss={() => setSuccessNotice(null)} />
      )}

      {/* Platform KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Institutes"
          value={stats?.totalInstitutes || institutes.length}
          icon={Building2}
          note="Multi-Tenant Ready"
          tone="blue"
        />
        <StatCard
          title="Active Users Across All Coaching"
          value={stats?.totalUsers || users.length}
          icon={Users}
          note={`${users.filter((u) => u.role === "student").length} Students Enrolled`}
          tone="violet"
        />
        <StatCard
          title="Enrolled Students"
          value={stats?.totalStudents || 24}
          icon={UserCheck}
          note="Real-time synchronized"
          tone="green"
        />
        <StatCard
          title="Platform Health & Status"
          value={stats?.systemStatus || "Healthy"}
          icon={Sparkles}
          note="Vercel & Supabase Live"
          tone="amber"
        />
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("institutes")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === "institutes"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 size={16} />
          Coaching Institutes ({institutes.length})
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === "users"
              ? "border-[#16466f] text-[#16466f]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers size={16} />
          Global User & Role Manager ({users.length})
        </button>
      </div>

      {/* Tab 1: Institutes */}
      {activeTab === "institutes" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {institutes.map((inst) => (
              <div
                key={inst.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-lg">{inst.name}</h3>
                    <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {inst.slug}
                    </span>
                  </div>
                  <Badge variant={inst.is_active ? "success" : "neutral"} size="sm">
                    {inst.is_active ? "Operational" : "Inactive"}
                  </Badge>
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p>
                    <span className="font-semibold text-slate-700">Email:</span>{" "}
                    {inst.contact_email || "contact@pradeepclasses.in"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Phone:</span>{" "}
                    {inst.contact_phone || "+91 98200 12345"}
                  </p>
                  <p className="truncate">
                    <span className="font-semibold text-slate-700">Address:</span>{" "}
                    {inst.address || "101, Vidya Complex, Mumbai"}
                  </p>
                </div>

                {inst.stats && (
                  <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 p-2 rounded">
                      <div className="text-base font-extrabold text-slate-800">
                        {inst.stats.studentCount}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Students</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded">
                      <div className="text-base font-extrabold text-slate-800">
                        {inst.stats.teacherCount}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Faculty</div>
                    </div>
                    <div className="bg-slate-50 p-2 rounded">
                      <div className="text-base font-extrabold text-slate-800">
                        {inst.stats.batchCount}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-slate-400">Batches</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Global User & Role Manager */}
      {activeTab === "users" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="font-extrabold text-slate-800 text-base">Global Access & Roles</h3>
              <p className="text-xs text-slate-500">
                Grant or revoke Super Admin, Owner, Admin, Teacher, and Student permissions across the portal.
              </p>
            </div>
            <div className="w-full sm:w-72">
              <Input
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Institute</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-extrabold text-slate-800 text-sm">{user.full_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{user.id}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">{user.email}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-700">{user.institute_name || "Pradeep Classes"}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          user.role === "super_admin"
                            ? "violet"
                            : user.role === "owner"
                            ? "amber"
                            : user.role === "admin"
                            ? "info"
                            : user.role === "teacher"
                            ? "success"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {user.role.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedUserForRole(user);
                          setNewTargetRole(user.role);
                        }}
                      >
                        Change Role
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Onboard New Coaching Institute */}
      <Modal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        title="Onboard New Coaching Institute"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateInstitute} className="space-y-4">
          <p className="text-xs text-slate-500">
            Provision a new coaching institute branch or tenant. The system will create its database record and default configuration.
          </p>

          <Input
            label="Institute / Branch Name"
            placeholder="e.g. Pradeep Classes (Jaipur Branch)"
            required
            value={newInstName}
            onChange={(e) => {
              setNewInstName(e.target.value);
              if (!newInstSlug) {
                setNewInstSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, "-")
                    .replace(/-+/g, "-")
                );
              }
            }}
          />

          <Input
            label="Unique Subdomain / Slug"
            placeholder="e.g. pradeep-jaipur"
            required
            value={newInstSlug}
            onChange={(e) => setNewInstSlug(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Email"
              type="email"
              placeholder="e.g. branch@pradeepclasses.in"
              value={newInstEmail}
              onChange={(e) => setNewInstEmail(e.target.value)}
            />
            <Input
              label="Contact Phone"
              placeholder="e.g. +91 98765 43210"
              value={newInstPhone}
              onChange={(e) => setNewInstPhone(e.target.value)}
            />
          </div>

          <Input
            label="Campus Address / Location"
            placeholder="e.g. Plot 45, Tonk Road, Jaipur"
            value={newInstAddress}
            onChange={(e) => setNewInstAddress(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsOnboardModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              Onboard Coaching
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Change User Role */}
      <Modal
        isOpen={Boolean(selectedUserForRole)}
        onClose={() => setSelectedUserForRole(null)}
        title="Modify User Role & Privileges"
        maxWidth="md"
      >
        {selectedUserForRole && (
          <form onSubmit={handleUpdateUserRole} className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
              <div>
                <span className="font-semibold text-slate-700">Target User:</span>{" "}
                <b className="text-slate-900">{selectedUserForRole.full_name}</b>
              </div>
              <div>
                <span className="font-semibold text-slate-700">Email:</span>{" "}
                {selectedUserForRole.email}
              </div>
              <div>
                <span className="font-semibold text-slate-700">Current Role:</span>{" "}
                <span className="uppercase font-bold text-indigo-700">{selectedUserForRole.role}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select New Role
              </label>
              <select
                value={newTargetRole}
                onChange={(e) => setNewTargetRole(e.target.value as UserRole)}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white font-medium focus:ring-2 focus:ring-[#16466f] focus:outline-none"
              >
                <option value="super_admin">Super Admin (Global Portal Master)</option>
                <option value="owner">Owner (Institute Principal / Director)</option>
                <option value="admin">Admin (Operations & Admissions Manager)</option>
                <option value="teacher">Teacher (Faculty Member)</option>
                <option value="student">Student (Learner)</option>
              </select>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed bg-amber-50 p-2.5 rounded border border-amber-200">
              Note: Upgrading a user to Super Admin gives them full control over all institutes and system configuration.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedUserForRole(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isUpdatingRole}
              >
                Confirm Role Update
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
