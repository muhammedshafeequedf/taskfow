import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { portalApi, type CustomerRole } from '../../lib/api';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiShield } from 'react-icons/fi';

const CUSTOMER_PERMISSIONS = [
  { value: 'requests:create', label: 'Create Requests' },
  { value: 'requests:view_own', label: 'View Own Requests' },
  { value: 'requests:view_all', label: 'View All Requests' },
  { value: 'requests:approve', label: 'Approve Requests' },
  { value: 'team:view', label: 'View Team' },
  { value: 'team:invite', label: 'Invite Team Members' },
  { value: 'team:manage', label: 'Manage Team' },
  { value: 'roles:manage', label: 'Manage Roles' },
  { value: 'projects:view', label: 'View Projects' },
];

function PermissionCheckboxes({
  perms,
  setPerms,
  togglePerm,
}: {
  perms: string[];
  setPerms: (v: string[]) => void;
  togglePerm: (list: string[], setList: (v: string[]) => void, perm: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {CUSTOMER_PERMISSIONS.map((p) => (
        <label key={p.value} className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={perms.includes(p.value)}
            onChange={() => togglePerm(perms, setPerms, p.value)}
            className="w-4 h-4 rounded border-[color:var(--border-subtle)] accent-[color:var(--accent)]"
          />
          <span className="text-sm text-[color:var(--text-primary)] group-hover:text-[color:var(--accent)] transition">
            {p.label}
          </span>
          <span className="text-xs text-[color:var(--text-muted)] font-mono">{p.value}</span>
        </label>
      ))}
    </div>
  );
}

export default function PortalRoles() {
  const { token } = useAuth();
  const [roles, setRoles] = useState<CustomerRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canManage = true; // already behind PortalRoute permission check via nav

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPerms, setCreatePerms] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit modal
  const [editRole, setEditRole] = useState<CustomerRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirm
  const [deleteRole, setDeleteRole] = useState<CustomerRole | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  function loadRoles() {
    if (!token) return;
    setLoading(true);
    portalApi.listRoles(token).then((res) => {
      setLoading(false);
      if (res.success && res.data) setRoles(res.data.roles || []);
      else setError((res as { message?: string }).message ?? 'Failed to load roles');
    });
  }

  useEffect(() => {
    loadRoles();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function togglePerm(list: string[], setList: (v: string[]) => void, perm: string) {
    if (list.includes(perm)) setList(list.filter((p) => p !== perm));
    else setList([...list, perm]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    setCreateError('');
    const res = await portalApi.createRole({ name: createName, permissions: createPerms }, token);
    setCreating(false);
    if (res.success) {
      setShowCreate(false);
      setCreateName('');
      setCreatePerms([]);
      loadRoles();
    } else {
      setCreateError((res as { message?: string }).message ?? 'Create failed');
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !editRole) return;
    setSaving(true);
    setEditError('');
    const res = await portalApi.updateRole(
      editRole._id,
      { name: editName, permissions: editPerms },
      token
    );
    setSaving(false);
    if (res.success) {
      setEditRole(null);
      loadRoles();
    } else {
      setEditError((res as { message?: string }).message ?? 'Update failed');
    }
  }

  async function handleDelete() {
    if (!token || !deleteRole) return;
    setDeleting(true);
    setDeleteError('');
    const res = await portalApi.deleteRole(deleteRole._id, token);
    setDeleting(false);
    if (res.success) {
      setDeleteRole(null);
      loadRoles();
    } else {
      setDeleteError((res as { message?: string }).message ?? 'Delete failed');
    }
  }

  const inputClass =
    'w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-page)] px-4 py-3 text-sm text-[color:var(--text-primary)] placeholder-[color:var(--text-muted)] transition focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30';

  return (
    <div className="p-4 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--text-primary)]">Roles</h1>
          <p className="text-sm text-[color:var(--text-muted)] mt-1">
            Manage customer portal roles and permissions
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
              setCreateName('');
              setCreatePerms([]);
              setCreateError('');
            }}
            className="btn-primary flex items-center gap-2"
          >
            <FiPlus /> Create Role
          </button>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-12 text-center text-[color:var(--text-muted)] animate-pulse">
          Loading…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">
          {error}
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div
              key={role._id}
              className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-5 flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-[color:var(--accent)]/10 flex items-center justify-center text-[color:var(--accent)] shrink-0">
                <FiShield />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-semibold text-[color:var(--text-primary)]">{role.name}</p>
                  {role.isSystemRole && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[color:var(--accent)]/10 text-[color:var(--accent)]">
                      System
                    </span>
                  )}
                  {role.isDefault && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-[color:var(--text-muted)]">
                  {role.permissions.length === 0
                    ? 'No permissions'
                    : `${role.permissions.length} permission${role.permissions.length !== 1 ? 's' : ''}`}
                </p>
                {role.permissions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {role.permissions.map((p) => (
                      <span
                        key={p}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-[color:var(--bg-elevated)] text-[color:var(--text-muted)] border border-[color:var(--border-subtle)]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {!role.isSystemRole && canManage && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditRole(role);
                      setEditName(role.name);
                      setEditPerms([...role.permissions]);
                      setEditError('');
                    }}
                    className="p-1.5 rounded-md text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-elevated)] transition"
                    title="Edit role"
                  >
                    <FiEdit2 className="text-sm" />
                  </button>
                  {!role.isDefault && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteRole(role);
                        setDeleteError('');
                      }}
                      className="p-1.5 rounded-md text-[color:var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Delete role"
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setShowCreate(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-modal)] shadow-2xl animate-scale-in flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[color:var(--border-subtle)] flex items-center justify-between shrink-0">
                <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">
                  Create Role
                </h3>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition"
                >
                  <FiX />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                {createError && (
                  <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {createError}
                  </div>
                )}
                <form id="create-role-form" onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1.5">
                      Role Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      required
                      placeholder="e.g. Reviewer"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-2">
                      Permissions
                    </label>
                    <PermissionCheckboxes
                      perms={createPerms}
                      setPerms={setCreatePerms}
                      togglePerm={togglePerm}
                    />
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-[color:var(--border-subtle)] flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="create-role-form"
                  disabled={creating}
                  className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                >
                  <FiPlus /> {creating ? 'Creating…' : 'Create Role'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Edit Modal */}
      {editRole &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setEditRole(null)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-modal)] shadow-2xl animate-scale-in flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[color:var(--border-subtle)] flex items-center justify-between shrink-0">
                <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">
                  Edit Role — {editRole.name}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditRole(null)}
                  className="text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition"
                >
                  <FiX />
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                {editError && (
                  <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {editError}
                  </div>
                )}
                <form id="edit-role-form" onSubmit={handleEditSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-1.5">
                      Role Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--text-primary)] mb-2">
                      Permissions
                    </label>
                    <PermissionCheckboxes
                      perms={editPerms}
                      setPerms={setEditPerms}
                      togglePerm={togglePerm}
                    />
                  </div>
                </form>
              </div>

              <div className="p-6 border-t border-[color:var(--border-subtle)] flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditRole(null)}
                  className="px-4 py-2 rounded-lg btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-role-form"
                  disabled={saving || !editName.trim()}
                  className="btn-primary px-4 py-2 rounded-lg text-sm"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Delete Confirm */}
      {deleteRole &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setDeleteRole(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-modal)] p-6 shadow-2xl animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base font-semibold text-[color:var(--text-primary)] mb-2">
                Delete Role
              </h3>
              <p className="text-sm text-[color:var(--text-muted)] mb-4">
                Are you sure you want to delete{' '}
                <strong className="text-[color:var(--text-primary)]">{deleteRole.name}</strong>?
                Members with this role will need to be reassigned.
              </p>
              {deleteError && (
                <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                  {deleteError}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteRole(null)}
                  className="btn-secondary text-sm px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition flex items-center gap-2"
                >
                  <FiTrash2 /> {deleting ? 'Deleting…' : 'Delete Role'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
