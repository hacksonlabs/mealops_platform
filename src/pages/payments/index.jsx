// src/pages/order-success/index.jsx
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { orderDbService } from '../../services/orderDbService';

export default function OrderSuccessPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const localOrderId = state?.orderId;
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!localOrderId) {
        navigate('/shopping-cart-checkout', { replace: true });
        return;
      }
      // In mock it’s already confirmed, but this is idempotent.
      await orderDbService.markConfirmed(localOrderId, { response_payload: { source: 'success_page' } });
      setDone(true);
    })();
  }, [localOrderId, navigate]);

  if (!localOrderId) return null;

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-2">Order placed 🎉</h1>
        <p className="text-muted-foreground">Order ID: {localOrderId}</p>
        {done && (
          <button className="mt-6 btn btn-primary" onClick={() => navigate('/order-history-management')}>
            View orders
          </button>
        )}
      </div>
    </div>
  );
}