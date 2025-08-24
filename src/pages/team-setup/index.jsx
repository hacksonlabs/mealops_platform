import React, { useState, useMemo, useEffect } from 'react';
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

  // Prefill phone number from user profile (once)
  useEffect(() => {
    if (authLoading) return;
    const fromProfile = normalizePhoneNumber(userProfile?.phone || '');
    if (fromProfile && !phoneNumber) {
      setPhoneNumber(fromProfile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, userProfile?.phone]);

  const normalizeMemberField = (field, value) => {
    const v = String(value ?? '');
    switch (field) {
      case 'name':
      case 'allergies':
        return toTitleCase(v);
      case 'email':
        return v.trim().toLowerCase();
      case 'phoneNumber':
        return normalizePhoneNumber(v);
      case 'birthday':
        return normalizeBirthday(v);           // keeps yyyy-MM-dd for <input type="date">
      case 'role':
        return String(v || 'player').toLowerCase();
      default:
        return v;
    }
  };

  const handleTeamDataChange = (field, value) => {
    let v = value;
    if (field === 'name' || field === 'sport') v = toTitleCase(value);
    else if (field === 'conference') v = value.toUpperCase();

    setTeamData(prev => ({ ...prev, [field]: v }));

    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handlePhoneNumberChange = (e) => {
    const raw = e.target.value;
    const formatted = normalizePhoneNumber(raw);
    setPhoneNumber(formatted);

    if (validationErrors.phone) {
      setValidationErrors(prev => {
        const next = { ...prev };
        delete next.phone;
        return next;
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
    const formatted = normalizeMemberField(field, value);
    setMembers(prev =>
      prev.map((m, i) => (i === index ? { ...m, [field]: formatted } : m))
    );
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
    // strip BOM
    let text = String(csvText || '').replace(/^\uFEFF/, '');
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');
    if (lines.length <= 1) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError('CSV file is empty or contains only headers.');
      return;
    }

    // header normalization
    const headerMap = {
      'name': 'name',
      'email': 'email',
      'phone number': 'phoneNumber',
      'phone #': 'phoneNumber',
      'phone_number': 'phoneNumber',
      'phone': 'phoneNumber',
      'role': 'role',
      'allergies': 'allergies',
      'birthday': 'birthday',
      'bday': 'birthday',
    };

    const rawHeaders = splitCsvLine(lines[0]);
    const headers = rawHeaders.map(h => String(h || '').trim().toLowerCase());

    const requiredHeaders = ['name', 'email', 'phone number'];
    const hasRequiredHeaders = requiredHeaders.every(req =>
      headers.some(h => headerMap[h] === headerMap[req])
    );
    if (!hasRequiredHeaders) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError(`CSV is missing required headers: ${requiredHeaders.join(', ')}`);
      return;
    }

    // Parse rows
    const parsedMembers = [];
    for (let i = 1; i < lines.length; i++) {
      const values = splitCsvLine(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        const key = headerMap[h] || h;
        let v = values[idx] ?? '';
        switch (key) {
          case 'name':        v = toTitleCase(v); break;
          case 'email':       v = String(v).toLowerCase().trim(); break;
          case 'phoneNumber': v = normalizePhoneNumber(v); break;
          case 'birthday':    v = normalizeBirthday(v); break; // yyyy-MM-dd
          case 'allergies':   v = toTitleCase(v); break;
          case 'role':        v = String(v || 'player').toLowerCase(); break;
          default: break;
        }
        row[key] = v;
      });

      if (!['player','coach','staff'].includes(row.role)) row.role = 'player';
      parsedMembers.push(row);
    }

    // Ensure coach in CSV becomes 'coach'
    if (user?.email) {
      const coachIdx = parsedMembers.findIndex(m => (m.email || '').toLowerCase() === user.email.toLowerCase());
      if (coachIdx !== -1) parsedMembers[coachIdx].role = 'coach';
    }

    if (!parsedMembers.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError('CSV file does not contain any valid member data rows.');
      return;
    }

    // --- De-duplication ---
    // Start with keys from what's already on the page
    const existingKeys = new Set(
      members.map(m => dedupKeyFor(m)).filter(Boolean)
    );

    const uniqueNew = [];
    const duplicates = [];

    for (const m of parsedMembers) {
      const key = dedupKeyFor(m);
      if (!key) continue; // skip rows we can't identify
      if (existingKeys.has(key)) {
        duplicates.push(m);
      } else {
        existingKeys.add(key); // important: add now so later rows in the same CSV are compared
        uniqueNew.push(m);
      }
    }

    if (!uniqueNew.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setError('All rows in the CSV were duplicates of existing entries.');
      return;
    }

    setMembers(prev => [...prev, ...uniqueNew]);

    const dupMsg = duplicates.length
      ? ` (${duplicates.length} duplicate ${duplicates.length === 1 ? 'row was' : 'rows were'} skipped)`
      : '';
    setSuccess(`CSV members loaded. Review and save below.${dupMsg}`);
    setError('');
  };


  // Robust CSV line splitter (handles quoted commas, escaped quotes)
  const splitCsvLine = (line) => {
    const out = [];
    let cur = '', inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur.trim()); cur = '';
      } else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  // Build a de-duplication key for a member.
  // Priority: email (lowercased) -> normalized phone -> Name+Birthday -> Name
  const dedupKeyFor = (m) => {
    const email = String(m?.email || '').trim().toLowerCase();
    if (email) return `e:${email}`;
    const phoneRaw = m?.phoneNumber ?? m?.phone ?? '';
    const phone = normalizePhoneNumber(phoneRaw || '');
    if (phone) return `p:${phone}`;
    const name = toTitleCase(m?.name || '');
    const bday = normalizeBirthday(m?.birthday || '');
    if (name && bday) return `nb:${name}|${bday}`;
    if (name) return `n:${name}`;
    return null; // nothing to dedupe on (shouldn't happen if CSV requires email/phone)
  };

  // Finds duplicates *within* a list (e.g., your current roster before submit).
  // Returns an array of arrays (duplicate groups).
  const findIntraListDuplicates = (arr) => {
    const map = new Map();
    const groups = [];
    arr.forEach((m, idx) => {
      const key = dedupKeyFor(m);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ idx, m });
    });
    for (const [, list] of map) {
      if (list.length > 1) groups.push(list);
    }
    return groups;
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
      newErrors.name = 'Mascot is required';
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

    // Check for duplicates among the on-screen members before saving
    const rosterDupGroups = findIntraListDuplicates(members);
    if (rosterDupGroups.length) {
      const preview = rosterDupGroups
        .map(group => {
          const labels = group.map(({ m }) => m.email || m.phoneNumber || m.name).join(', ');
          return `- ${labels}`;
        })
        .join('\n');

      setError(`You have duplicate roster entries. Please resolve before continuing:\n${preview}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setLoading(false);
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
                    label="Mascot"
                    type="text"
                    value={teamData.name}
                    onChange={(e) => handleTeamDataChange('name', e.target.value)}
                    placeholder="e.g., Panthers"
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