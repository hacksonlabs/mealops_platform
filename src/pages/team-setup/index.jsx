import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { teamService } from '../../services/teamService';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';

export default function TeamSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [teamData, setTeamData] = useState({
    name: '',
    sport: '',
    season: '',
  });
  const [members, setMembers] = useState([
    { email: '', role: 'player', name: '' }
  ]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login-registration');
    }
  }, [user, navigate]);

  const handleTeamDataChange = (field, value) => {
    setTeamData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMemberChange = (index, field, value) => {
    const updatedMembers = members?.map((member, i) => 
      i === index ? { ...member, [field]: value } : member
    );
    setMembers(updatedMembers);
  };

  const addMember = () => {
    setMembers([...members, { email: '', role: 'player', name: '' }]);
  };

  const removeMember = (index) => {
    setMembers(members?.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Create team
      const { data: team, error: teamError } = await teamService?.createTeam(teamData);
      
      if (teamError) throw teamError;

      // Add members (skip empty ones)
      const validMembers = members?.filter(member => member?.email?.trim());
      
      for (const member of validMembers) {
        await teamService?.addTeamMember(team?.id, member?.email?.trim());
      }

      navigate('/dashboard-home');
    } catch (error) {
      setError(error?.message || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to set up your team.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Set Up Your Team</h1>
            <p className="text-gray-600 mt-2">Create your team and add members to get started with MealOps.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Team Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Team Information</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Team Name *
                </label>
                <Input
                  type="text"
                  value={teamData?.name}
                  onChange={(e) => handleTeamDataChange('name', e?.target?.value)}
                  placeholder="e.g., Warriors Basketball"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sport
                </label>
                <Input
                  type="text"
                  value={teamData?.sport}
                  onChange={(e) => handleTeamDataChange('sport', e?.target?.value)}
                  placeholder="e.g., Basketball"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Season
                </label>
                <Input
                  type="text"
                  value={teamData?.season}
                  onChange={(e) => handleTeamDataChange('season', e?.target?.value)}
                  placeholder="e.g., 2024-2025"
                />
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMember}
                >
                  Add Member
                </Button>
              </div>

              <div className="space-y-3">
                {members?.map((member, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 border rounded-lg">
                    <div>
                      <Input
                        type="email"
                        value={member?.email}
                        onChange={(e) => handleMemberChange(index, 'email', e?.target?.value)}
                        placeholder="Email address"
                      />
                    </div>
                    
                    <div>
                      <Select
                        value={member?.role}
                        onValueChange={(value) => handleMemberChange(index, 'role', value)}
                      >
                        <option value="player">Player</option>
                        <option value="coach">Coach</option>
                        <option value="admin">Admin</option>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        type="text"
                        value={member?.name}
                        onChange={(e) => handleMemberChange(index, 'name', e?.target?.value)}
                        placeholder="Full name (optional)"
                        className="flex-1"
                      />
                      {members?.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeMember(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard-home')}
              >
                Skip for Now
              </Button>
              <Button
                type="submit"
                disabled={loading || !teamData?.name?.trim()}
              >
                {loading ? 'Creating Team...' : 'Create Team'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}