import React, { useState } from 'react';
import Button from '../../../components/ui/custom/Button';
import Select from '../../../components/ui/custom/Select';
import Icon from '../../../components/AppIcon';

const TeamAssignmentModal = ({ paymentMethod, teams, onSubmit, onClose }) => {
  const [selectedTeam, setSelectedTeam] = useState(paymentMethod?.team_id || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!selectedTeam) {
      alert('Please select a team');
      return;
    }

    setLoading(true);
    try {
      await onSubmit?.(selectedTeam);
    } catch (error) {
      console.error('Error updating team assignment:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Reassign Payment Method</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-md transition-colors"
            >
              <Icon name="X" size={20} />
            </button>
          </div>

          {/* Current Assignment */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="text-sm font-medium text-foreground mb-2">Current Assignment</h3>
            <div className="flex items-center space-x-3">
              <Icon name="CreditCard" size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{paymentMethod?.card_name}</p>
                <p className="text-xs text-muted-foreground">
                  Currently assigned to: {paymentMethod?.team?.name || 'Unassigned'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Team Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Assign to Team
              </label>
              <Select
                value={selectedTeam}
                onValueChange={setSelectedTeam}
              >
                <option value="">Select a team</option>
                {teams?.map((team) => (
                  <option key={team?.id} value={team?.id}>
                    {team?.name} ({team?.sport})
                  </option>
                ))}
              </Select>
            </div>

            {/* Team Permissions Preview */}
            {selectedTeam && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Icon name="Users" size={16} className="text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">Team Access</h4>
                    <p className="text-xs text-blue-700 mt-1">
                      All team members and coaches will be able to use this payment method for meal orders.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Security Notice */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start space-x-3">
                <Icon name="Shield" size={16} className="text-muted-foreground mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-foreground">Security & Permissions</h4>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                    <li>• Team members can view and use this payment method</li>
                    <li>• Spending limits and approval workflows remain active</li>
                    <li>• All transactions are logged and trackable</li>
                    <li>• Coaches retain administrative control</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
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
                disabled={loading || !selectedTeam}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Icon name="Users" size={16} className="mr-2" />
                    Reassign Team
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

export default TeamAssignmentModal;