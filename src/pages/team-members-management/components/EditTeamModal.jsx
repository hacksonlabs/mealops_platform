import React, { useState, useRef, useEffect } from 'react';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import Icon from '../../../components/AppIcon';
import { toTitleCase } from '../../../utils/stringUtils';

const EditTeamModal = ({
  team,
  onClose,
  onUpdate,
  loading,
  canDelete = false,            // passed in by parent
  onDeleteTeam,                 // passed in by parent (async)
}) => {
  const [name, setName] = useState(team?.name || '');
  const [sport, setSport] = useState(team?.sport || '');
  const [conferenceName, setConferenceName] = useState(team?.conference_name || '');
  const [gender, setGender] = useState(team?.gender || '');
  const [error, setError] = useState('');

  // delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // keep local state in sync if the parent passes a new team
  useEffect(() => {
    setName(team?.name || '');
    setSport(team?.sport || '');
    setConferenceName(team?.conference_name || '');
    setGender(team?.gender || '');
  }, [team]);

  // --- Close on overlay click & Esc (outer modal) ---
  const overlayRef = useRef(null);
  const handleOverlayMouseDown = (e) => {
    // If the confirm dialog is open, don't close the parent on backdrop click
    if (showDeleteConfirm) return;
    if (e.target === overlayRef.current) onClose?.();
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // If confirm dialog is open, close it first
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
        return;
      }
      onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, showDeleteConfirm]);

  // --- Confirm dialog overlay click + Esc ---
  const confirmOverlayRef = useRef(null);
  const handleConfirmOverlayMouseDown = (e) => {
    if (e.target === confirmOverlayRef.current) setShowDeleteConfirm(false);
  };
  useEffect(() => {
    if (!showDeleteConfirm) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setShowDeleteConfirm(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showDeleteConfirm]);

  // --- Format on input change ---
  const onNameChange = (e) => {
    const v = toTitleCase(e.target.value).replace(/\s+/g, ' ');
    setName(v);
  };
  const onSportChange = (e) => {
    const v = toTitleCase(e.target.value).replace(/\s+/g, ' ');
    setSport(v);
  };
  const onConferenceChange = (e) => {
    const v = String(e.target.value || '').toUpperCase().replace(/\s+/g, ' ');
    setConferenceName(v);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const payload = {
      name: toTitleCase((name || '').trim()),
      sport: toTitleCase((sport || '').trim()),
      conference_name: (conferenceName || '').trim().toUpperCase(),
      gender: (gender || '').trim(),
    };

    if (!payload.name || !payload.sport || !payload.gender) {
      setError('Name, Sport, and Gender are required.');
      return;
    }

    await onUpdate(payload);
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
              disabled={loading || deleting}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-800 flex items-center">
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
                value={name}
                onChange={onNameChange}
                placeholder="e.g., Panthers"
                required
                autoFocus
                disabled={loading || deleting}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="teamSport" className="block text-sm font-medium text-muted-foreground mb-1">
                Sport
              </label>
              <Input
                id="teamSport"
                value={sport}
                onChange={onSportChange}
                placeholder="e.g., Basketball"
                required
                disabled={loading || deleting}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="teamConference" className="block text-sm font-medium text-muted-foreground mb-1">
                Conference Name
              </label>
              <Input
                id="teamConference"
                value={conferenceName}
                onChange={onConferenceChange}
                placeholder="e.g., Pac-12 💀"
                disabled={loading || deleting}
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="teamGender" className="block text-sm font-medium text-muted-foreground mb-1">
                Gender
              </label>
              <Select
                id="teamGender"
                value={gender}
                onChange={setGender}
                options={[
                  { value: 'womens', label: 'Womens' },
                  { value: 'mens', label: 'Mens' },
                  { value: 'coed', label: 'Coed' },
                ]}
                placeholder="Select gender"
                required
                disabled={loading || deleting}
              />
            </div>

            <div className="mt-16 flex justify-between items-center">
              {/* Danger zone: open confirm modal */}
              <div className="flex items-center">
                {canDelete ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    iconName="Trash2"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={loading || deleting}
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
                <Button variant="outline" type="button" onClick={onClose} disabled={loading || deleting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading || deleting}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Separate confirmation popup */}
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
              This will permanently delete <strong className="text-foreground">{team?.name}</strong> and remove all of its
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
