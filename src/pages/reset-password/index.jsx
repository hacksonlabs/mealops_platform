import React, { useState, useEffect, useRef  } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { Helmet } from 'react-helmet';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false); // For form submission
  const [error, setError] = useState(''); // General submission error state
  const [initialMessage, setInitialMessage] = useState(''); // Initial instructional message when link is valid
  const [success, setSuccess] = useState(''); // Success message state after password update
  const [isSessionChecked, setIsSessionChecked] = useState(false); // State to manage when initial session check is complete
  const isResetSuccessfulRef = useRef(false); // useRef to track if reset was successful and signOut is intentional
  const [passwordErrors, setPasswordErrors] = useState({}); // For field-specific validation

  useEffect(() => {
    let unsubscribeAuth;

    const checkInitialSession = async () => {
      try {
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession();

        if (getSessionError) {
          console.error("Error getting initial session:", getSessionError.message);
          setError('An error occurred while connecting. Please check your network and try again.');
        } else {
          setError(''); 
        }
      } catch (err) {
        console.error("Unexpected error during session check:", err);
        setError('An unexpected error occurred during session check. Please try again.');
      } finally {
        setIsSessionChecked(true); 
      }
    };

    checkInitialSession();

    const { data: { subscription } = {} } = supabase.auth.onAuthStateChange((event, session) => {
      // IMPORTANT: Check the flag before setting error on SIGNED_OUT
      if (event === 'SIGNED_OUT' && !isResetSuccessfulRef.current) { 
        setError('Your password reset session has expired. Please request a new password reset link.');
        setSuccess('');
      } else if (event === 'SIGNED_IN' && session && session.user) {
        setError('');
        setSuccess('');
      }
    });
    unsubscribeAuth = subscription; 

    return () => {
      if (unsubscribeAuth) {
        unsubscribeAuth.unsubscribe();
      }
    };
  }, []); 

  const validateForm = () => {
    const newErrors = {};
    if (!password) {
      newErrors.password = 'New password is required';
    } else if (password.length < 6) {
      newErrors.password = 'New password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setPasswordErrors(newErrors);
    console.log("Validation Results (setPasswordErrors called with):", newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    console.log("handleSubmit triggered.");
    e.preventDefault(); 
    setLoading(true);
    setError(''); 
    setSuccess(''); 

    const isValid = validateForm();
    if (!isValid) {
      console.log("Client-side validation failed. Form should NOT submit.");
      setLoading(false);
      return; 
    }

    try {
      console.log("Validation passed. Attempting password update.");
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error("Password update error:", updateError);
        if (updateError.message.includes('AuthApiError: Invalid refresh token') ||
            updateError.message.includes('AuthApiError: invalid_grant') ||
            updateError.message.includes('access token expired') ||
            updateError.message.includes('token expired or invalid') ||
            updateError.message.includes('AuthApiError: Token has expired or is invalid')) { 
            setError('Your password reset link has expired or is invalid. Please request a new one.');
        } else {
            setError(`Failed to update password: ${updateError.message}`);
        }
        setSuccess(''); 
      } else {
        setSuccess('Your password has been reset successfully! Redirecting to login...');
        setError(''); 
        
        isResetSuccessfulRef.current = true; 
        await supabase.auth.signOut(); 
        
        setTimeout(() => {
          navigate('/login-registration', { replace: true });
        }, 3000);
      }
    } catch (err) {
      console.error("Unexpected password reset error:", err);
      setError('An unexpected error occurred during password reset. Please try again.');
      setSuccess(''); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Reset Password - MealOps</title>
        <meta name="description" content="Set a new password for your MealOps account." />
      </Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        {/* Background Pattern - same as LoginRegistration for consistency */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')] bg-cover bg-center opacity-5" />

        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-athletic">
                {/* Placeholder for your greenOnlyLogo or similar icon */}
                <Icon name="Key" size={32} color="white" />
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  Reset Password
                </h1>
                <p className="text-sm text-muted-foreground">
                  MealOps Account
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg shadow-athletic-lg p-6">
            <h2 className="text-xl font-bold text-foreground mb-4 text-center">
              Set New Password
            </h2>

            {/* Only display messages/form once session check is complete */}
            {!isSessionChecked ? (
              <p className="text-center p-4 mb-4 text-gray-600">Checking your reset link...</p>
            ) : (
              <>
                {/* relying on success/error for feedback */}
                {success && (
                  <div className="text-center p-4 mb-4 rounded-md bg-green-100 text-green-700">
                    <Icon name="CheckCircle" size={24} className="inline-block mr-2" />
                    {success}
                  </div>
                )}
                {error && (
                  <div className="text-center p-4 mb-4 rounded-md bg-red-100 text-red-700">
                    <Icon name="XCircle" size={24} className="inline-block mr-2" />
                    {error}
                  </div>
                )}

                {/* Condition to show the form: !success && !error after session check */}
                {!success && !error && (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      label="New Password"
                      type="password"
                      name="password"
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordErrors(prev => ({ ...prev, password: '' }));
                        if (!success) setError('');
                      }}
                      error={passwordErrors.password}
                      required
                    />
                    <Input
                      label="Confirm New Password"
                      type="password"
                      name="confirmPassword"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordErrors(prev => ({ ...prev, confirmPassword: '' }));
                        if (!success) setError('');
                      }}
                      error={passwordErrors.confirmPassword}
                      required
                    />
                    <Button
                      type="submit"
                      variant="default"
                      fullWidth
                      loading={loading}
                      iconName="Save"
                      iconPosition="left"
                      className="mt-6"
                    >
                      Reset Password
                    </Button>
                  </form>
                )}
              </>
            )}

            <p className="text-center text-sm text-muted-foreground mt-4">
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => navigate('/login-registration')}
                className="text-primary hover:text-primary/80 transition-athletic"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default ResetPasswordPage;