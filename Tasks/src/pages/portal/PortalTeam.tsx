import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { portalApi, type CustomerMember, type CustomerRole } from '../../lib/api';
import { userHasPermission } from '../../utils/permissions';
import { CUSTOMER_PERMISSIONS } from '@shared/constants/permissions';
import { FiUserPlus, FiEdit2, FiTrash2, FiX } from 'react-icons/fi';

function getInitials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getRoleName(member: CustomerMember): string {
  if (typeof member.roleId === 'object' && 'name' in member.roleId) {
    return (member.roleId as { name: string }).name;
  }
  return '—';
}

function getRoleId(member: CustomerMember): string {
  if (typeof member.roleId === 'object' && '_id' in member.roleId) {
    return (member.roleId as { _id: string })._id;
  }
  return '';
}

export default function PortalTeam() {
  const { token, user: currentUser } = useAuth();
  const [members, setMembers] = useState<CustomerMember[]>([]);
  const [roles, setRoles] = useState<CustomerRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cp = currentUser?.customerPermissions ?? [];
  const canInvite = userHasPermission(cp, CUSTOMER_PERMISSIONS.LEGACY.TEAM.INVITE);
  const canManage = userHasPermission(cp, CUSTOMER_PERMISSIONS.LEGACY.TEAM.MANAGE);

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Edit modal state
  const [editMember, setEditMember] = useState<CustomerMember | null>(null);
  const [editRoleId, setEditRoleId] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  // Remove confirm
  const [removeMember, setRemoveMember] = useState<CustomerMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  function loadData() {
    if (!token) return;
    setLoading(true);
    Promise.all([portalApi.listMembers(token), portalApi.listRoles(token)]).then(([mRes, rRes]) => {
      setLoading(false);
      if (mRes.success && mRes.data) setMembers(mRes.data.members || []);
      else setError((mRes as { message?: string }).message ?? 'Failed to load members');
      if (rRes.success && rRes.data) {
        const fetchedRoles = rRes.data.roles || [];
        setRoles(fetchedRoles);
        if (!inviteRoleId && fetchedRoles.length > 0) setInviteRoleId(fetchedRoles[0]._id);
      }
    });
  }

  useEffect(() => { loadData(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setInviteSubmitting(true);
    setInviteError('');
    const res = await portalApi.inviteMember({ name: inviteName, email: inviteEmail, roleId: inviteRoleId }, token);
    setInviteSubmitting(false);
    if (res.success) {
      setShowInvite(false);
      setInviteName(''); setInviteEmail(''); setInviteRoleId(roles[0]?._id ?? '');
      loadData();
    } else {
      setInviteError((res as { message?: string }).message ?? 'Invite failed');
    }
  }

  async function handleEditSave() {
    if (!token || !editMember) return;
    setEditSubmitting(true);
    setEditError('');
    const data: { roleId?: string; status?: string } = {};
    if (editRoleId) data.roleId = editRoleId;
    if (editStatus) data.status = editStatus;
    const res = await portalApi.updateMember(editMember._id, data, token);
    setEditSubmitting(false);
    if (res.success) {
      setEditMember(null);
      loadData();
    } else {
      setEditError((res as { message?: string }).message ?? 'Update failed');
    }
  }

  async function handleRemove() {
    if (!token || !removeMember) return;
    setRemoving(true);
    setRemoveError('');
    const res = await portalApi.removeMember(removeMember._id, token);
    setRemoving(false);
    if (res.success) {
      setRemoveMember(null);
      loadData();
    } else {
      setRemoveError((res as { message?: string }).message ?? 'Remove failed');
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-4 py-3 text-sm text-[color:var(--text-primary)] placeholder-[color:var(--text-muted)] transition focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30';

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">Team</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">Members in your organisation</p>
        </div>
        {canInvite && (
          <button type="button" onClick={() => setShowInvite(true)} className="btn-primary flex items-center gap-2">
            <FiUserPlus /> Invite Member
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-12 text-center text-[color:var(--text-muted)] animate-pulse">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">{error}</div>
      ) : (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] overflow-hidden">
          <div className="md:hidden divide-y divide-[color:var(--border-subtle)]">
            {members.map((m) => (
              <div key={m._id} className="p-4">
                <p className="font-medium">{m.name}</p>
                <p className="text-xs text-[color:var(--text-muted)] mt-1">{m.email}</p>
                <p className="text-xs mt-1">{getRoleName(m)} · {m.status}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-elevated)]">
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Member</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Joined</th>
                  {canManage && (
                    <th className="px-4 py-3 text-left font-medium text-[color:var(--text-muted)]">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--border-subtle)]">
                {members.map((m) => {
                  const isSelf = m.email === currentUser?.email;
                  return (
                    <tr key={m._id} className="hover:bg-[color:var(--bg-elevated)] transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[color:var(--accent)]/20 flex items-center justify-center text-xs font-semibold text-[color:var(--accent)] shrink-0">
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                            ) : getInitials(m.name)}
                          </div>
                          <div>
                            <p className="font-medium text-[color:var(--text-primary)]">{m.name}</p>
                            {m.isOrgAdmin && (
                              <span className="text-xs text-[color:var(--accent)]">Org Admin</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)]">{m.email}</td>
                      <td className="px-4 py-3 text-[color:var(--text-primary)]">{getRoleName(m)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.status === 'active'
                            ? 'bg-green-500/15 text-green-400'
                            : m.status === 'invited'
                            ? 'bg-yellow-500/15 text-yellow-400'
                            : 'bg-gray-500/15 text-gray-400'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--text-muted)]">{formatDate(m.createdAt)}</td>
                      {canManage && (
                        <td className="px-4 py-3">
                          {!isSelf && !m.isOrgAdmin && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditMember(m);
                                  setEditRoleId(getRoleId(m));
                                  setEditStatus(m.status);
                                  setEditError('');
                                }}
                                className="p-1.5 rounded-md text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-elevated)] transition"
                                title="Edit member"
                              >
                                <FiEdit2 className="text-xs" />
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRemoveMember(m); setRemoveError(''); }}
                                className="p-1.5 rounded-md text-[color:var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition"
                                title="Remove member"
                              >
                                <FiTrash2 className="text-xs" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowInvite(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-modal)] p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">Invite Member</h3>
              <button type="button" onClick={() => setShowInvite(false)} className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition">
                <FiX />
              </button>
            </div>
            {inviteError && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {inviteError}
              </div>
            )}
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1.5">Name <span className="text-red-400">*</span></label>
                <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required placeholder="Full name" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1.5">Email <span className="text-red-400">*</span></label>
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="email@example.com" className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1.5">Role <span className="text-red-400">*</span></label>
                <select value={inviteRoleId} onChange={(e) => setInviteRoleId(e.target.value)} required className={inputClass}>
                  <option value="">Select role…</option>
                  {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[color:var(--border-subtle)] mt-4">
                <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary text-sm px-4 py-2 rounded-lg">Cancel</button>
                <button type="submit" disabled={inviteSubmitting} className="btn-primary text-sm px-4 py-2 rounded-lg flex items-center gap-2">
                  <FiUserPlus /> {inviteSubmitting ? 'Inviting…' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {editMember && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setEditMember(null)}>
          <div className="w-full max-w-md rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-modal)] p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">Edit Member</h3>
              <button type="button" onClick={() => setEditMember(null)} className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition"><FiX /></button>
            </div>
            <p className="text-sm text-[color:var(--text-muted)] mb-4">{editMember.email}</p>
            {editError && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{editError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1.5">Role</label>
                <select value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)} className={inputClass}>
                  {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1.5">Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={inputClass}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[color:var(--border-subtle)] mt-6">
              <button type="button" onClick={() => setEditMember(null)} className="btn-secondary text-sm px-4 py-2 rounded-lg">Cancel</button>
              <button type="button" onClick={handleEditSave} disabled={editSubmitting} className="btn-primary text-sm px-4 py-2 rounded-lg">
                {editSubmitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Remove Confirm */}
      {removeMember && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setRemoveMember(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-modal)] p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[color:var(--text-primary)] mb-2">Remove Member</h3>
            <p className="text-sm text-[color:var(--text-muted)] mb-6">
              Are you sure you want to remove <strong className="text-[color:var(--text-primary)]">{removeMember.name}</strong> from your organisation? This cannot be undone.
            </p>
            {removeError && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{removeError}</div>
            )}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={() => setRemoveMember(null)} className="btn-secondary text-sm px-4 py-2 rounded-lg">Cancel</button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={removing}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-50 transition flex items-center gap-2"
              >
                <FiTrash2 /> {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
