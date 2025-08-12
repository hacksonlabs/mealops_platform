import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const MemberDetailModal = ({ member, onClose }) => {
  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      coach: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Coach' },
      player: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Player' },
      admin: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Admin' }
    };

    const config = roleConfig?.[role] || roleConfig?.player;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.bg} ${config?.text}`}>
        {config?.label}
      </span>
    );
  };

  const getStatusBadge = (isActive) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
          Active
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5"></div>
          Inactive
        </span>
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Member Details</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            iconName="X"
          />
        </div>

        <div className="p-6">
          {/* Profile Section */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name="User" size={28} className="text-primary" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-foreground">
                {member?.user_profiles?.full_name}
              </h4>
              <p className="text-muted-foreground">
                {member?.user_profiles?.email}
              </p>
              <div className="flex items-center space-x-2 mt-2">
                {getRoleBadge(member?.user_profiles?.role)}
                {getStatusBadge(member?.user_profiles?.is_active)}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4 mb-6">
            <h5 className="font-medium text-foreground border-b border-border pb-2">
              Contact Information
            </h5>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-3">
                <Icon name="Mail" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">
                    {member?.user_profiles?.email}
                  </p>
                </div>
              </div>

              {member?.user_profiles?.phone ? (
                <div className="flex items-center space-x-3">
                  <Icon name="Phone" size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Phone</p>
                    <p className="text-sm text-muted-foreground">
                      {member?.user_profiles?.phone}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Icon name="Phone" size={16} className="text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Phone</p>
                    <p className="text-sm text-muted-foreground">Not provided</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Health Information */}
          <div className="space-y-4 mb-6">
            <h5 className="font-medium text-foreground border-b border-border pb-2">
              Health Information
            </h5>
            
            <div className="flex items-start space-x-3">
              <Icon name="AlertTriangle" size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Dietary Restrictions & Allergies</p>
                <div className="mt-1">
                  {member?.user_profiles?.allergies ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800">
                        {member?.user_profiles?.allergies}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No restrictions specified</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Team Information */}
          <div className="space-y-4 mb-6">
            <h5 className="font-medium text-foreground border-b border-border pb-2">
              Team Information
            </h5>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-3">
                <Icon name="Calendar" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Joined Team</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(member?.joined_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon name="Shield" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Role</p>
                  <p className="text-sm text-muted-foreground">
                    {member?.user_profiles?.role?.charAt(0)?.toUpperCase() + member?.user_profiles?.role?.slice(1)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon name="Activity" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Status</p>
                  <p className="text-sm text-muted-foreground">
                    {member?.user_profiles?.is_active ? 'Active member' : 'Inactive member'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Statistics */}
          <div className="space-y-4">
            <h5 className="font-medium text-foreground border-b border-border pb-2">
              Activity Statistics
            </h5>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-lg font-semibold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">Orders Participated</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-lg font-semibold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">Polls Participated</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 mt-8 pt-6 border-t border-border">
            <Button
              variant="outline"
              iconName="MessageCircle"
              iconPosition="left"
            >
              Send Message
            </Button>
            <Button
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberDetailModal;