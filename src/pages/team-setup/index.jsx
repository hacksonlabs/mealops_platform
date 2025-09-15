// src/pages/team-setup/index.jsx (or wherever this file lives)
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts';
import { supabase } from '../../lib/supabase';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/custom/Button';
import Input from '../../components/ui/custom/Input';
import Select from '../../components/ui/custom/Select';
import Icon from '../../components/AppIcon';
import { toTitleCase, normalizePhoneNumber, normalizeBirthday } from '../../utils/stringUtils';
import { parseMembersCsv, findIntraListDuplicates, duplicatesMessage } from '../../utils/addingTeamMembersUtils';

export default function TeamSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userProfile, loading: authLoading, refreshTeams } = useAuth();

  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [teamData, setTeamData] = useState({ name: '', sport: '', conference: '', gender: '' });
  const [members, setMembers] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const [hasDupes, setHasDupes] = useState(false);
  const [dupMsg, setDupMsg] = useState('');

  const memberRolesOptions = useMemo(
    () => ['player', 'coach', 'staff'].map((role) => ({ label: role[0].toUpperCase() + role.slice(1), value: role })),
    []
  );

  const genderOptions = [
    { label: 'Womens', value: 'womens' },
    { label: 'Mens', value: 'mens' },
    { label: 'Coed', value: 'coed' },
  ];

  // Reactively detect duplicate emails in the on-screen roster.
  useEffect(() => {
    if (!members?.length) {
      setHasDupes(false);
      setDupMsg('');
      return;
    }
    const groups = findIntraListDuplicates(members);
    const msg = groups.length ? duplicatesMessage(groups) : '';
    setHasDupes(groups.length > 0);
    setDupMsg(msg);
  }, [members]);

  // Prefill phone number:
  // 1) Try most recent non-empty phone from team_members for this user (user_id = user.id)
  // 2) Fallback to user_profiles.phone
  useEffect(() => {
    if (authLoading || !user?.id) return;

    let cancelled = false;
    (async () => {
      try {
        // Prefer an existing team phone if the user already has (or had) a team
        const { data, error } = await supabase
          .from('team_members')
          .select('phone_number, updated_at, created_at')
          .eq('user_id', user.id)
          .not('phone_number', 'is', null)
          .not('phone_number', 'eq', '')
          .order('updated_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1);

        const fromTeams = normalizePhoneNumber(data?.[0]?.phone_number || '');
        const fromProfile = normalizePhoneNumber(userProfile?.phone || '');
        const preferred = fromTeams || fromProfile;

        if (!cancelled && preferred && !phoneNumber) {
          setPhoneNumber(preferred);
        }
      } catch {
        const fallback = normalizePhoneNumber(userProfile?.phone || '');
        if (!cancelled && fallback && !phoneNumber) {
          setPhoneNumber(fallback);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id, userProfile?.phone]);

  const toNullIfEmpty = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

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
        return normalizeBirthday(v);
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

    setTeamData((prev) => ({ ...prev, [field]: v }));

    if (validationErrors[field]) {
      setValidationErrors((prev) => {
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
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next.phone;
        return next;
      });
    }
  };

  const handleClearError = () => setError('');
  const handleClearSuccess = () => setSuccess('');
  const handleClearWarning = () => setWarning('');

  const handleMemberChange = (index, field, value) => {
    const formatted = normalizeMemberField(field, value);
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: formatted } : m)));
  };

  const addMemberRow = () => {
    setMembers((prev) => [...prev, { name: '', email: '', phoneNumber: '', role: 'player', allergies: '' }]);
  };

  const removeMemberRow = (index) => setMembers((prev) => prev.filter((_, i) => i !== index));

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const { rows, errors, warnings } = parseMembersCsv(text, {
        existingMembers: members,
        currentUser: user,
      });
      if (errors?.length) setError(errors.join('\n')); else setError('');
      if (warnings?.length) setWarning(warnings.join('\n')); else setWarning('');
      if (rows?.length) setMembers((prev) => [...prev, ...rows]);
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setWarning('');
    setValidationErrors({});

    if (hasDupes) {
      setLoading(false);
      return;
    }

    const newErrors = {};
    if (!phoneNumber) {
      newErrors.phone = 'Phone number is required for order notifications';
    } else if (!/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(phoneNumber)) {
      newErrors.phone = 'Please enter a valid 10-digit phone number';
    }
    if (!teamData?.sport) newErrors.sport = 'Sport type is required';
    else if (teamData.sport.length < 2) newErrors.sport = 'Sport type must be at least 2 characters';
    if (!teamData?.conference) newErrors.conference = 'Conference name is required';
    else if (teamData.conference.length < 2) newErrors.conference = 'Conference name must be at least 2 characters';
    if (!teamData?.name) newErrors.name = 'Mascot is required';
    if (!teamData?.gender) newErrors.gender = 'Gender is required';

    if (Object.keys(newErrors).length > 0) {
      setValidationErrors(newErrors);
      setLoading(false);
      setError('Please fix the errors in your form.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      // Update current user's phone/allergies/birthday in user_profiles
      const userCoachRecord = members.find((m) => m.email.toLowerCase() === user.email.toLowerCase());
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          phone: normalizePhoneNumber(phoneNumber),
          allergies: toTitleCase(userCoachRecord?.allergies || ''),
          birthday: toNullIfEmpty(userCoachRecord?.birthday),
        })
        .eq('id', user.id);
      if (profileError) throw new Error('Failed to save your phone number.');

      // Create team
      const { data: createdTeam, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: toTitleCase(teamData.name),
          sport: toTitleCase(teamData.sport),
          conference_name: teamData.conference.toUpperCase(),
          gender: teamData.gender,
          coach_id: user.id,
        })
        .select()
        .single();
      if (teamError) throw new Error('Failed to create team. ' + teamError.message);

      // Prepare members
      const validMembers = members.filter((m) => m.name.trim() && m.email.trim() && m.role.trim());
      const membersToInsert = validMembers.map((m) => ({
        team_id: createdTeam.id,
        user_id: null,
        role: m.role,
        full_name: toTitleCase(m.name),
        email: m.email.toLowerCase(),
        phone_number: normalizePhoneNumber(m.phoneNumber),
        allergies: toTitleCase(m.allergies),
        birthday: toNullIfEmpty(m.birthday),
      }));

      // Ensure coach gets added (or normalized)
      const isCoachInList = membersToInsert.some((m) => m.email === user.email.toLowerCase());
      if (!isCoachInList) {
        membersToInsert.push({
          team_id: createdTeam.id,
          user_id: user.id,
          role: 'coach',
          full_name: `${toTitleCase(userProfile?.first_name)} ${toTitleCase(userProfile?.last_name)}`,
          email: user.email.toLowerCase(),
          phone_number: normalizePhoneNumber(phoneNumber),
          allergies: userProfile?.allergies ? toTitleCase(userProfile.allergies) : null,
          birthday: userProfile?.birthday || null,
        });
      } else {
        const coachRecord = membersToInsert.find((m) => m.email === user.email.toLowerCase());
        if (coachRecord) {
          coachRecord.user_id = user.id;
          coachRecord.full_name = `${toTitleCase(userProfile?.first_name)} ${toTitleCase(userProfile?.last_name)}`;
          coachRecord.email = user.email.toLowerCase();
        }
      }

      const { error: membersError } = await supabase.from('team_members').insert(membersToInsert);
      if (membersError) throw new Error('Failed to add some team members.');

      window.scrollTo({ top: 0, behavior: 'smooth' });
      setSuccess('Team created and members added successfully!');
      await refreshTeams(createdTeam.id);

      const nextPath = location.state?.next || '/team-members-management';
      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
      setSuccess('');
      setWarning('');
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
            <p className="text-gray-600">
              Let's get your team ready for MealOps. This is where you'll define your team and add your roster!
            </p>
          </div>

          {/* Error / Success Banners */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md relative pr-10">
              <p className="text-red-800 flex items-center">
                <Icon name="XCircle" size={20} className="mr-2" /> {error}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setError('')}
                className="absolute top-1 right-1 text-red-600 hover:text-red-700 p-1"
              >
                <Icon name="X" size={16} />
              </Button>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md relative pr-10">
              <p className="text-green-800 flex items-center">
                <Icon name="CheckCircle" size={20} className="mr-2" /> {success}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSuccess('')}
                className="absolute top-1 right-1 text-green-600 hover:text-green-700 p-1"
              >
                <Icon name="X" size={16} />
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* 1. Coach phone for notifications */}
            <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
              <h2 className="text-lg font-semibold text-blue-800 flex items-center">
                <Icon name="Bell" size={20} className="mr-2" /> Your Contact Info (for Notifications)
              </h2>
              <p className="text-sm text-gray-600">
                This phone number will be used to send you important order notifications. You can change it later in your
                profile settings.
              </p>
              <Input
                label="Phone Number"
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
                placeholder="e.g., (555) 123-4567"
                error={validationErrors.phone}
              />
            </div>

            {/* 2. Team Info */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Icon name="Users" size={20} className="mr-2" /> Team Details
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Mascot"
                  type="text"
                  value={teamData.name}
                  onChange={(e) => handleTeamDataChange('name', e.target.value)}
                  placeholder="e.g., Panthers"
                  required
                  error={validationErrors.name}
                />
                <Input
                  label="Sport"
                  type="text"
                  value={teamData.sport}
                  onChange={(e) => handleTeamDataChange('sport', e.target.value)}
                  placeholder="e.g., Basketball, Football, Soccer"
                  required
                  error={validationErrors.sport}
                />
                <Input
                  label="Conference"
                  type="text"
                  value={teamData.conference}
                  onChange={(e) => handleTeamDataChange('conference', e.target.value)}
                  placeholder="e.g., Pac-12 💀"
                  required
                  error={validationErrors.conference}
                />
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

            {/* 3. Roster */}
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Icon name="ClipboardList" size={20} className="mr-2" /> Team Roster
                </h2>
                <div className="flex space-x-2">
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <span>
                        <Icon name="Upload" size={16} className="mr-2" /> Import CSV
                      </span>
                    </Button>
                  </label>
                  <input id="csv-upload" type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                  <Button type="button" variant="outline" size="sm" onClick={addMemberRow}>
                    <Icon name="Plus" size={16} className="mr-2" /> Add Member
                  </Button>
                </div>
              </div>

              {members.length > 0 ? (
                <div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="w-1/4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone #
                        </th>
                        <th className="w-1/6 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-3 py-2 pr-5 text-left text-xs font-medium text-gray-500 tracking-wider italic">
                          allergies
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider italic">
                          birthday
                        </th>
                        <th className="px-2 py-1" />
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
              ) : (
                <p className="text-center text-gray-500 py-4">
                  No members added yet. Use "Add Member" or "Import CSV" to get started.
                </p>
              )}

              {dupMsg && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 flex items-center whitespace-pre-line text-sm">
                    <Icon name="XCircle" size={20} className="mr-2" /> {dupMsg}
                  </p>
                </div>
              )}

              {warning && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-md relative pr-10">
                  <p className="text-sm text-amber-800 flex items-center">
                    <Icon name="AlertTriangle" size={20} className="mr-2" /> {warning}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearWarning}
                    className="absolute top-1 right-1 text-amber-600 hover:text-amber-700 p-1"
                  >
                    <Icon name="X" size={16} />
                  </Button>
                </div>
              )}

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium text-foreground mb-2">CSV Format Requirements</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Required columns: <strong>name, email, phone number</strong></p>
                  <p>• Optional columns: role, allergies, birthday</p>
                  <p>• Role values: player, coach, staff</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-6">
              <Button type="button" variant="outline" onClick={() => navigate('/dashboard-home')}>
                Skip for Now
              </Button>
              <Button type="submit" disabled={loading || !teamData.name.trim() || hasDupes}>
                {loading ? 'Creating Team...' : 'Create Team'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}