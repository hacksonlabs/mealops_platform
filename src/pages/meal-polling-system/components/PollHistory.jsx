import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const PollHistory = ({ polls, onRepeatPoll }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const statusOptions = [
    { value: 'all', label: 'All Polls' },
    { value: 'completed', label: 'Completed' },
    { value: 'expired', label: 'Expired' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'most-votes', label: 'Most Votes' },
    { value: 'title', label: 'Title A-Z' }
  ];

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

  const getWinningRestaurant = (poll) => {
    if (!poll?.finalResults) return null;
    
    let maxVotes = 0;
    let winner = null;
    
    Object.entries(poll?.finalResults)?.forEach(([restaurant, votes]) => {
      if (votes > maxVotes) {
        maxVotes = votes;
        winner = restaurant;
      }
    });
    
    return winner;
  };

  const formatDate = (date) => {
    return new Date(date)?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter and sort polls
  const filteredPolls = polls?.filter(poll => {
      const matchesSearch = poll?.title?.toLowerCase()?.includes(searchTerm?.toLowerCase());
      const matchesStatus = filterStatus === 'all' || poll?.status === filterStatus;
      return matchesSearch && matchesStatus && poll?.status !== 'active';
    })?.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'most-votes':
          return (b?.totalVotes || 0) - (a?.totalVotes || 0);
        case 'title':
          return a?.title?.localeCompare(b?.title);
        default: // newest
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic p-6">
      <div className="flex items-center space-x-2 mb-6">
        <Icon name="History" size={24} className="text-primary" />
        <h2 className="text-xl font-heading font-semibold text-foreground">Poll History</h2>
      </div>
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Input
          type="search"
          placeholder="Search polls..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e?.target?.value)}
          className="mb-0"
        />
        <Select
          options={statusOptions}
          value={filterStatus}
          onChange={setFilterStatus}
          placeholder="Filter by status"
          className="mb-0"
        />
        <Select
          options={sortOptions}
          value={sortBy}
          onChange={setSortBy}
          placeholder="Sort by"
          className="mb-0"
        />
      </div>
      {/* Poll List */}
      {filteredPolls?.length === 0 ? (
        <div className="text-center py-8">
          <Icon name="Search" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">No polls found</h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm || filterStatus !== 'all' ?'Try adjusting your search or filters' :'Completed polls will appear here'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPolls?.map((poll) => {
            let winner = getWinningRestaurant(poll);
            const statusColor = {
              completed: 'text-success',
              expired: 'text-warning',
              cancelled: 'text-error'
            }?.[poll?.status] || 'text-muted-foreground';

            return (
              <div key={poll?.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-athletic">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-foreground mb-1">
                      {poll?.title}
                    </h3>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center space-x-1">
                        <Icon name="Calendar" size={14} />
                        <span>{formatDate(poll?.createdAt)}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Icon name="Vote" size={14} />
                        <span>{poll?.totalVotes || 0} votes</span>
                      </span>
                      <span className={`flex items-center space-x-1 ${statusColor}`}>
                        <Icon name="Circle" size={14} />
                        <span className="capitalize">{poll?.status}</span>
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="RotateCcw"
                    onClick={() => onRepeatPoll(poll)}
                  >
                    Repeat
                  </Button>
                </div>
                {/* Winner */}
                {winner && (
                  <div className="mb-3 p-3 bg-success/10 border border-success/20 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Icon name="Trophy" size={16} className="text-success" />
                      <span className="text-sm font-medium text-success">
                        Winner: {getRestaurantName(winner)}
                      </span>
                      <span className="text-xs text-success/80">
                        ({poll?.finalResults?.[winner]} votes)
                      </span>
                    </div>
                  </div>
                )}
                {/* Results Summary */}
                {poll?.finalResults && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-foreground">Final Results:</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {Object.entries(poll?.finalResults)?.sort(([,a], [,b]) => b - a)?.map(([restaurant, votes]) => {
                          const percentage = poll?.totalVotes > 0 ? (votes / poll?.totalVotes) * 100 : 0;
                          const isWinner = restaurant === winner;
                          
                          return (
                            <div key={restaurant} className="flex items-center justify-between text-sm">
                              <span className={`${isWinner ? 'font-medium text-success' : 'text-foreground'}`}>
                                {getRestaurantName(restaurant)}
                                {isWinner && <Icon name="Crown" size={12} className="inline ml-1" />}
                              </span>
                              <span className="text-muted-foreground">
                                {votes} ({percentage?.toFixed(1)}%)
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
                {/* Poll Options */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {poll?.allowMultiple && (
                    <span className="inline-flex items-center px-2 py-1 bg-muted text-xs text-muted-foreground rounded">
                      Multiple Choice
                    </span>
                  )}
                  {poll?.anonymous && (
                    <span className="inline-flex items-center px-2 py-1 bg-muted text-xs text-muted-foreground rounded">
                      Anonymous
                    </span>
                  )}
                  {poll?.allowSuggestions && (
                    <span className="inline-flex items-center px-2 py-1 bg-muted text-xs text-muted-foreground rounded">
                      Custom Suggestions
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PollHistory;