import React, { useState } from 'react';
import Input from '../../../components/ui/custom/Input';
import Button from '../../../components/ui/custom/Button';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    } else if (!/\S+@\S+\.\S+/?.test(email)) {
      setError('Please enter a valid email address');
      return;
    } else if (!email.endsWith('.edu')) {
      setError('Only .edu email addresses are accepted for password reset.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (resetError) {
        // Handle specific Supabase errors for password reset
        if (resetError.message.includes('No user found')) {
          setError('No account found with that email address. Please check your email.');
        } else if (resetError.message.includes('Failed to fetch') || resetError.message.includes('NetworkError')) {
          setError('Cannot connect to authentication service. Please check your internet connection or try again later.');
        } else {
          setError('Failed to send reset email. Please try again. ' + resetError.message);
        }
        console.error("Supabase password reset error:", resetError); // Log the actual error
      } else {
        setIsSuccess(true); // Only set success if no errors
        setError('');
      }
    } catch (err) { // Catch any unexpected network or other errors
      console.error("Unexpected error during password reset:", err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setIsSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-md mx-4">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading font-semibold text-foreground">
              Reset Password
            </h2>
            <button
              onClick={handleClose}
              className="p-1 text-muted-foreground hover:text-foreground transition-athletic"
            >
              <Icon name="X" size={20} />
            </button>
          </div>
          
          {!isSuccess ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Enter your email address and we'll send you a link to reset your password.
              </p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e?.target?.value);
                    setError('');
                  }}
                  error={error}
                  required
                />
                
                <div className="flex space-x-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    loading={isLoading}
                    iconName="Mail"
                    iconPosition="left"
                    className="flex-1"
                  >
                    Send Reset Link
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="CheckCircle" size={32} color="var(--color-success)" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                Reset Link Sent
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                If your email is registered, we've sent a password reset link to <strong>{email}</strong>. 
                Check your inbox and follow the instructions to reset your password.
              </p>
              <Button
                variant="default"
                onClick={handleClose}
                fullWidth
              >
                Got it
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;