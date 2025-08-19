import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';

export default function TeamSetup() {
  const navigate = useNavigate();
  const { user } = useAuth(); // Current logged-in user
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(''); // Current user's phone number
  const [teamData, setTeamData] = useState({
    name: '',
    sport: '', // e.g., Basketball, Soccer
    season: '', // e.g., 2024-2025
  });
  // Members array for the table, with all specified fields and an initial empty row
  const [members, setMembers] = useState([
    { name: '', email: '', phoneNumber: '', role: 'player', allergies: '' }
  ]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(''); // For success messages
  const [csvFile, setCsvFile] = useState(null); // State for uploaded CSV file

  // Roles for team members, now transformed for the Select component's `options` prop
  const memberRolesOptions = ['player', 'coach', 'head coach', 'staff', 'custom'].map(role => ({
    label: role.charAt(0).toUpperCase() + role.slice(1),
    value: role
  }));

  useEffect(() => {
    if (!user) {
      navigate('/login-registration');
    } else {
      // Fetch current user's phone number on load if available in user_profiles
      const fetchUserProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('*') 
            .eq('id', user.id)
            .single();

          if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found (new user)
            console.error('Error fetching user profile:', error.message);
          } else if (data) {
            setPhoneNumber(data.phone);
            console.log('Fetched user profile (all columns):', data);
          }
        } catch (err) {
          console.error('Unexpected error fetching user profile:', err);
        }
      };
      fetchUserProfile();
    }
  }, [user, navigate]);

  const handleTeamDataChange = (field, value) => {
    setTeamData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMemberChange = (index, field, value) => {
    const updatedMembers = members.map((member, i) => 
      i === index ? { ...member, [field]: value } : member
    );
    setMembers(updatedMembers);
  };

  const addMemberRow = () => {
    setMembers([...members, { name: '', email: '', phoneNumber: '', role: 'player', allergies: '' }]);
  };

  const removeMemberRow = (index) => {
    setMembers(members.filter((_, i) => i !== index));
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        parseCsv(text);
      };
      reader.readAsText(file);
    }
  };

  const parseCsv = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) {
      setError('CSV file is empty.');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const expectedHeaders = ['name', 'email', 'phone number', 'role', 'allergies'];

    // Basic header validation
    const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
      setError(`CSV is missing required headers: ${missingHeaders.join(', ')}. Expected: ${expectedHeaders.join(', ')}`);
      return;
    }

    const parsedMembers = lines.slice(1).map(line => {
      const values = line.split(',');
      const member = {};
      headers.forEach((header, index) => {
        const key = header === 'phone number' ? 'phoneNumber' : header; // Normalize 'phone number'
        member[key] = values[index] ? values[index].trim() : '';
      });

      // Default role if not provided or invalid
      if (!memberRolesOptions.some(opt => opt.value === member.role)) { // Check against value
        member.role = 'player';
      }
      return member;
    });
    setMembers(prevMembers => [...prevMembers, ...parsedMembers]); // Append parsed members
    setSuccess('CSV members loaded. Review and save below.');
    setError('');
  };


  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Update current user's phone number in user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ phone: phoneNumber })
        .eq('id', user.id);
      
      if (profileError) {
        console.error('Error updating user profile phone number:', profileError.message);
        throw new Error('Failed to save your phone number.');
      }

      // 2. Create team
      // teamService is assumed to handle team creation and linking to user via 'teams_users'
      // For this example, we'll create the team and assume the current user is added as coach/admin implicitly
      const { data: createdTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamData.name,
          sport: teamData.sport,
          season: teamData.season,
          created_by: user.id // Link team to the user who created it
        })
        .select()
        .single();
      
      if (teamError) {
        console.error('Error creating team:', teamError.message);
        throw new Error('Failed to create team. ' + teamError.message);
      }

      // Automatically link the creating user to the team in teams_users as an admin/coach
      const { error: linkUserError } = await supabase
        .from('teams_users')
        .insert({
          team_id: createdTeam.id,
          user_id: user.id,
          role: 'coach' // Or 'admin', depending on your default for team creators
        });

      if (linkUserError) {
        console.error('Error linking user to team:', linkUserError.message);
        // This might not be a critical error to stop the whole process if team is created
      }

      // 3. Add members to the new 'team_members' table
      const validMembers = members.filter(member => 
        member.name.trim() && member.email.trim() && member.role.trim()
      );

      if (validMembers.length > 0) {
        const membersToInsert = validMembers.map(member => ({
          team_id: createdTeam.id,
          name: member.name,
          email: member.email,
          phone_number: member.phoneNumber, // This will be stored as phone_number in team_members table
          role: member.role,
          allergies: member.allergies,
        }));

        const { error: membersError } = await supabase
          .from('team_members')
          .insert(membersToInsert);

        if (membersError) {
          console.error('Error adding team members:', membersError.message);
          throw new Error('Failed to add some team members.');
        }
      }

      setSuccess('Team created and members added successfully!');
      setTimeout(() => navigate('/dashboard-home'), 2000);

    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      setSuccess('');
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex-grow max-w-4xl mx-auto px-4 py-8 w-full"> {/* Increased max-w for table */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Set Up Your Team 🏀🏈📣</h1>
            <p className="text-gray-600">Let's get your team ready for MealOps. This is where you'll define your team and add your roster!</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 flex items-center">
                <Icon name="XCircle" size={20} className="mr-2" /> {error}
              </p>
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-green-800 flex items-center">
                <Icon name="CheckCircle" size={20} className="mr-2" /> {success}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8"> {/* Increased spacing */}
            {/* 1. Your Information for Notifications */}
            <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
              <h2 className="text-lg font-semibold text-blue-800 flex items-center">
                <Icon name="Bell" size={20} className="mr-2" /> Your Contact Info (for Notifications)
              </h2>
              <p className="text-sm text-gray-600">This phone number will be used to send you important order notifications. You can change it later in your profile settings.</p>
              <div>
                <Input
                  label="Phone Number"
                  type="tel" // Use tel type for phone numbers
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g., (555) 123-4567"
                  description="Format: (XXX) XXX-XXXX or XXXXXXXXXX"
                />
              </div>
            </div>

            {/* 2. Team Information */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Icon name="Users" size={20} className="mr-2" /> Team Details
              </h2>
              
              <div>
                <Input
                  label="Team Name *"
                  type="text"
                  value={teamData.name}
                  onChange={(e) => handleTeamDataChange('name', e.target.value)}
                  placeholder="e.g., Warriors Basketball"
                  required
                />
              </div>

              <div>
                <Input
                  label="Sport"
                  type="text"
                  value={teamData.sport}
                  onChange={(e) => handleTeamDataChange('sport', e.target.value)}
                  placeholder="e.g., Basketball, Football, Soccer"
                />
              </div>

              <div>
                <Input
                  label="Season Year"
                  type="text" // Use text for year to allow "Fall 2024" or "2024-2025"
                  value={teamData.season}
                  onChange={(e) => handleTeamDataChange('season', e.target.value)}
                  placeholder="e.g., 2024-2025, Spring 2025"
                />
              </div>
            </div>

            {/* 3. Team Roster / Members */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Icon name="ClipboardList" size={20} className="mr-2" /> Team Roster
                </h2>
                <div className="flex space-x-2">
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild // Render as a child for the label to wrap the button
                    >
                      <span>
                        <Icon name="Upload" size={16} className="mr-2" /> Import CSV
                      </span>
                    </Button>
                  </label>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMemberRow}
                  >
                    <Icon name="Plus" size={16} className="mr-2" /> Add Member
                  </Button>
                </div>
              </div>

              {members.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name *</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email *</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role *</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allergies</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {members.map((member, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Input
                              type="text"
                              value={member.name}
                              onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                              placeholder="Name"
                              className="!border-none !ring-0 !shadow-none !p-0" // Make it look like plain text
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Input
                              type="email"
                              value={member.email}
                              onChange={(e) => handleMemberChange(index, 'email', e.target.value)}
                              placeholder="Email"
                              className="!border-none !ring-0 !shadow-none !p-0"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Input
                              type="tel"
                              value={member.phoneNumber}
                              onChange={(e) => handleMemberChange(index, 'phoneNumber', e.target.value)}
                              placeholder="Phone"
                              className="!border-none !ring-0 !shadow-none !p-0"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Select
                              value={member.role}
                              options={memberRolesOptions}
                              onChange={(value) => handleMemberChange(index, 'role', value)}
                              className="!border-none !ring-0 !shadow-none !p-0"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Input
                              type="text"
                              value={member.allergies}
                              onChange={(e) => handleMemberChange(index, 'allergies', e.target.value)}
                              placeholder="Allergies (optional)"
                              className="!border-none !ring-0 !shadow-none !p-0"
                            />
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMemberRow(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Icon name="Trash" size={16} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {members.length === 0 && (
                <p className="text-center text-gray-500 py-4">No members added yet. Use "Add Member" or "Import CSV" to get started.</p>
              )}
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
                disabled={loading || !teamData.name.trim()} // Require team name
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