import React, { useState } from 'react';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import { Checkbox } from '../../../components/ui/custom/Checkbox';
import Icon from '../../../components/AppIcon';

const AddPaymentMethodModal = ({ teams, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    card_name: '',
    last_four: '',
    team_id: '',
    is_default: false
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.card_name?.trim()) {
      newErrors.card_name = 'Card name is required';
    }

    if (!formData?.last_four?.trim()) {
      newErrors.last_four = 'Last four digits are required';
    } else if (!/^\d{4}$/?.test(formData?.last_four)) {
      newErrors.last_four = 'Last four digits must be exactly 4 numbers';
    }

    if (!formData?.team_id) {
      newErrors.team_id = 'Team assignment is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      await onSubmit?.(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors?.[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Add Payment Method</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-md transition-colors"
            >
              <Icon name="X" size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Security Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start space-x-3">
                <Icon name="Shield" size={20} className="text-blue-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-blue-900">Secure Tokenization</h3>
                  <p className="text-xs text-blue-700 mt-1">
                    Card details are securely tokenized and encrypted. Full card numbers are never stored.
                  </p>
                </div>
              </div>
            </div>

            {/* Card Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Card Name / Description
              </label>
              <Input
                placeholder="e.g., Team Card - Basketball"
                value={formData?.card_name}
                onChange={(e) => handleInputChange('card_name', e?.target?.value)}
                error={errors?.card_name}
              />
            </div>

            {/* Last Four Digits */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Last Four Digits
              </label>
              <Input
                placeholder="1234"
                maxLength={4}
                value={formData?.last_four}
                onChange={(e) => {
                  const value = e?.target?.value?.replace(/\D/g, '');
                  handleInputChange('last_four', value);
                }}
                error={errors?.last_four}
              />
            </div>

            {/* Team Assignment */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Assign to Team
              </label>
              <Select
                value={formData?.team_id}
                onValueChange={(value) => handleInputChange('team_id', value)}
                error={errors?.team_id}
              >
                <option value="">Select a team</option>
                {teams?.map((team) => (
                  <option key={team?.id} value={team?.id}>
                    {team?.name} ({team?.sport})
                  </option>
                ))}
              </Select>
            </div>

            {/* Default Setting */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_default"
                checked={formData?.is_default}
                onCheckedChange={(checked) => handleInputChange('is_default', checked)}
              />
              <label htmlFor="is_default" className="text-sm text-foreground">
                Set as default payment method for this team
              </label>
            </div>

            {/* Billing Address Section */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-medium text-foreground mb-2">Billing Information</h3>
              <p className="text-xs text-muted-foreground">
                Billing address verification will be handled during checkout for security compliance.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Icon name="Plus" size={16} className="mr-2" />
                    Add Payment Method
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddPaymentMethodModal;