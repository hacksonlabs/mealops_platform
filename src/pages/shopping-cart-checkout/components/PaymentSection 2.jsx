// src/pages/checkout/components/PaymentSection.jsx
import React, { useMemo, useEffect, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';

const PaymentSection = ({
  provider,                     // 'stripe' | 'mealme' | 'mock' (via paymentService.isMock)
  isMock = false,
  onPaymentMethodChange,
  selectedPaymentMethod,
  savedPaymentMethods = [],
  loadingPayments = false,
  onAddCard,                    // add card action (mock inserts fake, stripe redirects)
  onManageCards,                // stripe portal (ignored in mock/mealme)
}) => {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => { if (!selectedPaymentMethod) setIsOpen(true); }, [selectedPaymentMethod]);

  const selected = useMemo(
    () => savedPaymentMethods.find(m => m.id === selectedPaymentMethod) || null,
    [savedPaymentMethods, selectedPaymentMethod]
  );

  const getCardBrandIcon = (brand) => {
    const icons = { visa: 'CreditCard', mastercard: 'CreditCard', amex: 'CreditCard', discover: 'CreditCard' };
    return icons[(brand || '').toLowerCase()] || 'CreditCard';
  };

  const isStripe = provider === 'stripe';
  const isMealMe = provider === 'mealme';

  return (
    <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Payment Method</h2>
          <span className="flex items-center gap-1 text-xs text-success font-medium">
            <Icon name="Shield" size={16} className="text-success" />
            {isMock ? 'Mocked' : 'Secure'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(v => !v)}
          aria-expanded={isOpen}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          {isOpen ? 'Hide' : 'Change'}
          <Icon name="ChevronDown" size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {!isOpen && selected && (
        <div
          className="mt-4 p-4 border rounded-lg bg-muted/40 cursor-pointer"
          role="button"
          onClick={() => setIsOpen(true)}
          title="Change payment method"
        >
          <div className="flex items-center gap-3">
            <Icon name={getCardBrandIcon(selected.brand)} size={20} className="text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">•••• •••• •••• {selected.last4}</span>
                {selected.isDefault && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Default</span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {selected.cardName ? <span className="mr-2">{selected.cardName}</span> : null}
                {selected.expiry ? <span>Expires {selected.expiry}</span> : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="mt-4 space-y-3">
          {loadingPayments && (
            <div className="p-4 border rounded-lg text-sm text-muted-foreground animate-pulse">
              Loading payment methods...
            </div>
          )}

          {savedPaymentMethods?.map((method) => {
            const isSelected = selectedPaymentMethod === method?.id;
            return (
              <div
                key={method?.id}
                className={`p-4 border rounded-lg cursor-pointer transition-micro ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
                onClick={() => {
                  onPaymentMethodChange?.(method?.id);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-primary bg-primary' : 'border-border'
                  }`}>
                    {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>

                  <div className="flex items-center gap-3 flex-1">
                    <Icon name={getCardBrandIcon(method?.brand)} size={20} className="text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">•••• •••• •••• {method?.last4}</span>
                        {method?.isDefault && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Default</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-x-2">
                        {method?.cardName ? <span>{method.cardName}</span> : null}
                        {method?.expiry ? <span>Expires {method.expiry}</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Actions */}
          {isStripe && !isMock ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onAddCard} className="flex-1 justify-center">
                <Icon name="Plus" size={16} className="mr-2" />
                Add New Payment Method
              </Button>
              <Button variant="outline" onClick={onManageCards} className="flex-1 justify-center">
                Manage in Stripe
              </Button>
            </div>
          ) : null}

          {(isMock || isMealMe) && savedPaymentMethods.length === 0 ? (
            <div className="mt-2 p-3 rounded-lg border border-border bg-muted/40">
              <p className="text-sm mb-2">
                {isMock
                  ? 'Mock mode: Click “Add Card” to seed a fake card in your DB.'
                  : 'You’ll add or choose a card during the secure payment step.'}
              </p>
              {isMock && (
                <Button variant="outline" onClick={onAddCard} className="w-full justify-center">
                  <Icon name="Plus" size={16} className="mr-2" />
                  Add Card (Mock)
                </Button>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default PaymentSection;
