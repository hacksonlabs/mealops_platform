// src/pages/team-members-management/components/EditTeamModal.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import Icon from '../../../components/AppIcon';
import { toTitleCase } from '../../../utils/stringUtils';

const GENDER_OPTIONS = [
  { value: 'womens', label: 'Womens' },
  { value: 'mens', label: 'Mens' },
  { value: 'coed', label: 'Coed' },
];

const EditTeamModal = ({
  team,
  onClose,
  onUpdate,
  loading,
  canDelete = false,
  onDeleteTeam,
}) => {
  // Consolidated form state
  const [form, setForm] = useState({
    name: team?.name || '',
    sport: team?.sport || '',
    conferenceName: team?.conference_name || '',
    gender: team?.gender || '',
  });

  const [error, setError] = useState('');

  // Delete-confirm state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Keep local form in sync with incoming team
  useEffect(() => {
    setForm({
      name: team?.name || '',
      sport: team?.sport || '',
      conferenceName: team?.conference_name || '',
      gender: team?.gender || '',
    });
  }, [team]);

  const isBusy = loading || deleting;

  // ---------- Overlay & Esc handling ----------
  const overlayRef = useRef(null);

  const handleOverlayMouseDown = useCallback(
    (e) => {
      if (showDeleteConfirm) return; // don't close parent if confirm dialog is open
      if (e.target === overlayRef.current) onClose?.();
    },
    [showDeleteConfirm, onClose]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
        return;
      }
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, showDeleteConfirm]);

  // Separate handler for the confirm dialog overlay + Esc
  const confirmOverlayRef = useRef(null);
  const handleConfirmOverlayMouseDown = (e) => {
    if (e.target === confirmOverlayRef.current) setShowDeleteConfirm(false);
  };
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const onKey = (e) => e.key === 'Escape' && setShowDeleteConfirm(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showDeleteConfirm]);

  // ---------- Form handlers ----------
  const handleChange = (field, transform) => (e) => {
    const raw = e?.target?.value ?? '';
    const next = transform ? transform(raw) : raw;
    setForm((prev) => ({ ...prev, [field]: next }));
  };

  // Title-case name/sport; uppercase conference; collapse repeated spaces
  const onNameChange = handleChange('name', (v) =>
    toTitleCase(v).replace(/\s+/g, ' ')
  );
  const onSportChange = handleChange('sport', (v) =>
    toTitleCase(v).replace(/\s+/g, ' ')
  );
  const onConferenceChange = handleChange('conferenceName', (v) =>
    String(v).toUpperCase().replace(/\s+/g, ' ')
  );
  const onGenderChange = (val) => setForm((p) => ({ ...p, gender: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      name: toTitleCase((form.name || '').trim()),
      sport: toTitleCase((form.sport || '').trim()),
      conference_name: (form.conferenceName || '').trim().toUpperCase(),
      gender: (form.gender || '').trim(),
    };

    if (!payload.name || !payload.sport || !payload.gender) {
      setError('Name, Sport, and Gender are required.');
      return;
    }

    await onUpdate?.(payload);
    onClose?.();
  };

  const handleConfirmDelete = async () => {
    if (!team?.id || !onDeleteTeam) return;
    setDeleteError('');
    setDeleting(true);
    try {
      const res = await onDeleteTeam(team);
      if (res && res.success === false) {
        throw new Error(res.error || res.message || 'Failed to delete team.');
      }
      onClose?.();
    } catch (err) {
      setDeleteError(err?.message || 'Failed to delete team. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ---------- Render ----------
  return (
    <>
      {/* Main edit modal */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onMouseDown={handleOverlayMouseDown}
        onTouchStart={handleOverlayMouseDown}
        role="presentation"
      >
        <div
          className="bg-card p-6 rounded-lg shadow-athletic-lg max-w-lg w-full border border-border"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-team-title"
          aria-describedby={error ? 'edit-team-error' : undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 id="edit-team-title" className="text-2xl font-bold text-foreground">
              Edit Team Information
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              iconName="X"
              aria-label="Close"
              disabled={isBusy}
            />
          </div>

          {error && (
            <div
              id="edit-team-error"
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 flex items-center"
            >
              <Icon name="AlertCircle" size={18} className="mr-2" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="teamName" className="block text-sm font-medium text-muted-foreground mb-1">
                Mascot
              </label>
              <Input
                id="teamName"
                value={form.name}
                onChange={onNameChange}
                placeholder="e.g., Panthers"
                required
                autoFocus
                disabled={isBusy}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="teamSport" className="block text-sm font-medium text-muted-foreground mb-1">
                Sport
              </label>
              <Input
                id="teamSport"
                value={form.sport}
                onChange={onSportChange}
                placeholder="e.g., Basketball"
                required
                disabled={isBusy}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="teamConference" className="block text-sm font-medium text-muted-foreground mb-1">
                Conference Name
              </label>
              <Input
                id="teamConference"
                value={form.conferenceName}
                onChange={onConferenceChange}
                placeholder="e.g., PAC-12"
                required
                disabled={isBusy}
              />
            </div>

            <div className="mb-6">
              <label htmlFor="teamGender" className="block text-sm font-medium text-muted-foreground mb-1">
                Gender
              </label>
              <Select
                id="teamGender"
                value={form.gender}
                onChange={onGenderChange}
                options={GENDER_OPTIONS}
                placeholder="Select gender"
                required
                disabled={isBusy}
              />
            </div>

            <div className="mt-16 flex justify-between items-center">
              {/* Danger zone */}
              <div className="flex items-center">
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    iconName="Trash2"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isBusy}
                  >
                    Delete Team
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground italic">
                    Only the coach can delete this team.
                  </span>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" type="button" onClick={onClose} disabled={isBusy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isBusy}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div
          ref={confirmOverlayRef}
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
          onMouseDown={handleConfirmOverlayMouseDown}
          onTouchStart={handleConfirmOverlayMouseDown}
          role="presentation"
        >
          <div
            className="bg-card p-5 rounded-lg shadow-athletic-lg w-full max-w-md border border-border"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 id="confirm-delete-title" className="text-xl font-semibold text-foreground">
                Confirm Team Deletion
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(false)}
                iconName="X"
                aria-label="Close confirm dialog"
                disabled={deleting}
              />
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              This will permanently delete{' '}
              <strong className="text-foreground">{team?.name}</strong> and remove all of its
              members. This action cannot be undone.
            </p>

            {deleteError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 flex items-center">
                <Icon name="AlertTriangle" size={18} className="mr-2" /> {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleConfirmDelete}
                disabled={deleting}
                iconName={deleting ? 'Loader2' : 'Trash2'}
                iconPosition="left"
              >
                {deleting ? 'Deleting...' : 'Delete Team'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EditTeamModal;
