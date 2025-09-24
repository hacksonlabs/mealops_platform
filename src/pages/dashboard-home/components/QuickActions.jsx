import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';

export function QuickActions() {
  const navigate = useNavigate();

  const handleScheduleOrder = () => {
    navigate('/calendar-order-scheduling', { state: { openScheduleModal: true } });
  };

  const quickActions = [
    {
      icon: "Calendar",
      title: "Schedule Meal",
      description: "Schedule a new order for your team",
      variant: "default",
      onClick: handleScheduleOrder
    },
    {
      icon: "Users",
      title: "Manage Team",
      description: "View and manage team members",
      variant: "outline",
      onClick: () => navigate('/team-members-management')
    }
  ];

  // No async load needed here; we navigate directly to Calendar with modal open.

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Quick Actions</h3>
      </div>
      <div className="space-y-3">
        {quickActions?.map((action, index) => (
          <div 
            key={index}
            className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-athletic cursor-pointer group"
            onClick={action?.onClick}
          >
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon name={action?.icon} size={20} />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground mb-1">
                  {action?.title}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {action?.description}
                </p>
              </div>

              <div className="flex-shrink-0">
                <Icon name="ArrowRight" size={20} className="text-muted-foreground group-hover:text-foreground transition-athletic" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* <div className="mt-6 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            fullWidth 
            iconName="Settings" 
            iconPosition="left"
            size="sm"
            onClick={() => {}}
          >
            Settings
          </Button>
          <Button 
            variant="outline" 
            fullWidth 
            iconName="HelpCircle" 
            iconPosition="left"
            size="sm"
            onClick={() => {}}
          >
            Help
          </Button>
        </div>
      </div> */}
    </div>
  );
}

export default QuickActions;
