import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import Icon from '../../components/AppIcon';
import greenOnlyLogo from '../../../src/components/images/logo_only_green.png';

import AuthTabs from './components/AuthTabs';
import { LoginForm } from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import SecurityBadges from './components/SecurityBadges';

const LoginRegistration = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setErrors({});
  };

  return (
    <>
      <Helmet>
        <title>Sign In - MealOps | Team Meal Management Platform</title>
        <meta name="description" content="Secure login for athletic team coaches and staff to access meal coordination, scheduling, and expense management tools." />
      </Helmet>
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')] bg-cover bg-center opacity-5" />
        
        {/* Main Content */}
        <div className="relative w-full max-w-md">
          {/* Logo Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-athletic">
                <img src={greenOnlyLogo} alt="MealOps Logo" className="h-14 max-h-24 w-auto rounded-md brightness-110" />
              </div>
              <div>
                <h1 className="text-2xl font-heading font-bold text-foreground">
                  MealOps
                </h1>
                <p className="text-sm text-muted-foreground">
                  Team Meal Management
                </p>
              </div>
            </div>
            <p className="text-muted-foreground">
              Streamline your team's dining coordination
            </p>
          </div>

          {/* Auth Card */}
          <div className="bg-card border border-border rounded-lg shadow-athletic-lg p-6">
            <AuthTabs 
              activeTab={activeTab} 
              onTabChange={handleTabChange} 
            />
            
            {activeTab === 'login' ? (
              <LoginForm onForgotPassword={() => setShowForgotPassword(true)} errors={errors} setErrors={setErrors}/>
            ) : (
              <RegisterForm errors={errors} setErrors={setErrors}/>
            )}
            
            <SecurityBadges />
          </div>

          {/* Additional Info */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Trusted by 500+ athletic teams nationwide
            </p>
            <div className="flex items-center justify-center space-x-4 mt-3">
              <div className="flex items-center space-x-1">
                <Icon name="Users" size={14} className="text-success" />
                <span className="text-xs text-muted-foreground">10,000+ Users</span>
              </div>
              <div className="flex items-center space-x-1">
                <Icon name="Calendar" size={14} className="text-success" />
                <span className="text-xs text-muted-foreground">50,000+ Orders</span>
              </div>
              <div className="flex items-center space-x-1">
                <Icon name="DollarSign" size={14} className="text-success" />
                <span className="text-xs text-muted-foreground">$2M+ Managed</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-muted-foreground">
            <p>
              © {new Date()?.getFullYear()} MealOps. All rights reserved. |{' '}
              <a href="/privacy-policy" target="_blank" className="text-primary hover:text-primary/80 transition-athletic">
                Privacy Policy
              </a>{' '}
              |{' '}
              <a href="/terms-and-conditions" target="_blank" className="text-primary hover:text-primary/80 transition-athletic">
                Terms and Conditions
              </a>
            </p>
          </div>
        </div>

        {/* Forgot Password Modal */}
        <ForgotPasswordModal 
          isOpen={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      </div>
    </>
  );
};

export default LoginRegistration;