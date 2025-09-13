import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const PaymentSection = ({
  onPaymentMethodChange,
  selectedPaymentMethod,
  savedPaymentMethods = [],
  loadingPayments = false,
  onAddCard, // async(form) => { id, type, brand, last4, expiry, isDefault }
}) => {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardForm, setCardForm] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: '',
    zipCode: ''
  });
  const [cardErrors, setCardErrors] = useState({});

  const handleCardInputChange = (field, value) => {
    let formattedValue = value;
    
    // Format card number
    if (field === 'number') {
      formattedValue = value?.replace(/\s/g, '')?.replace(/(.{4})/g, '$1 ')?.trim();
      if (formattedValue?.length > 19) formattedValue = formattedValue?.slice(0, 19);
    }
    
    // Format expiry
    if (field === 'expiry') {
      formattedValue = value?.replace(/\D/g, '')?.replace(/(\d{2})(\d)/, '$1/$2');
      if (formattedValue?.length > 5) formattedValue = formattedValue?.slice(0, 5);
    }
    
    // Format CVV
    if (field === 'cvv') {
      formattedValue = value?.replace(/\D/g, '')?.slice(0, 4);
    }

    setCardForm(prev => ({ ...prev, [field]: formattedValue }));
    
    // Clear error when user starts typing
    if (cardErrors?.[field]) {
      setCardErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateCard = () => {
    const errors = {};
    
    if (!cardForm?.number || cardForm?.number?.replace(/\s/g, '')?.length < 16) {
      errors.number = 'Please enter a valid card number';
    }
    
    if (!cardForm?.expiry || cardForm?.expiry?.length < 5) {
      errors.expiry = 'Please enter a valid expiry date';
    }
    
    if (!cardForm?.cvv || cardForm?.cvv?.length < 3) {
      errors.cvv = 'Please enter a valid CVV';
    }
    
    if (!cardForm?.name?.trim()) {
      errors.name = 'Please enter the cardholder name';
    }
    
    if (!cardForm?.zipCode?.trim()) {
      errors.zipCode = 'Please enter your ZIP code';
    }
    
    setCardErrors(errors);
    return Object.keys(errors)?.length === 0;
  };

  const handleSaveCard = async () => {
    if (!validateCard()) return;
    try {
      const created = await onAddCard?.(cardForm);
      if (created?.id) onPaymentMethodChange?.(created.id);
      setIsAddingCard(false);
      setCardForm({ number:'', expiry:'', cvv:'', name:'', zipCode:'' });
    } catch (e) {
      setCardErrors((prev) => ({ ...prev, number: 'Failed to save card' }));
    }
  };

  const getCardBrandIcon = (brand) => {
    const icons = {
      visa: 'CreditCard',
      mastercard: 'CreditCard',
      amex: 'CreditCard',
      discover: 'CreditCard'
    };
    return icons?.[brand] || 'CreditCard';
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Payment Method
        </h2>
        <div className="flex items-center space-x-2">
          <Icon name="Shield" size={16} className="text-success" />
          <span className="text-xs text-success font-medium">Secure</span>
        </div>
      </div>
      {!isAddingCard ? (
        <div className="space-y-3">
          {loadingPayments && (
            <div className="p-4 border rounded-lg text-sm text-muted-foreground animate-pulse">
              Loading payment methods...
            </div>
          )}
          {/* Saved Payment Methods */}
          {savedPaymentMethods?.map((method) => (
            <div
              key={method?.id}
              className={`p-4 border rounded-lg cursor-pointer transition-micro ${
                selectedPaymentMethod === method?.id
                  ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
              }`}
              onClick={() => onPaymentMethodChange(method?.id)}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedPaymentMethod === method?.id
                    ? 'border-primary bg-primary' :'border-border'
                }`}>
                  {selectedPaymentMethod === method?.id && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                
                <div className="flex items-center space-x-3 flex-1">
                  {method?.type === 'card' ? (
                    <>
                      <Icon 
                        name={getCardBrandIcon(method?.brand)} 
                        size={20} 
                        className="text-muted-foreground" 
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            •••• •••• •••• {method?.last4}
                          </span>
                          {method?.isDefault && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                        {method?.cardName && (
                          <span className="text-xs text-muted-foreground">
                            {method.cardName}
                          </span>
                        )}
                        {method?.expiry && (
                          <span className="text-xs text-muted-foreground">
                            Expires {method.expiry}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Icon name="Wallet" size={20} className="text-muted-foreground" />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">PayPal</span>
                          {method?.isDefault && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Add New Payment Method */}
          <Button
            variant="outline"
            onClick={() => setIsAddingCard(true)}
            className="w-full justify-center"
          >
            <Icon name="Plus" size={16} className="mr-2" />
            Add New Payment Method
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-medium">Add New Card</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsAddingCard(false)}
            >
              <Icon name="X" size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Card Number"
              type="text"
              placeholder="1234 5678 9012 3456"
              value={cardForm?.number}
              onChange={(e) => handleCardInputChange('number', e?.target?.value)}
              error={cardErrors?.number}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Expiry Date"
                type="text"
                placeholder="MM/YY"
                value={cardForm?.expiry}
                onChange={(e) => handleCardInputChange('expiry', e?.target?.value)}
                error={cardErrors?.expiry}
                required
              />
              <Input
                label="CVV"
                type="text"
                placeholder="123"
                value={cardForm?.cvv}
                onChange={(e) => handleCardInputChange('cvv', e?.target?.value)}
                error={cardErrors?.cvv}
                required
              />
            </div>

            <Input
              label="Cardholder Name"
              type="text"
              placeholder="John Doe"
              value={cardForm?.name}
              onChange={(e) => handleCardInputChange('name', e?.target?.value)}
              error={cardErrors?.name}
              required
            />

            <Input
              label="ZIP Code"
              type="text"
              placeholder="12345"
              value={cardForm?.zipCode}
              onChange={(e) => handleCardInputChange('zipCode', e?.target?.value)}
              error={cardErrors?.zipCode}
              required
            />
          </div>

          <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
            <Icon name="Shield" size={16} className="text-success" />
            <span className="text-sm text-muted-foreground">
              Your payment information is encrypted and secure
            </span>
          </div>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setIsAddingCard(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveCard}
              className="flex-1"
            >
              Save Card
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentSection;