import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import PollCreationForm from './components/PollCreationForm';
import PollPreview from './components/PollPreview';
import ActivePollsList from './components/ActivePollsList';
import PollHistory from './components/PollHistory';
import DistributionOptions from './components/DistributionOptions';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/custom/Button';

const MealPollingSystem = () => {
  const [polls, setPolls] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [pollPreviewData, setPollPreviewData] = useState({
    title: '',
    restaurants: [],
    mealTypes: [],
    targetAudience: 'all',
    expirationDate: '',
    expirationTime: '',
    allowMultiple: false,
    allowSuggestions: false,
    anonymous: false,
    customMessage: ''
  });

  // Mock user data
  const currentUser = {
    id: 1,
    name: "Coach Sarah Johnson",
    email: "sarah.johnson@athletics.edu",
    role: "head_coach"
  };

  // Initialize with mock polls
  useEffect(() => {
    const mockPolls = [
      {
        id: '1',
        title: 'Friday Practice Lunch',
        restaurants: ['chipotle', 'subway', 'panera'],
        mealTypes: ['lunch'],
        targetAudience: 'all',
        expirationDate: '2025-01-10',
        expirationTime: '14:00',
        allowMultiple: false,
        allowSuggestions: true,
        anonymous: false,
        customMessage: 'Please vote by 2 PM so we can place the order in time for practice!',
        createdAt: new Date('2025-01-08T10:00:00'),
        status: 'active',
        totalVotes: 18,
        finalResults: null
      },
      {
        id: '2',
        title: 'Pre-Game Team Dinner',
        restaurants: ['olive-garden', 'pizza-hut'],
        mealTypes: ['dinner'],
        targetAudience: 'players',
        expirationDate: '2025-01-09',
        expirationTime: '16:00',
        allowMultiple: false,
        allowSuggestions: false,
        anonymous: true,
        customMessage: 'Big game tomorrow! Let\'s fuel up properly.',
        createdAt: new Date('2025-01-07T15:30:00'),
        status: 'active',
        totalVotes: 22,
        finalResults: null
      },
      {
        id: '3',
        title: 'Post-Tournament Celebration',
        restaurants: ['kfc', 'taco-bell', 'mcdonalds'],
        mealTypes: ['dinner'],
        targetAudience: 'all',
        expirationDate: '2025-01-05',
        expirationTime: '18:00',
        allowMultiple: true,
        allowSuggestions: true,
        anonymous: false,
        customMessage: 'Great job everyone! Time to celebrate our victory!',
        createdAt: new Date('2025-01-03T12:00:00'),
        status: 'completed',
        totalVotes: 28,
        finalResults: {
          'kfc': 12,
          'taco-bell': 10,
          'mcdonalds': 6
        }
      },
      {
        id: '4',
        title: 'Training Camp Breakfast',
        restaurants: ['panera', 'subway'],
        mealTypes: ['breakfast'],
        targetAudience: 'players',
        expirationDate: '2025-01-02',
        expirationTime: '08:00',
        allowMultiple: false,
        allowSuggestions: false,
        anonymous: false,
        customMessage: 'Early morning fuel for our training camp!',
        createdAt: new Date('2024-12-30T20:00:00'),
        status: 'expired',
        totalVotes: 15,
        finalResults: {
          'panera': 9,
          'subway': 6
        }
      }
    ];
    setPolls(mockPolls);
  }, []);

  const handleCreatePoll = (newPoll) => {
    setPolls(prev => [newPoll, ...prev]);
    setSelectedPoll(newPoll);
    setActiveTab('distribute');
    
    // Show success message
    setTimeout(() => {
      alert('Poll created successfully! Configure distribution options and send to team members.');
    }, 100);
  };

  const handleSendReminder = (pollId) => {
    const poll = polls?.find(p => p?.id === pollId);
    if (poll) {
      alert(`Reminder sent for poll: "${poll?.title}"`);
    }
  };

  const handleClosePoll = (pollId) => {
    setPolls(prev => prev?.map(poll => 
      poll?.id === pollId 
        ? { 
            ...poll, 
            status: 'completed',
            finalResults: {
              // Mock final results
              [poll?.restaurants?.[0]]: Math.floor(Math.random() * 15) + 5,
              [poll?.restaurants?.[1]]: Math.floor(Math.random() * 10) + 3,
              ...(poll?.restaurants?.[2] && { [poll?.restaurants?.[2]]: Math.floor(Math.random() * 8) + 2 })
            }
          }
        : poll
    ));
    
    const poll = polls?.find(p => p?.id === pollId);
    if (poll) {
      alert(`Poll "${poll?.title}" has been closed and results are final.`);
    }
  };

  const handleRepeatPoll = (originalPoll) => {
    const repeatedPoll = {
      ...originalPoll,
      id: Date.now()?.toString(),
      title: `${originalPoll?.title} (Repeated)`,
      createdAt: new Date(),
      status: 'active',
      totalVotes: 0,
      finalResults: null,
      expirationDate: '',
      expirationTime: ''
    };
    
    setPolls(prev => [repeatedPoll, ...prev]);
    setSelectedPoll(repeatedPoll);
    setActiveTab('create');
    
    // Update preview data
    setPollPreviewData({
      title: repeatedPoll?.title,
      restaurants: repeatedPoll?.restaurants,
      mealTypes: repeatedPoll?.mealTypes,
      targetAudience: repeatedPoll?.targetAudience,
      expirationDate: '',
      expirationTime: '',
      allowMultiple: repeatedPoll?.allowMultiple,
      allowSuggestions: repeatedPoll?.allowSuggestions,
      anonymous: repeatedPoll?.anonymous,
      customMessage: repeatedPoll?.customMessage
    });
    
    alert(`Poll repeated! You can modify the details and create a new poll based on "${originalPoll?.title}".`);
  };

  const handleSendPoll = (distributionData) => {
    const methods = [];
    if (distributionData?.methods?.email) methods?.push('email');
    if (distributionData?.methods?.sms) methods?.push('SMS');
    
    const methodText = methods?.join(' and ');
    const scheduleText = distributionData?.scheduling 
      ? ` scheduled for ${distributionData?.scheduling?.date} at ${distributionData?.scheduling?.time}`
      : ' immediately';
    
    alert(`Poll sent via ${methodText}${scheduleText}! Team members will receive notifications and can start voting.`);
    
    // Update poll status if it was just created
    if (selectedPoll && selectedPoll?.status === 'active') {
      setPolls(prev => prev?.map(poll => 
        poll?.id === selectedPoll?.id 
          ? { ...poll, distributedAt: new Date() }
          : poll
      ));
    }
  };

  const tabs = [
    { id: 'create', label: 'Create Poll', icon: 'Plus' },
    { id: 'active', label: 'Active Polls', icon: 'BarChart3' },
    { id: 'history', label: 'Poll History', icon: 'History' },
    { id: 'distribute', label: 'Distribution', icon: 'Send' }
  ];

  const activePolls = polls?.filter(poll => poll?.status === 'active');
  const completedPolls = polls?.filter(poll => poll?.status !== 'active');

  return (
    <div className="min-h-screen bg-background">
      <Header user={currentUser} notifications={activePolls?.length} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Icon name="Vote" size={24} color="white" />
              </div>
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground">
                  Meal Polling System
                </h1>
                <p className="text-muted-foreground">
                  Create polls, collect team preferences, and make democratic meal decisions
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Icon name="BarChart3" size={20} className="text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Active Polls</span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">{activePolls?.length}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Icon name="CheckCircle" size={20} className="text-success" />
                  <span className="text-sm font-medium text-muted-foreground">Completed</span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">{completedPolls?.length}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Icon name="Users" size={20} className="text-accent" />
                  <span className="text-sm font-medium text-muted-foreground">Total Votes</span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {polls?.reduce((sum, poll) => sum + (poll?.totalVotes || 0), 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-8">
            <div className="border-b border-border">
              <nav className="flex space-x-8">
                {tabs?.map((tab) => (
                  <button
                    key={tab?.id}
                    onClick={() => setActiveTab(tab?.id)}
                    className={`
                      flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-athletic
                      ${activeTab === tab?.id
                        ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                      }
                    `}
                  >
                    <Icon name={tab?.icon} size={16} />
                    <span>{tab?.label}</span>
                    {tab?.id === 'active' && activePolls?.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                        {activePolls?.length}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-8">
            {activeTab === 'create' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7">
                  <PollCreationForm 
                    onCreatePoll={handleCreatePoll}
                    initialData={pollPreviewData}
                    onDataChange={setPollPreviewData}
                  />
                </div>
                <div className="lg:col-span-5">
                  <PollPreview pollData={pollPreviewData} />
                </div>
              </div>
            )}

            {activeTab === 'active' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2">
                  <ActivePollsList 
                    polls={polls}
                    onSendReminder={handleSendReminder}
                    onClosePoll={handleClosePoll}
                  />
                </div>
                <div className="xl:col-span-1">
                  <div className="bg-card border border-border rounded-lg shadow-athletic p-6">
                    <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
                      Quick Actions
                    </h3>
                    <div className="space-y-3">
                      <Button
                        variant="outline"
                        fullWidth
                        iconName="Plus"
                        iconPosition="left"
                        onClick={() => setActiveTab('create')}
                      >
                        Create New Poll
                      </Button>
                      <Button
                        variant="outline"
                        fullWidth
                        iconName="History"
                        iconPosition="left"
                        onClick={() => setActiveTab('history')}
                      >
                        View Poll History
                      </Button>
                      <Button
                        variant="outline"
                        fullWidth
                        iconName="Send"
                        iconPosition="left"
                        onClick={() => setActiveTab('distribute')}
                      >
                        Distribution Options
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <PollHistory 
                polls={polls}
                onRepeatPoll={handleRepeatPoll}
              />
            )}

            {activeTab === 'distribute' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <DistributionOptions 
                  onSendPoll={handleSendPoll}
                  selectedPoll={selectedPoll}
                />
                <div className="space-y-6">
                  {/* Poll Selection */}
                  <div className="bg-card border border-border rounded-lg shadow-athletic p-6">
                    <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
                      Select Poll to Distribute
                    </h3>
                    {activePolls?.length === 0 ? (
                      <div className="text-center py-4">
                        <Icon name="Vote" size={32} className="text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No active polls available</p>
                        <Button
                          variant="outline"
                          size="sm"
                          iconName="Plus"
                          className="mt-3"
                          onClick={() => setActiveTab('create')}
                        >
                          Create Poll
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activePolls?.map((poll) => (
                          <button
                            key={poll?.id}
                            onClick={() => setSelectedPoll(poll)}
                            className={`
                              w-full text-left p-3 border rounded-lg transition-athletic
                              ${selectedPoll?.id === poll?.id
                                ? 'border-primary bg-primary/5' :'border-border hover:bg-muted'
                              }
                            `}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{poll?.title}</span>
                              {selectedPoll?.id === poll?.id && (
                                <Icon name="Check" size={16} className="text-primary" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {poll?.restaurants?.length} restaurants • {poll?.targetAudience}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Distribution Tips */}
                  <div className="bg-accent/10 border border-accent/20 rounded-lg p-6">
                    <div className="flex items-center space-x-2 mb-3">
                      <Icon name="Lightbulb" size={20} className="text-accent" />
                      <h4 className="font-medium text-accent">Distribution Tips</h4>
                    </div>
                    <ul className="text-sm text-accent/80 space-y-1">
                      <li>• Email provides detailed poll information</li>
                      <li>• SMS offers quick mobile access</li>
                      <li>• Schedule delivery for optimal response rates</li>
                      <li>• Send reminders 2-3 hours before expiration</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default MealPollingSystem;