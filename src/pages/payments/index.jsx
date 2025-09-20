// src/pages/payments/index.jsx
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Button from '../../components/ui/custom/Button';
import Icon from '../../components/AppIcon';

const PAYMENTS_MOCK = (import.meta?.env?.VITE_PAYMENTS_MOCK ?? '1') === '1';

const MockInner = ({ mode = 'payment', orderId, postSaveRedirect }) => {
  const navigate = useNavigate();

  const handleMockSubmit = (e) => {
    e.preventDefault();
    if (mode === 'setup') {
      // Pretend we've saved a card; bounce back so checkout can refresh cards
      navigate(postSaveRedirect || '/checkout', {
        replace: true,
        state: { refreshCards: true },
      });
    } else {
      // Pretend we've paid successfully
      navigate('/order/success', {
        replace: true,
        state: { orderId, paymentIntentId: 'pi_mock_123' },
      });
    }
  };

  return (
    <div className="max-w-md mx-auto bg-card border border-border rounded-lg p-4 lg:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="Shield" size={16} className="text-success" />
        <h1 className="text-lg font-semibold">
          {mode === 'setup' ? 'Save a Payment Method (Mock)' : 'Secure Payment (Mock)'}
        </h1>
      </div>

      <form onSubmit={handleMockSubmit} className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {mode === 'setup'
            ? 'Mock mode: no real card entry. Click "Save card" to continue.'
            : 'Mock mode: no real payment. Click "Pay now" to continue.'}
        </div>
        <Button type="submit" className="w-full">
          {mode === 'setup' ? 'Save card' : 'Pay now'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(-1)}
          className="w-full mt-2"
        >
          Cancel
        </Button>
      </form>
    </div>
  );
};

const PayInner = ({ orderId, mode = 'payment', postSaveRedirect }) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError('');

    if (mode === 'setup') {
      const { error: setupError /*, setupIntent */ } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });
      if (setupError) {
        setError(setupError.message || 'Could not save card.');
        setSubmitting(false);
        return;
      }
      navigate(postSaveRedirect || '/checkout', {
        replace: true,
        state: { refreshCards: true },
      });
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed. Please try again.');
      setSubmitting(false);
      return;
    }

    navigate('/order/success', {
      replace: true,
      state: { orderId, paymentIntentId: paymentIntent?.id },
    });
  };

  return (
    <div className="max-w-md mx-auto bg-card border border-border rounded-lg p-4 lg:p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon name="Shield" size={16} className="text-success" />
        <h1 className="text-lg font-semibold">
          {mode === 'setup' ? 'Save a Payment Method' : 'Secure Payment'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement />
        {error && <div className="text-sm text-destructive">{error}</div>}
        <Button type="submit" disabled={!stripe || submitting} className="w-full">
          {submitting ? 'Processing…' : mode === 'setup' ? 'Save card' : 'Pay now'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate(-1)}
          className="w-full mt-2"
        >
          Cancel
        </Button>
      </form>
    </div>
  );
};

const PayPage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const clientSecret = state?.clientSecret;
  const publishableKey = state?.publishableKey;
  const orderId = state?.orderId;
  const mode = state?.mode || 'payment'; // 'payment' | 'setup'
  const postSaveRedirect = state?.postSaveRedirect;

  React.useEffect(() => {
    if (!clientSecret || !publishableKey) {
      if (PAYMENTS_MOCK) return; // allow mock UI without Stripe secrets
      navigate('/checkout', { replace: true });
    }
  }, [clientSecret, publishableKey, navigate]);

  // Mock path: show a simple confirm screen with no provider calls
  if (PAYMENTS_MOCK && (!clientSecret || !publishableKey)) {
    return (
      <div className="min-h-screen bg-background pt-16 pb-10">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <MockInner mode={mode} orderId={orderId} postSaveRedirect={postSaveRedirect} />
        </div>
      </div>
    );
  }

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  );

  if (!stripePromise || !clientSecret) return null;

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { theme: 'stripe' } }}
    >
      <div className="min-h-screen bg-background pt-16 pb-10">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <PayInner orderId={orderId} mode={mode} postSaveRedirect={postSaveRedirect} />
        </div>
      </div>
    </Elements>
  );
};

export default PayPage;
