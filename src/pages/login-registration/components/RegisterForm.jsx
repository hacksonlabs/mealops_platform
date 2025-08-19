import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
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
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });

  const GOOGLE_FORM_LINK = "https://docs.google.com/forms/d/e/1FAIpQLSdNwsOgM5HU0sk8R0RueuXPRFTXcbMAUtIRtqJosjbc8VmXRg/viewform?usp=sharing&ouid=100340340297824841757;"

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
    } else if (!formData?.email.endsWith('.edu')) {
      newErrors.email = 'Only .edu email addresses are allowed for registration';
    }

    if (!formData?.phoneNumber) {
      newErrors.phoneNumber = 'Phone number is required for order notifications';
    } else if (!/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(formData?.phoneNumber)) {
        newErrors.phoneNumber = 'Please enter a valid 10-digit phone number';
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
          data: { // This object will become part of auth.users.raw_user_meta_data
            fullName: formData.fullName,
            schoolName: formData.schoolName,
            team: formData.team,
            conference: formData.conference,
            // phone: formData.phoneNumber,
          }
        }
      );

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

      // Profile creation is handled by a backend trigger after auth.users INSERT.
      setSuccess('Account created successfully! Redirecting to verification instructions...');
      
      // Redirect to an "awaiting email verification" page, passing the email
      setTimeout(() => {
        navigate('/awaiting-email-verification', { state: { email: formData.email } });
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
        placeholder="Enter your team (e.g., WBB)"
        value={formData?.team}
        onChange={handleInputChange}
        error={errors?.team}
        required />
      <Input
        label="Conference"
        type="text"
        name="conference"
        placeholder="Enter your conference (e.g., Pac-12 💀)"
        value={formData?.conference}
        onChange={handleInputChange}
        error={errors?.conference}
        required />

      <div className="space-y-2">
        <div className="flex items-center space-x-2 relative group w-fit">
          <label 
            htmlFor="email-input-id" // Set ID to link label to input
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            style={{ color: errors?.email ? 'var(--color-destructive)' : 'var(--color-foreground)' }}
          >
            Email Address
            <span className="text-destructive ml-1">*</span>
          </label>
          <Icon name="Info" size={16} className="text-gray-400 cursor-pointer hover:text-gray-600" />
          {/* Tooltip on hover */}
          <div className="absolute left-full ml-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto z-10 top-1/2 -translate-y-1/2">
            Only .edu email addresses are allowed for direct registration. If you do not have a .edu email, please{' '}
            <a 
              href={GOOGLE_FORM_LINK} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-blue-300 hover:underline"
              onClick={(e) => e.stopPropagation()} // Prevent closing tooltip when clicking link
            >
              fill out this form
            </a>{' '}
            to request access.
          </div>
        </div>
        <Input
          id="email-input-id"
          type="email"
          name="email"
          placeholder="Enter your .edu email"
          value={formData?.email}
          onChange={handleInputChange}
          error={errors?.email}
          required
          className=""
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center space-x-2 relative group w-fit">
          <label 
            htmlFor="phoneNumber-input-id" // Unique ID for phone number input
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            style={{ color: errors?.phoneNumber ? 'var(--color-destructive)' : 'var(--color-foreground)' }}
          >
            Cell Phone #
            <span className="text-destructive ml-1">*</span>
          </label>
          <Icon name="Info" size={16} className="text-gray-400 cursor-pointer hover:text-gray-600" />
          <div className="absolute left-full ml-2 w-64 p-3 bg-gray-800 text-white text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-hover:pointer-events-auto z-10 top-1/2 -translate-y-1/2">
            This phone number will be used for critical order updates and notifications. You can easily update it later in your profile settings.
          </div>
        </div>
        <Input
          id="phoneNumber-input-id"
          type="tel"
          name="phoneNumber"
          placeholder="e.g., (xxx) xxx-xxxx or xxxxxxxxxx"
          value={formData?.phoneNumber}
          onChange={handleInputChange}
          error={errors?.phoneNumber}
          required
          className=""
        />
      </div>
      
      <div className="flex space-x-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>
          <Input
            type="password"
            name="password"
            placeholder="Create password"
            value={formData?.password}
            onChange={handleInputChange}
            error={errors?.password}
            required
            className="w-full border rounded-md px-3 py-2"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confirm Password
          </label>
          <Input
            type="password"
            name="confirmPassword"
            placeholder="Confirm password"
            value={formData?.confirmPassword}
            onChange={handleInputChange}
            error={errors?.confirmPassword}
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
    </form>
  );
}

export default RegisterForm;