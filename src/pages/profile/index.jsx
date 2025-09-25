import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/ui/Header';
import { useAuth } from '../../contexts';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/custom/Button';
import Icon from '../../components/AppIcon';
import { toTitleCase, normalizePhoneNumber } from '@/utils/stringUtils';

const ProfilePage = () => {
  const { user, activeTeam } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    school: '',
    phone: '',
    allergies: '',
    birthday: '',
  });
  const [role, setRole] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user?.id) return;
      setLoading(true);
      setError('');

      try {
        const { data: profile, error: profileErr } = await supabase
          .from('user_profiles')
          .select('id, email, first_name, last_name, school_name, phone, allergies, birthday')
          .eq('id', user.id)
          .single();

        if (profileErr) throw profileErr;

        let member = null;
        try {
          let memberQuery = supabase
            .from('team_members')
            .select('id, team_id, user_id, role, full_name, phone_number, allergies, birthday')
            .eq('user_id', user.id)
            .limit(1);

          if (activeTeam?.id) memberQuery = memberQuery.eq('team_id', activeTeam.id);

          const { data: memberRow, error: memberErr } = await memberQuery.maybeSingle();
          if (memberErr) throw memberErr;
          member = memberRow;
        } catch (memberFetchErr) {
          console.warn('Profile: failed to load team member row', memberFetchErr);
        }

        const updates = {};
        if (!profile.phone && member?.phone_number) updates.phone = member.phone_number;
        if (!profile.allergies && member?.allergies) updates.allergies = member.allergies;
        if (!profile.birthday && member?.birthday) updates.birthday = member.birthday;

        if (Object.keys(updates).length) {
          const { error: updateErr } = await supabase
            .from('user_profiles')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', user.id);
          if (updateErr) {
            console.warn('Profile: failed to sync missing fields', updateErr);
          } else {
            Object.assign(profile, updates);
          }
        }

        if (!cancelled) {
          setProfileData({ profile, member });
          setRole(member?.role || '');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Profile: load failed', err);
          setError(err?.message || 'Failed to load profile');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [user?.id, activeTeam?.id]);

  const display = useMemo(() => {
    if (!profileData?.profile) return null;

    const { profile, member } = profileData;
    const firstName = profile.first_name ? toTitleCase(String(profile.first_name).toLowerCase()) : '';
    const lastName = profile.last_name ? toTitleCase(String(profile.last_name).toLowerCase()) : '';
    const school = profile.school_name ? toTitleCase(String(profile.school_name).toLowerCase()) : '';
    const phone = normalizePhoneNumber(profile.phone || member?.phone_number || '');

    return {
      firstName,
      lastName,
      email: profile.email || '',
      school,
      role: member?.role || '',
      phone,
      allergies: profile.allergies || member?.allergies || '',
      birthday: profile.birthday || member?.birthday || null,
    };
  }, [profileData]);

  useEffect(() => {
    if (!display) return;
    setForm({
      firstName: display.firstName ? toTitleCase(String(display.firstName).toLowerCase()) : '',
      lastName: display.lastName ? toTitleCase(String(display.lastName).toLowerCase()) : '',
      school: display.school ? toTitleCase(String(display.school).toLowerCase()) : '',
      phone: normalizePhoneNumber(display.phone || ''),
      allergies: display.allergies || '',
      birthday: display.birthday ? String(display.birthday).slice(0, 10) : '',
    });
    setRole(display.role || '');
  }, [display]);

  const formatValue = (value) => (value ? value : '—');
  const formatDate = (value) => {
    if (!value) return '—';
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fullName = useMemo(() => {
    const first = (isEditing ? form.firstName : display?.firstName) || '';
    const last = (isEditing ? form.lastName : display?.lastName) || '';
    return `${first} ${last}`.trim();
  }, [display?.firstName, display?.lastName, form.firstName, form.lastName, isEditing]);

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  const handleInputChange = (field) => (event) => {
    let value = event?.target?.value ?? '';

    if (['firstName', 'lastName', 'school'].includes(field)) {
      value = toTitleCase(value.toLowerCase());
    } else if (field === 'phone') {
      value = normalizePhoneNumber(value);
    }

    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSuccess('');
    setError('');
    if (display) {
      setForm({
        firstName: display.firstName ? toTitleCase(String(display.firstName).toLowerCase()) : '',
        lastName: display.lastName ? toTitleCase(String(display.lastName).toLowerCase()) : '',
        school: display.school ? toTitleCase(String(display.school).toLowerCase()) : '',
        phone: normalizePhoneNumber(display.phone || ''),
        allergies: display.allergies || '',
        birthday: display.birthday ? String(display.birthday).slice(0, 10) : '',
      });
      setRole(display.role || '');
    }
  };

  const handleSave = async () => {
    if (!profileData?.profile || !user?.id) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const trimmedFirst = form.firstName.trim();
      const trimmedLast = form.lastName.trim();
      const trimmedSchool = form.school.trim();
      const formattedFirst = toTitleCase(trimmedFirst.toLowerCase());
      const formattedLast = toTitleCase(trimmedLast.toLowerCase());
      const formattedSchool = trimmedSchool ? toTitleCase(trimmedSchool.toLowerCase()) : '';
      const formattedPhone = normalizePhoneNumber(form.phone);
      const updates = {
        first_name: formattedFirst,
        last_name: formattedLast,
        school_name: formattedSchool || null,
        phone: formattedPhone || null,
        allergies: form.allergies || null,
        birthday: form.birthday || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateProfileErr } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', user.id);

      if (updateProfileErr) throw updateProfileErr;

      if (profileData.member?.id) {
        const memberUpdates = {
          phone_number: formattedPhone || null,
          allergies: form.allergies || null,
          birthday: form.birthday || null,
          role,
        };
        const full = `${formattedFirst} ${formattedLast}`.trim();
        if (full) memberUpdates.full_name = full;
        const { error: memberErr } = await supabase
          .from('team_members')
          .update(memberUpdates)
          .eq('id', profileData.member.id);
        if (memberErr) {
          console.warn('Profile: update team member failed', memberErr);
        }
      }

      setProfileData((prev) => {
        if (!prev) return prev;
        return {
          profile: {
            ...prev.profile,
            ...updates,
          },
          member: prev.member
            ? {
                ...prev.member,
                phone_number: formattedPhone || null,
                allergies: form.allergies || null,
                birthday: form.birthday || null,
                full_name: `${formattedFirst} ${formattedLast}`.trim() || prev.member.full_name,
                role,
              }
            : prev.member,
        };
      });

      setSuccess('Profile updated successfully.');
      setIsEditing(false);
    } catch (saveErr) {
      console.error('Profile: save failed', saveErr);
      setError(saveErr?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16 pb-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-athletic">
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6 p-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-semibold">
                  {initials || <Icon name="User" size={28} className="text-primary" />}
                </div>
                <div>
                  <p className="text-sm uppercase tracking-wide text-muted-foreground mb-1">Profile</p>
                  <h1 className="text-3xl font-bold text-foreground">{fullName || display?.email}</h1>
                  <p className="text-sm text-muted-foreground">{display?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!isEditing ? (
                  <Button size="lg" onClick={() => { setIsEditing(true); setSuccess(''); setError(''); }} iconName="Pencil" iconPosition="left">
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button variant="outline" onClick={handleCancel} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving} iconName="Save" iconPosition="left">
                      {saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="bg-card border border-border rounded-xl p-6 shadow-athletic flex items-center justify-center">
              <span className="text-muted-foreground">Loading profile…</span>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 border border-destructive/40 text-destructive rounded-xl p-6">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {success && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md px-4 py-2 text-sm">
                  {success}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <section className="lg:col-span-2 bg-card border border-border rounded-xl shadow-athletic p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Personal Details</h2>
                      {/* <p className="text-sm text-muted-foreground">Update your core account information.</p> */}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">First Name</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={handleInputChange('firstName')}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-base text-foreground font-medium">{formatValue(display?.firstName)}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">Last Name</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={handleInputChange('lastName')}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-base text-foreground font-medium">{formatValue(display?.lastName)}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">School</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={form.school}
                          onChange={handleInputChange('school')}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <p className="text-base text-foreground font-medium">{formatValue(display?.school)}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">Birthday</label>
                      {isEditing ? (
                        <input
                          type="date"
                          value={form.birthday || ''}
                          onChange={handleInputChange('birthday')}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          max={new Date().toISOString().slice(0, 10)}
                        />
                      ) : (
                        <p className="text-base text-foreground font-medium">{formatDate(display?.birthday)}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">Team Role</label>
                      {profileData?.member ? (
                        isEditing ? (
                          <select
                            value={role}
                            onChange={(event) => setRole(event.target.value)}
                            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="coach">Coach</option>
                            <option value="player">Player</option>
                            <option value="manager">Staff</option>
                          </select>
                        ) : (
                          <p className="text-base text-foreground font-medium">{toTitleCase(display?.role)}</p>
                        )
                      ) : (
                        <p className="text-base text-muted-foreground italic">Join a team to set a role.</p>
                      )}
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">Allergies</label>
                      {isEditing ? (
                        <textarea
                          value={form.allergies}
                          onChange={handleInputChange('allergies')}
                          rows={4}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="List any food allergies or preferences"
                        />
                      ) : (
                        <p className="text-base text-foreground font-medium whitespace-pre-wrap">
                          {formatValue(display?.allergies)}
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="bg-card border border-border rounded-xl shadow-athletic p-6 space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Contact</h2>
                    {/* <p className="text-sm text-muted-foreground">We use this to stay in touch with you and your team.</p> */}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">Email</label>
                      <p className="text-base text-foreground font-medium break-all">{formatValue(display?.email)}</p>
                      {isEditing && (
                        <p className="text-xs text-muted-foreground italic">To change your email, please contact MealOps support at mealops.inquiries@gmail.com</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-muted-foreground">Phone</label>
                      {isEditing ? (
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={handleInputChange('phone')}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="(555) 555-5555"
                        />
                      ) : (
                        <p className="text-base text-foreground font-medium">{formatValue(display?.phone)}</p>
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
