import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/custom/Button';
import Icon from '../../components/AppIcon';

const OrderSuccess = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const orderId = state?.orderId || '';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <div className="max-w-3xl mx-auto px-4 lg:px-6 py-12">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <Icon name="CheckCircle" size={40} className="mx-auto text-success mb-3" />
            <h1 className="text-2xl font-semibold mb-2">Order placed!</h1>
            <p className="text-muted-foreground">
              {orderId
                ? <>Your order <span className="font-mono">{orderId}</span> is being prepared.</>
                : 'Your order is being prepared.'}
            </p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button onClick={() => navigate('/order-history-management')}>View orders</Button>
              <Button variant="outline" onClick={() => navigate('/')}>Go home</Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrderSuccess;
