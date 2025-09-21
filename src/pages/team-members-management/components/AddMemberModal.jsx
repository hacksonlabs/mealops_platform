import React, { useEffect, useRef, useState, useMemo } from 'react';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import Icon from '../../../components/AppIcon';
import {
  toTitleCase,
  normalizePhoneNumber,
  normalizeBirthday,
} from '../../../utils/stringUtils';
import { findIntraListDuplicates, duplicatesMessage, MEMBER_ROLES_OPTIONS } from '../../../utils/addingTeamMembersUtils';

const emptyRow = () => ({
  name: '',
  email: '',
  phone: '',
  role: 'player',
  allergies: '',
  birthday: '', // yyyy-MM-dd
});

const AddMemberModal = ({ onClose, onAdd, existingMembers = [] }) => {
  const [rows, setRows] = useState([emptyRow()]);
  const [loading, setLoading] = useState(false);

  // Normal closable error banner (validation/save issues)
  const [error, setError] = useState('');

  // Duplicate-only state (non-closable; auto-clears when fixed)
  const [hasDupes, setHasDupes] = useState(false);
  const [dupMsg, setDupMsg] = useState('');

  const overlayRef = useRef(null);
  const roleOptions = useMemo(() => MEMBER_ROLES_OPTIONS, []);

  const handleClearError = () => setError('');

  // Close on overlay click
  const handleOverlayMouseDown = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Duplicate detection (intra-modal + against existing team members)
  useEffect(() => {
    if (!rows || rows.length === 0) {
      setHasDupes(false);
      setDupMsg('');
      return;
    }

    const messages = [];
    let anyDupes = false;

    // Intra-list duplicates (rows vs rows)
    const intraGroups = findIntraListDuplicates(rows);
    if (intraGroups.length) {
      messages.push(duplicatesMessage(intraGroups));
      anyDupes = true;
    }

    // Against existing team members from DB
    const existingEmailSet = new Set(
      (existingMembers || [])
        .map(m => String(m?.email || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const collisions = [];
    rows.forEach((r, idx) => {
      const email = String(r?.email || '').trim().toLowerCase();
      if (email && existingEmailSet.has(email)) {
        collisions.push({ idx, email });
      }
    });

    if (collisions.length) {
      const list = collisions
        .map(c => `${c.email}${rows.length > 1 ? ` (row ${c.idx + 1})` : ''}`)
        .join(', ');
      messages.push(`Already on your team: ${list}.`);
      anyDupes = true;
    }

    setHasDupes(anyDupes);
    setDupMsg(messages.join('\n'));
  }, [rows, existingMembers]);

  // Normalize per-field for controlled editing
  const normalizeFieldValue = (field, value) => {
    switch (field) {
      case 'name':       return toTitleCase(value || '');
      case 'email':      return String(value || '').trim().toLowerCase();
      case 'phone':      return normalizePhoneNumber(value || '');
      case 'role':       return String(value || 'player').toLowerCase();
      case 'allergies':  return toTitleCase(value || '');
      case 'birthday':   return normalizeBirthday(value || '');
      default:           return value;
    }
  };

  const handleInputChange = (idx, field, value) => {
    const normalized = normalizeFieldValue(field, value);
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: normalized };
      return next;
    });
    if (error) setError('');
  };

  const addMemberRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeMemberRow = (idx) =>
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [emptyRow()];
    });

  // --- Submit all rows ---
  const isBlank = (row) => {
    const { name, email, phone, allergies, birthday } = row;
    return [name, email, phone, allergies, birthday].every((v) => !String(v || '').trim());
  };

  const validateRow = (row) => {
    if (!row.name.trim()) return 'Name is required';
    if (!row.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'Invalid email';
    return null;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    if (hasDupes) {
      setLoading(false);
      return;
    }

    // Re-normalize everything once more before submit (defensive)
    const normalizedRows = rows.map((r) => ({
      name: normalizeFieldValue('name', r.name),
      email: normalizeFieldValue('email', r.email),
      phone: normalizeFieldValue('phone', r.phone),
      role: normalizeFieldValue('role', r.role),
      allergies: normalizeFieldValue('allergies', r.allergies),
      birthday: normalizeFieldValue('birthday', r.birthday),
    }));

    const toSubmit = normalizedRows.filter((r) => !isBlank(r));
    if (!toSubmit.length) {
      setError('Please fill out at least one row.');
      setLoading(false);
      return;
    }

    const problems = [];
    toSubmit.forEach((row, i) => {
      const msg = validateRow(row);
      if (msg) problems.push(`Row ${i + 1}: ${msg}`);
    });
    if (problems.length) {
      setError(problems.join('\n'));
      setLoading(false);
      return;
    }

    const failures = [];
    for (let i = 0; i < toSubmit.length; i++) {
      try {
        const res = await onAdd(toSubmit[i]);
        if (!res?.success) {
          failures.push(
            `Row ${i + 1} (${toSubmit[i].email || toSubmit[i].name}): ${res?.error || res?.message || 'Failed to add'}`
          );
        }
      } catch (err) {
        failures.push(
          `Row ${i + 1} (${toSubmit[i].email || toSubmit[i].name}): ${err?.message || 'Failed to add'}`
        );
      }
    }

    if (failures.length) {
      setError(`Some rows failed:\n${failures.join('\n')}`);
      setLoading(false);
      return;
    }

    onClose?.();
    setLoading(false);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={handleOverlayMouseDown}
      onTouchStart={handleOverlayMouseDown}
      role="presentation"
    >
      <div
        className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-5xl max-h-[90vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Add Team Members</h3>
          <Button variant="ghost" size="sm" onClick={onClose} iconName="X" disabled={loading} aria-label="Close" />
        </div>

        {/* Roster Section */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto">
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Icon name="ClipboardList" size={20} className="mr-2" /> Team Roster
              </h2>
              <div className="flex space-x-2">
                <Button type="button" variant="outline" size="sm" onClick={addMemberRow}>
                  <Icon name="Plus" size={16} className="mr-2" /> Add Member
                </Button>
              </div>
            </div>

            {/* Duplicate-only banner (non-closable; auto-clears when fixed) */}
            {dupMsg && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 flex items-center whitespace-pre-line text-sm">
                  <Icon name="AlertTriangle" size={20} className="mr-2" /> {dupMsg}
                </p>
              </div>
            )}

            {rows.length > 0 && (
              <div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="w-1/4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone #</th>
                      <th className="w-1/6 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-3 py-2 pr-5 text-left text-xs font-medium text-gray-500 tracking-wider italic">allergies</th>
                      <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider italic">birthday</th>
                      <th className="w-10 px-2 py-1" />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rows.map((member, index) => (
                      <tr key={index}>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <Input
                            type="text"
                            value={member.name}
                            onChange={(e) => handleInputChange(index, 'name', e.target.value)}
                            placeholder=" Name"
                            className="!border-none !ring-0 !shadow-none !p-0"
                            disabled={loading}
                            required
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <Input
                            type="email"
                            value={member.email}
                            onChange={(e) => handleInputChange(index, 'email', e.target.value)}
                            placeholder=" Email"
                            className="!border-none !ring-0 !shadow-none !p-0"
                            disabled={loading}
                            required
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <Input
                            type="tel"
                            value={member.phone}
                            onChange={(e) => handleInputChange(index, 'phone', e.target.value)}
                            placeholder=" (xxx) xxx-xxxx"
                            className="!border-none !ring-0 !shadow-none !p-0"
                            disabled={loading}
                            inputMode="tel"
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <Select
                            value={member.role}
                            options={roleOptions}
                            onChange={(value) => handleInputChange(index, 'role', value)}
                            className="!border-none !ring-0 !shadow-none !p-0"
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <Input
                            type="text"
                            value={member.allergies}
                            onChange={(e) => handleInputChange(index, 'allergies', e.target.value)}
                            placeholder=" Optional.."
                            className="!border-none !ring-0 !shadow-none !p-0"
                            disabled={loading}
                          />
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          <Input
                            type="date"
                            value={member.birthday || ''}
                            onChange={(e) => handleInputChange(index, 'birthday', e.target.value)}
                            className="!border-none !ring-0 !shadow-none !p-0"
                            disabled={loading}
                          />
                        </td>
                        <td className="px-0.5 py-0.5 whitespace-nowrap text-right text-sm font-medium">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMemberRow(index)}
                            className="text-red-600 hover:text-red-700"
                            title="Remove row"
                            iconName="Trash"
                            disabled={loading}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Tip: To add many members at once, use <strong>Import CSV</strong> from the Team Members page.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md relative pr-10 whitespace-pre-line">
                <p className="text-sm text-red-800 flex items-center">
                  <Icon name="XCircle" size={20} className="mr-2" /> {error}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearError}
                  className="absolute top-1 right-1 text-red-600 hover:text-red-700 p-1"
                >
                  <Icon name="X" size={16} />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || hasDupes}
              iconName={loading ? 'Loader2' : 'Plus'}
              iconPosition="left"
              className={loading ? 'animate-spin' : ''}
            >
              {loading ? 'Adding...' : 'Add Member(s)'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMemberModal;