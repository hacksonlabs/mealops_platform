import React, { useState, useRef, useEffect } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';
import { toTitleCase } from '../../../utils/stringUtils';

const EditTeamModal = ({ team, onClose, onUpdate, loading }) => {
  const [name, setName] = useState(team?.name || '');
  const [sport, setSport] = useState(team?.sport || '');
  const [conferenceName, setConferenceName] = useState(team?.conference_name || '');
  const [gender, setGender] = useState(team?.gender || '');
  const [error, setError] = useState('');

  // keep local state in sync if the parent passes a new team
  useEffect(() => {
    setName(team?.name || '');
    setSport(team?.sport || '');
    setConferenceName(team?.conference_name || '');
    setGender(team?.gender || '');
  }, [team]);

  // --- Close on overlay click & Esc ---
  const overlayRef = useRef(null);
  const handleOverlayMouseDown = (e) => {
    if (e.target === overlayRef.current) onClose?.();
  };
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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

  return (
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
            disabled={loading}
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
              Team Name
            </label>
            <Input
              id="teamName"
              value={name}
              onChange={onNameChange}
              placeholder="Enter team name"
              required
              autoFocus
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
              placeholder="e.g., WESTERN LEAGUE"
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
            />
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTeamModal;
