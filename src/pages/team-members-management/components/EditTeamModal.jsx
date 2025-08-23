import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';


const EditTeamModal = ({ team, onClose, onUpdate, loading }) => {
  const [name, setName] = useState(team?.name || '');
  const [sport, setSport] = useState(team?.sport || '');
  const [conferenceName, setConferenceName] = useState(team?.conference_name || '');
  const [gender, setGender] = useState(team?.gender || '');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !sport || !gender) {
      setError('Name, Sport, and Gender are required.');
      return;
    }
    await onUpdate({ name, sport, conference_name: conferenceName, gender });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card p-6 rounded-lg shadow-xl max-w-lg w-full">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Edit Team Information</h2>
        {error && <p className="text-destructive mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="teamName" className="block text-sm font-medium text-muted-foreground mb-1">Team Name</label>
            <Input
              id="teamName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter team name"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="teamSport" className="block text-sm font-medium text-muted-foreground mb-1">Sport</label>
            <Input
              id="teamSport"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              placeholder="e.g., Basketball"
              required
            />
          </div>
          <div className="mb-4">
            <label htmlFor="teamConference" className="block text-sm font-medium text-muted-foreground mb-1">Conference Name</label>
            <Input
              id="teamConference"
              value={conferenceName}
              onChange={(e) => setConferenceName(e.target.value)}
              placeholder="e.g., Western League"
            />
          </div>
          <div className="mb-6">
            <label htmlFor="teamGender" className="block text-sm font-medium text-muted-foreground mb-1">Gender</label>
            <Select
              id="teamGender"
              value={gender}
              onChange={setGender}
              options={[
                { value: 'womens', label: 'Womens' },
                { value: 'mens', label: 'Mens' },
                { value: 'coed', label: 'Coed' },
              ]}
              placeholder={gender}
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