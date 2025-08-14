import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { useAuth } from '../../../contexts/AuthContext';
import { emailService } from '../../../services/emailService';
import { supabase } from '../../../lib/supabase'; 

export function RegisterForm({ onSwitchToLogin, errors, setErrors, isLoading }) {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    schoolName: '',
    team: '',
    conference: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
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

    if (!formData?.fullName) {
      newErrors.fullName = 'Your name is required';
    } else if (formData?.fullName?.length < 2) {
      newErrors.fullName = 'Your full name must be at least 2 characters';
    }
    if (!formData?.schoolName) {
      newErrors.schoolName = 'School name is required';
    } else if (formData?.schoolName?.length < 2) {
      newErrors.schoolName = 'School name must be at least 2 characters';
    }

    if (!formData?.team) {
      newErrors.team = 'Team name is required';
    } else if (formData?.team?.length < 2) {
      newErrors.team = 'Team name must be at least 2 characters';
    }

    if (!formData?.conference) {
      newErrors.conference = 'Conference name is required';
    } else if (formData?.conference?.length < 2) {
      newErrors.conference = 'Conference name must be at least 2 characters';
    }

    if (!formData?.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/?.test(formData?.email)) {
      newErrors.email = 'Please enter a valid email address';
    }else if (!formData?.email.endsWith('.edu')) {
      newErrors.email = 'Only .edu email addresses are allowed for registration';
    }

    if (!formData?.password) {
      newErrors.password = 'Password is required';
    } else if (formData?.password?.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    // } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/?.test(formData?.password)) {
    //   newErrors.password = 'Password must contain uppercase, lowercase, and number';
    // }

    if (!formData?.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData?.password !== formData?.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!formData?.acceptTerms) {
      newErrors.acceptTerms = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const isValid = validateForm();
    if (!isValid) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await signUp(
        formData?.email,
        formData?.password,
        {
          fullName: formData.fullName,
          schoolName: formData.schoolName,
          team: formData.team,
          conference: formData.conference,
        }
      );

      // // If signUp is successful
      // if (data?.user?.id) {
      //   const { error: profileInsertError } = await supabase.from('user_profiles').insert({
      //     id: data.user.id,
      //     full_name: formData.fullName,
      //     school_name: formData.schoolName,
      //     team: formData.team,
      //     conference_name: formData.conference,
      //     email: formData.email,
      //   });
      //   if (profileInsertError) {
      //     setError('Something went wrong while saving your profile info.');
      //     setLoading(false);
      //     return;
      //   }
      // }

      if (signUpError) {
        if (signUpError?.message?.includes('already registered')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else if (signUpError?.message?.includes('Invalid email')) {
          setError('Please enter a valid email address.');
        } else if (signUpError?.message?.includes('Password should be at least')) {
          setError('Password must be at least 6 characters long.');
        } else if (signUpError?.message?.includes('Failed to fetch') ||
        signUpError?.message?.includes('AuthRetryableFetchError')) {
          setError('Cannot connect to authentication service. Your Supabase project may be paused or inactive. Please check your Supabase dashboard and resume your project if needed.');
        } else {
          setError(signUpError?.message);
        }
        return;
      }

      // Send welcome email
      // if (data?.user?.email) {
      //   await emailService?.sendWelcomeEmail(data?.user?.email, formData?.fullName);
      // }

      setSuccess('Account created successfully! Redirecting to verification instructions...');


      // Redirect to awaiting-email-verification after a short delay
      setTimeout(() => {
        navigate('/awaiting-email-verification', { state: { email: formData.email } })
      }, 2000);
    } catch (error) {
      if (error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('NetworkError') ||
      error?.name === 'TypeError' && error?.message?.includes('fetch')) {
        setError('Cannot connect to authentication service. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.');
      } else {
        setError('Something went wrong during registration. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Full Name"
        type="text"
        name="fullName"
        placeholder="Enter your name"
        value={formData?.fullName}
        onChange={handleInputChange}
        error={errors?.fullName}
        required />
      <Input
        label="School Name"
        type="text"
        name="schoolName"
        placeholder="Enter your school name"
        value={formData?.schoolName}
        onChange={handleInputChange}
        error={errors?.schoolName}
        required />
      <Input
        label="Team"
        type="text"
        name="team"
        placeholder="Enter your team (IE: Wbb)"
        value={formData?.team}
        onChange={handleInputChange}
        error={errors?.team}
        required />
      <Input
        label="Conference"
        type="text"
        name="conference"
        placeholder="Enter your conference (IE: Pac-12 💀)"
        value={formData?.conference}
        onChange={handleInputChange}
        error={errors?.conference}
        required />
      <Input
        label="Email Address"
        type="email"
        name="email"
        placeholder="Enter your .edu email"
        value={formData?.email}
        onChange={handleInputChange}
        error={errors?.email}
        required />

      <div className="flex space-x-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <input
            type="password"
            name="password"
            placeholder="Create password"
            value={formData?.password}
            onChange={handleInputChange}
            required
            className="w-full border rounded-md px-3 py-2"
          />
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm password"
            value={formData?.confirmPassword}
            onChange={handleInputChange}
            required
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
      </div>

      <Checkbox
        label="I agree to the Terms of Service and Privacy Policy"
        name="acceptTerms"
        checked={formData?.acceptTerms}
        onChange={handleInputChange}
        error={errors?.acceptTerms}
        required />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">{success}</p>}
      <Button
        type="submit"
        variant="default"
        fullWidth
        loading={loading}
        iconName="UserPlus"
        iconPosition="left"
        className="mt-6">

        Create Account
      </Button>
    </form>);

}

export default RegisterForm;