import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../components/ui/custom/Button';
import { supabase } from '../../lib/supabase';

export function AwaitingEmailVerificationPage() {
  const navigate = useNavigate();
  const location = useLocation(); // Initialize useLocation hook
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState(''); // State to store the email

  useEffect(() => {
    // Attempt to get the email from navigation state when the component mounts
    if (location.state && location.state.email) {
      setUserEmail(location.state.email);
    } else {
      // If email is not in state (e.g., direct navigation), you might want to
      // display a message or prompt the user, or rely on them remembering it for resend.
      // For now, we'll just set a message if it's not found.
      setMessage('Please ensure you have entered your email correctly if you need to resend the verification link.');
    }
  }, [location.state]); // Re-run if location state changes

  // Function to handle resending the verification email
  const handleResendEmail = async () => {
    setLoading(true);
    setMessage('');
    setError('');

    // Use the email from state
    if (!userEmail) {
      setError("Email address not found. Please go back to registration or try logging in.");
      setLoading(false);
      return;
    }

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail, // Use the email from state
      });

      if (resendError) {
        setError(resendError.message);
      } else {
        setMessage('Verification email **resent successfully**! Please check your **latest email** and discard any older verification links.');
      }
    } catch (err) {
      console.error('Error resending verification email:', err);
      setError('Failed to resend verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Almost There!
        </h2>
        <p className="text-gray-700 mb-6">
          Thank you for registering. We've sent a verification link to your **.edu email address**
          {userEmail && <span className="font-semibold"> ({userEmail})</span>}.
          Please check your inbox (and spam/junk folder) to activate your account.
        </p>

        {message && <p className="text-green-600 text-sm mb-4">{message}</p>}
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <Button
          onClick={handleResendEmail}
          variant="outline"
          fullWidth
          loading={loading}
          className="mb-4"
        >
          Resend Verification Email
        </Button>

        <Button
          onClick={() => navigate('/login-registration')}
          variant="ghost"
          fullWidth
        >
          Back to Login
        </Button>
      </div>
    </div>
  );
}

export default AwaitingEmailVerificationPage;
