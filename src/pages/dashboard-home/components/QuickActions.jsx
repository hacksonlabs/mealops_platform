import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { teamService } from '../../../services/not_used_yet/teamService';
import { useAuth } from '../../../contexts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';

export function QuickActions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadTeamData = async () => {
      // The `loading` state is now set to false regardless of whether a user exists.
      try {
        if (user) {
          const { data: teamData } = await teamService?.getUserTeam();
          if (isMounted) {
            setTeam(teamData);
          }
        }
      } catch (error) {
        console.error('Error loading team data:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTeamData();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const handleScheduleOrder = () => {
    if (team?.id) {
      navigate('/calendar-order-scheduling');
    } else {
      navigate('/team-setup');
    }
  };

  const quickActions = [
    {
      icon: "Calendar",
      title: "Schedule Order",
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4 w-32"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-100 rounded"></div>
            <div className="h-12 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="mt-6 pt-4 border-t border-border">
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            fullWidth 
            iconName="Settings" 
            iconPosition="left"
            size="sm"
            onClick={() => { /* Add your Settings navigation here */ }}
          >
            Settings
          </Button>
          <Button 
            variant="outline" 
            fullWidth 
            iconName="HelpCircle" 
            iconPosition="left"
            size="sm"
            onClick={() => { /* Add your Help navigation here */ }}
          >
            Help
          </Button>
        </div>
      </div>
    </div>
  );
}

export default QuickActions;