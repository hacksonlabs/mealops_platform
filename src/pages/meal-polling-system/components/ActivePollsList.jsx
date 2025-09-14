import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';

const ActivePollsList = ({ polls, onSendReminder, onClosePoll }) => {
  const [pollResults, setPollResults] = useState({});

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      const updatedResults = {};
      polls?.forEach(poll => {
        if (poll?.status === 'active') {
          // Simulate vote updates
          const totalVotes = Math.floor(Math.random() * 25) + 5;
          const results = {};
          poll?.restaurants?.forEach((restaurant, index) => {
            results[restaurant] = Math.floor(Math.random() * totalVotes);
          });
          updatedResults[poll.id] = {
            totalVotes,
            results,
            participationRate: Math.floor((totalVotes / 30) * 100) // Assuming 30 team members
          };
        }
      });
      setPollResults(updatedResults);
    }, 3000);

    return () => clearInterval(interval);
  }, [polls]);

  const getRestaurantName = (value) => {
    const restaurantOptions = {
      'chipotle': 'Chipotle Mexican Grill',
      'subway': 'Subway',
      'panera': 'Panera Bread',
      'olive-garden': 'Olive Garden',
      'pizza-hut': 'Pizza Hut',
      'kfc': 'KFC',
      'taco-bell': 'Taco Bell',
      'mcdonalds': 'McDonald\'s'
    };
    return restaurantOptions?.[value] || value;
  };

  const getTimeRemaining = (expirationDate, expirationTime) => {
    if (!expirationDate) return 'No expiration';
    
    const expiration = new Date(`${expirationDate}T${expirationTime || '23:59'}`);
    const now = new Date();
    const diff = expiration - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} remaining`;
    }
    
    return `${hours}h ${minutes}m remaining`;
  };

  const getWinningRestaurant = (results) => {
    if (!results || Object.keys(results)?.length === 0) return null;
    
    let maxVotes = 0;
    let winner = null;
    
    Object.entries(results)?.forEach(([restaurant, votes]) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        winner = restaurant;
      }
    });
    
    return winner;
  };

  const activePollsData = polls?.filter(poll => poll?.status === 'active');

  if (activePollsData?.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-athletic p-8 text-center">
        <Icon name="Vote" size={48} className="text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">No Active Polls</h3>
        <p className="text-sm text-muted-foreground">
          Create a new poll to start collecting team preferences
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Icon name="BarChart3" size={24} className="text-primary" />
          <h2 className="text-xl font-heading font-semibold text-foreground">Active Polls</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          {activePollsData?.length} active poll{activePollsData?.length !== 1 ? 's' : ''}
        </span>
      </div>
      {activePollsData?.map((poll) => {
        const results = pollResults?.[poll?.id] || { totalVotes: 0, results: {}, participationRate: 0 };
        const timeRemaining = getTimeRemaining(poll?.expirationDate, poll?.expirationTime);
        let winner = getWinningRestaurant(results?.results);
        const isExpired = timeRemaining === 'Expired';

        return (
          <div key={poll?.id} className="bg-card border border-border rounded-lg shadow-athletic p-6">
            {/* Poll Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-heading font-semibold text-foreground mb-1">
                  {poll?.title}
                </h3>
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center space-x-1">
                    <Icon name="Users" size={14} />
                    <span>{poll?.targetAudience === 'all' ? 'All Team' : poll?.targetAudience}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Icon name="Clock" size={14} />
                    <span className={isExpired ? 'text-error' : ''}>{timeRemaining}</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <Icon name="Vote" size={14} />
                    <span>{results?.totalVotes} votes ({results?.participationRate}%)</span>
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {!isExpired && (
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="Send"
                    onClick={() => onSendReminder(poll?.id)}
                  >
                    Remind
                  </Button>
                )}
                <Button
                  variant={isExpired ? "default" : "outline"}
                  size="sm"
                  iconName={isExpired ? "CheckCircle" : "X"}
                  onClick={() => onClosePoll(poll?.id)}
                >
                  {isExpired ? 'Close' : 'End Early'}
                </Button>
              </div>
            </div>
            {/* Results */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Current Results</h4>
                {winner && (
                  <span className="text-xs text-success flex items-center space-x-1">
                    <Icon name="Trophy" size={12} />
                    <span>Leading: {getRestaurantName(winner)}</span>
                  </span>
                )}
              </div>

              {poll?.restaurants?.map((restaurant) => {
                const votes = results?.results?.[restaurant] || 0;
                const percentage = results?.totalVotes > 0 ? (votes / results?.totalVotes) * 100 : 0;
                const isWinning = restaurant === winner && results?.totalVotes > 0;

                return (
                  <div key={restaurant} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${isWinning ? 'text-success' : 'text-foreground'}`}>
                        {getRestaurantName(restaurant)}
                        {isWinning && <Icon name="Crown" size={14} className="inline ml-1" />}
                      </span>
                      <span className="text-muted-foreground">
                        {votes} votes ({percentage?.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          isWinning ? 'bg-success' : 'bg-primary'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Poll Options */}
            {poll?.allowMultiple && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground flex items-center space-x-1">
                  <Icon name="Info" size={12} />
                  <span>Multiple selections allowed</span>
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ActivePollsList;