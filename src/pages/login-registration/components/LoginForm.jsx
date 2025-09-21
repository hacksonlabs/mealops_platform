import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../../components/ui/custom/Input';
import Button from '../../../components/ui/custom/Button';
import { Checkbox } from '../../../components/ui/custom/Checkbox';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts';
import { supabase } from '../../../lib/supabase';

export function LoginForm({ onSwitchToRegister, onForgotPassword, errors, setErrors, isLoading }) {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e?.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error when user starts typing
    if (errors?.[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/?.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData?.password) {
      newErrors.password = 'Password is required';
    } else if (formData?.password?.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    const isValid = validateForm();
    if (!isValid) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: signInError } = await signIn(formData?.email, formData?.password);

      if (signInError) {
        if (signInError?.message?.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (signInError?.message?.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.');
        } else if (signInError?.message?.includes('Failed to fetch') ||
        signInError?.message?.includes('AuthRetryableFetchError')) {
          setError('Cannot connect to authentication service. Your Supabase project may be paused or inactive. Please check your Supabase dashboard and resume your project if needed.');
        } else {
          setError(signInError?.message);
        }
        return;
      }

    // Check if the user has a team
    const user = data?.user;
    if (!user) {
      navigate('/login-registration');
      return;
    }

    const { data: teams, error: teamErr } = await supabase
      .from('teams')
      .select('id')
      .eq('coach_id', user.id)
      .limit(1);

    if (teamErr) {
      console.error('Error checking teams:', teamErr?.message);
      navigate('/team-setup');
      return;
    }

    if (teams && teams.length > 0) {
      const firstTeamId = teams[0].id;
      localStorage.setItem('activeTeamId', firstTeamId);
      navigate('/dashboard-home', { replace: true });
    } else {
      navigate('/team-setup', { replace: true });
    }
    } catch (err) {
      if (err?.message?.includes('Failed to fetch') ||
      err?.message?.includes('NetworkError') ||
      err?.name === 'TypeError' && err?.message?.includes('fetch')) {
        setError('Cannot connect to authentication service. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.');
      } else {
        setError('Something went wrong during sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Email Address"
        type="email"
        name="email"
        placeholder="Enter your email"
        value={formData?.email}
        onChange={handleInputChange}
        error={errors?.email}
        required />

      <Input
        label="Password"
        type="password"
        name="password"
        placeholder="Enter your password"
        value={formData?.password}
        onChange={handleInputChange}
        error={errors?.password}
        required />

      <div className="flex items-center justify-between">
        <Checkbox
          label="Remember me"
          name="rememberMe"
          checked={formData?.rememberMe}
          onChange={handleInputChange} />

        
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-sm text-primary hover:text-primary/80 transition-athletic">

          Forgot password?
        </button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button
        type="submit"
        variant="default"
        fullWidth
        loading={loading}
        iconName="LogIn"
        iconPosition="left"
        className="mt-6">

        Sign In
      </Button>
    </form>);

}