import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts';
import { supabase } from '../../lib/supabase';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import { toTitleCase, normalizePhoneNumber, normalizeBirthday } from '../../utils/stringUtils'

export default function TeamSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, loading: authLoading } = useAuth(); // Current logged-in user
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [teamData, setTeamData] = useState({
    name: '',
    sport: '',
    conference: '',
    gender: '',
  });
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const memberRolesOptions = useMemo(() => ['player', 'coach', 'staff'].map(role => ({
    label: role.charAt(0).toUpperCase() + role.slice(1),
    value: role
  })), []);
  const genderOptions = [
    { label: 'Womens', value: 'womens' },
    { label: 'Mens', value: 'mens' },
    { label: 'Coed', value: 'coed' },
  ];

  const handleTeamDataChange = (field, value) => {
    setTeamData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear the specific error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handlePhoneNumberChange = (e) => {
    const value = e.target.value;
    setPhoneNumber(value);
    // Clear the phone number error as the user types
    if (validationErrors.phone) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.phone;
        return newErrors;
      });
    }
  };

  const handleClearError = () => {
    setError('');
  };
  const handleClearSuccess = () => {
    setSuccess('');
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
    // strip BOM if present (Excel/Numbers export)
    let text = String(csvText || '').replace(/^\uFEFF/, '');
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');
    if (lines.length <= 1) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError('CSV file is empty or contains only headers.');
      return;
    }

    // Define a mapping of possible header names to their correct key
    const headerMap = {
      'name': 'name',
      'Name': 'name',
      'email': 'email',
      'Email': 'email',
      'Phone Number': 'phoneNumber',
      'phone #': 'phoneNumber',
      'Phone #': 'phoneNumber',
      'phone number': 'phoneNumber',
      'phone_number': 'phoneNumber',
      'phone': 'phoneNumber',
      'role': 'role',
      'Role': 'role',
      'allergies': 'allergies',
      'Allergies': 'allergies',
      'birthday': 'birthday',
      'Birthday': 'birthday',
      'bday': 'birthday',
      'Bday': 'birthday',
    };

    // Get the headers from the CSV and normalize them
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Check if the CSV contains at least the core required headers
    const requiredHeaders = ['name', 'email', 'phone number'];
    const hasRequiredHeaders = requiredHeaders.every(reqHeader => 
      headers.some(h => headerMap[h] === headerMap[reqHeader])
    );
    
    if (!hasRequiredHeaders) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError(`CSV is missing required headers: ${requiredHeaders.join(', ')}`);
      return;
    }

    let parsedMembers = lines.slice(1).map(line => {
      const values = line.split(',');
      const member = {};
      
      headers.forEach((header, index) => {
        const key = headerMap[header] || header;
        let value = values[index] ? values[index].trim() : '';
        
        switch (key) {
          case 'name':
            value = toTitleCase(value);
            break;
          case 'email':
            value = value.toLowerCase();
            break;
          case 'phoneNumber':
            value = normalizePhoneNumber(value);
            break;
          case 'birthday':
            value = normalizeBirthday(value);
            break;
          case 'allergies':  
            value = toTitleCase(value); 
            break;
          default:
            // No formatting for other fields
        }
        
        member[key] = value;
      });

      if (!member.role || !memberRolesOptions.some(opt => opt.value === member.role)) {
        member.role = 'player';
      }
      return member;
    });

    if (user && user.email) {
      const coachIndex = parsedMembers.findIndex(
        member => member.email.toLowerCase() === user.email.toLowerCase()
      );
      if (coachIndex !== -1) {
        parsedMembers[coachIndex].role = 'coach';
      }
    }

    if (parsedMembers.length === 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError('CSV file does not contain any valid member data rows.');
      return;
    }

    const existingEmails = new Set(members.map(m => m.email.toLowerCase()));
    const uniqueNewMembers = parsedMembers.filter(member => 
      !existingEmails.has(member.email.toLowerCase())
    );

    if (uniqueNewMembers.length === 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError('No new unique members found in the CSV file.');
      return;
    }

    setMembers(prevMembers => [...prevMembers, ...uniqueNewMembers]);
    // window.scrollTo({ top: 0, behavior: 'smooth' });
    setSuccess('CSV members loaded. Review and save below.');
    setError('');
  };


  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setValidationErrors({});

    // --- Start Validation Logic ---
    const newErrors = {};

    if (!phoneNumber) {
        newErrors.phone = 'Phone number is required for order notifications';
    } else if (!/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(phoneNumber)) {
        newErrors.phone = 'Please enter a valid 10-digit phone number';
    }

    if (!teamData?.sport) {
      newErrors.sport = 'Sport type is required';
    } else if (teamData.sport.length < 2) {
      newErrors.sport = 'Sport type must be at least 2 characters';
    }

    if (!teamData?.conference) {
      newErrors.conference = 'Conference name is required';
    } else if (teamData.conference.length < 2) {
      newErrors.conference = 'Conference name must be at least 2 characters';
    }

    if (!teamData?.name) {
      newErrors.name = 'Team name is required';
    }

    if (!teamData?.gender) {
      newErrors.gender = 'Gender is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setValidationErrors(newErrors);
      setLoading(false);
      setError('Please fix the errors in your form.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      // Update current user's phone number in user_profiles
      const userCoachRecord = members.find(m => m.email.toLowerCase() === user.email.toLowerCase());
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ 
          phone: normalizePhoneNumber(phoneNumber),
          allergies: toTitleCase(userCoachRecord?.allergies || ''),
          birthday: userCoachRecord?.birthday,
         })
        .eq('id', user.id);
      
      if (profileError) {
        console.error('Error updating user profile phone number:', profileError.message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        throw new Error('Failed to save your phone number.');
      }

      // Create team
      const { data: createdTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: toTitleCase(teamData.name),
          sport: toTitleCase(teamData.sport),
          conference_name: teamData.conference.toUpperCase(),
          gender: teamData.gender,
          coach_id: user.id // Link team to the user who created it
        })
        .select()
        .single();
      
      if (teamError) {
        console.error('Error creating team:', teamError.message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        throw new Error('Failed to create team. ' + teamError.message);
      }

      const validMembers = members.filter(member => 
        member.name.trim() && member.email.trim() && member.role.trim()
      );

      const membersToInsert = validMembers.map(member => ({
        team_id: createdTeam.id,
        user_id: null,
        role: member.role,
        full_name: toTitleCase(member.name), 
        email: member.email.toLowerCase(),
        phone_number: normalizePhoneNumber(member.phoneNumber),
        allergies: toTitleCase(member.allergies),
        birthday: member.birthday, // yyyy-MM-dd format
      }));

      const isCoachInList = membersToInsert.some(m => m.email === user.email);

      // If the coach is not in the list (e.g., they weren't in the CSV), add them now.
      if (!isCoachInList) {
        membersToInsert.push({
          team_id: createdTeam.id,
          user_id: user.id,
          role: 'coach',
          full_name: `${toTitleCase(userProfile?.first_name)} ${toTitleCase(userProfile?.last_name)}`,
          email: user.email.toLowerCase(),
          phone_number: phoneNumber,
          allergies: userProfile?.allergies ? toTitleCase(userProfile.allergies) : null,
          birthday: userProfile?.birthday || null,
        });
      } else {
        // If the coach IS in the list (e.g., via CSV), update their record
        const coachRecord = membersToInsert.find(m => m.email === user.email);
        if (coachRecord) {
          coachRecord.user_id = user.id;
          coachRecord.full_name = `${toTitleCase(userProfile?.first_name)} ${toTitleCase(userProfile?.last_name)}`;
          coachRecord.email = user.email.toLowerCase();
        }
      }

      const { error: membersError } = await supabase
        .from('team_members')
        .insert(membersToInsert);

      if (membersError) {
        console.error('Error adding team members:', membersError.message);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        throw new Error('Failed to add some team members.');
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
      setSuccess('Team created and members added successfully!');
      const nextPath = location.state?.next || '/team-members-management';
      setTimeout(() => navigate(nextPath, { replace: true }), 2000);

    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/login-registration');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <div className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="bg-white rounded-lg shadow-sm border p-6 mt-20">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Set Up Your Team</h1>
            <p className="text-gray-600">Let's get your team ready for MealOps. This is where you'll define your team and add your roster!</p>
          </div>

          {/* Main Error Banner */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md relative pr-10">
              <p className="text-red-800 flex items-center">
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

          {/* Success Banner */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md relative pr-10">
              <p className="text-green-800 flex items-center">
                <Icon name="CheckCircle" size={20} className="mr-2" /> {success}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSuccess}
                className="absolute top-1 right-1 text-green-600 hover:text-green-700 p-1"
              >
                <Icon name="X" size={16} />
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 1. User Information for Notifications */}
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
                  onChange={handlePhoneNumberChange}
                  placeholder="e.g., (555) 123-4567"
                  // description="Format: (XXX) XXX-XXXX or XXXXXXXXXX"
                  error={validationErrors.phone}
                />
              </div>
            </div>

            {/* 2. Team Information */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Icon name="Users" size={20} className="mr-2" /> Team Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Team Name"
                    type="text"
                    value={teamData.name}
                    onChange={(e) => handleTeamDataChange('name', e.target.value)}
                    placeholder="e.g., Warriors Basketball"
                    required
                    error={validationErrors.name}
                  />
                </div>

                <div>
                  <Input
                    label="Sport"
                    type="text"
                    value={teamData.sport}
                    onChange={(e) => handleTeamDataChange('sport', e.target.value)}
                    placeholder="e.g., Basketball, Football, Soccer"
                    required
                    error={validationErrors.sport}
                  />
                </div>

                <div>
                  <Input
                    label="Conference"
                    type="text"
                    value={teamData.conference}
                    onChange={(e) => handleTeamDataChange('conference', e.target.value)}
                    placeholder="e.g., Pac-12 💀"
                    required
                    error={validationErrors.conference}
                  />
                </div>

                <div>
                  <Select
                    id="gender"
                    name="gender"
                    label="Gender"
                    placeholder="Select a gender"
                    options={genderOptions}
                    value={teamData.gender}
                    onChange={(value) => handleTeamDataChange('gender', value)}
                    required
                    error={validationErrors.gender}
                  />
                </div>
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
                <div className="">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th scope="col" className="w-1/4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                        <th scope="col" className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone #</th>
                        <th scope="col" className="w-1/6 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th scope="col" className="px-3 py-2 pr-5 text-left text-xs font-medium text-gray-500 tracking-wider italic">allergies</th>
                        <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider italic">birthday</th>
                        <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {members.map((member, index) => (
                        <tr key={index}>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <Input
                              type="text"
                              value={member.name}
                              onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                              placeholder=" Name"
                              className="!border-none !ring-0 !shadow-none !p-0"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <Input
                              type="email"
                              value={member.email}
                              onChange={(e) => handleMemberChange(index, 'email', e.target.value)}
                              placeholder=" Email"
                              className="!border-none !ring-0 !shadow-none !p-0"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <Input
                              type="tel"
                              value={member.phoneNumber}
                              onChange={(e) => handleMemberChange(index, 'phoneNumber', e.target.value)}
                              placeholder=" (xxx) xxx-xxxx"
                              className="!border-none !ring-0 !shadow-none !p-0"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <Select
                              value={member.role}
                              options={memberRolesOptions}
                              onChange={(value) => handleMemberChange(index, 'role', value)}
                              className="!border-none !ring-0 !shadow-none !p-0"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <Input
                              type="text"
                              value={member.allergies}
                              onChange={(e) => handleMemberChange(index, 'allergies', e.target.value)}
                              placeholder=" Optional.."
                              className="!border-none !ring-0 !shadow-none !p-0 italic"
                            />
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                              <Input
                                type="date"
                                value={member.birthday || ''}
                                onChange={(e) => handleMemberChange(index, 'birthday', e.target.value)}
                                className="!border-none !ring-0 !shadow-none !p-0"
                              />
                            </td>
                          <td className="px-0.5 py-0.5 whitespace-nowrap text-right text-sm font-medium">
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
                disabled={loading || !teamData.name.trim()}
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