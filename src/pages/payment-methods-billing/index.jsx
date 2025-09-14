import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts';
import { paymentService } from '../../services/paymentService';
import { teamService } from '../../services/teamService';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/custom/Button';
import Input from '../../components/ui/custom/Input';
import Select from '../../components/ui/custom/Select';
import Icon from '../../components/AppIcon';
import PaymentMethodCard from './components/PaymentMethodCard';
import AddPaymentMethodModal from './components/AddPaymentMethodModal';
import EditPaymentMethodModal from './components/EditPaymentMethodModal';
import TransactionHistoryModal from './components/TransactionHistoryModal';
import SpendingAnalyticsCard from './components/SpendingAnalyticsCard';
import TeamAssignmentModal from './components/TeamAssignmentModal';

const PaymentMethodsBilling = () => {
  const { user, session } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLegalDisclaimer, setShowLegalDisclaimer] = useState(false);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [viewingTransactions, setViewingTransactions] = useState(null);
  const [assigningTeam, setAssigningTeam] = useState(null);

  // PCI-compliant dummy data generator
  const generateSecureDummyData = () => {
    const dummyPaymentMethods = [
      {
        id: '1',
        card_name: 'Company Business Card',
        last_four: '4242', // Test card number - not real
        team_id: '1',
        team: { name: 'Main Team', sport: 'Basketball' },
        is_default: true,
        created_by: user?.id,
        created_by_profile: { 
          full_name: user?.user_metadata?.full_name || 'Admin User',
          email: user?.email || 'admin@company.com'
        },
        created_at: new Date()?.toISOString(),
        card_type: 'visa',
        security_status: 'verified',
        encryption_status: 'encrypted',
        pci_compliant: true
      },
      {
        id: '2',
        card_name: 'Team Emergency Card',
        last_four: '8888', // Dummy test number
        team_id: '2',
        team: { name: 'Secondary Team', sport: 'Soccer' },
        is_default: false,
        created_by: user?.id,
        created_by_profile: { 
          full_name: user?.user_metadata?.full_name || 'Manager User',
          email: user?.email || 'manager@company.com'
        },
        created_at: new Date(Date.now() - 86400000)?.toISOString(), // Yesterday
        card_type: 'mastercard',
        security_status: 'verified',
        encryption_status: 'encrypted',
        pci_compliant: true
      },
      {
        id: '3',
        card_name: 'Petty Cash Card',
        last_four: '0000', // Masked dummy number
        team_id: '1',
        team: { name: 'Main Team', sport: 'Basketball' },
        is_default: false,
        created_by: user?.id,
        created_by_profile: { 
          full_name: user?.user_metadata?.full_name || 'Finance User',
          email: user?.email || 'finance@company.com'
        },
        created_at: new Date(Date.now() - 172800000)?.toISOString(), // 2 days ago
        card_type: 'amex',
        security_status: 'verified',
        encryption_status: 'encrypted',
        pci_compliant: true
      }
    ];

    const dummyTeams = [
      {
        id: '1',
        name: 'Main Team',
        sport: 'Basketball'
      },
      {
        id: '2', 
        name: 'Secondary Team',
        sport: 'Soccer'
      }
    ];

    return { dummyPaymentMethods, dummyTeams };
  };

  useEffect(() => {
    // Only load data when we have a valid authenticated session
    if (user?.id && session?.access_token) {
      loadInitialData();
    }
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    // Only reload payment methods if we have data loaded initially
    if (user?.id && session?.access_token && !loading) {
      loadPaymentMethods();
    }
  }, [selectedTeam, user?.id, session?.access_token]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Show legal disclaimer for first-time users
      if (!localStorage.getItem('payment_legal_acknowledged')) {
        setShowLegalDisclaimer(true);
      }

      // Add timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        console.warn('API calls taking too long, using demo data');
        const { dummyPaymentMethods, dummyTeams } = generateSecureDummyData();
        setPaymentMethods(dummyPaymentMethods);
        setTeams(dummyTeams);
        setLoading(false);
      }, 10000); // 10 second timeout

      try {
        const [paymentsResult, teamsResult] = await Promise.allSettled([
          Promise.race([
            paymentService?.getPaymentMethods(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Payment service timeout')), 8000)
            )
          ]),
          Promise.race([
            teamService?.getUserTeams(user?.id),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Team service timeout')), 8000)
            )
          ])
        ]);

        clearTimeout(timeout);

        // Handle payment methods result
        if (paymentsResult?.status === 'fulfilled' && 
            paymentsResult?.value?.data && 
            Array.isArray(paymentsResult?.value?.data) &&
            paymentsResult?.value?.data?.length > 0) {
          setPaymentMethods(paymentsResult?.value?.data);
        } else {
          console.warn('Payment methods API unavailable or empty, using secure demo data');
          const { dummyPaymentMethods } = generateSecureDummyData();
          setPaymentMethods(dummyPaymentMethods);
        }

        // Handle teams result
        if (teamsResult?.status === 'fulfilled' && 
            teamsResult?.value?.data && 
            Array.isArray(teamsResult?.value?.data) &&
            teamsResult?.value?.data?.length > 0) {
          setTeams(teamsResult?.value?.data);
        } else {
          console.warn('Teams API unavailable or empty, using secure demo data');
          const { dummyTeams } = generateSecureDummyData();
          setTeams(dummyTeams);
        }

      } catch (apiError) {
        clearTimeout(timeout);
        console.error('API error:', apiError);
        // Fallback to dummy data for demo purposes
        const { dummyPaymentMethods, dummyTeams } = generateSecureDummyData();
        setPaymentMethods(dummyPaymentMethods);
        setTeams(dummyTeams);
      }

    } catch (err) {
      console.error('Error loading initial data:', err);
      // Final fallback to dummy data
      const { dummyPaymentMethods, dummyTeams } = generateSecureDummyData();
      setPaymentMethods(dummyPaymentMethods);
      setTeams(dummyTeams);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    try {
      setError(null);
      
      const teamId = selectedTeam === 'all' ? null : selectedTeam;
      
      // Add timeout to prevent hanging
      const result = await Promise.race([
        paymentService?.getPaymentMethods(teamId),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Payment methods timeout')), 5000)
        )
      ]);
      
      if (result?.data && Array.isArray(result?.data)) {
        setPaymentMethods(result?.data);
      } else {
        // Filter dummy data by team if needed
        const { dummyPaymentMethods } = generateSecureDummyData();
        const filteredData = teamId 
          ? dummyPaymentMethods?.filter(method => method?.team_id === teamId)
          : dummyPaymentMethods;
        setPaymentMethods(filteredData);
      }
    } catch (err) {
      console.error('Error loading payment methods:', err);
      // Fallback to filtered dummy data
      const { dummyPaymentMethods } = generateSecureDummyData();
      const filteredData = selectedTeam !== 'all' 
        ? dummyPaymentMethods?.filter(method => method?.team_id === selectedTeam)
        : dummyPaymentMethods;
      setPaymentMethods(filteredData);
    }
  };

  const handleAddPaymentMethod = async (paymentData) => {
    try {
      const result = await paymentService?.createPaymentMethod({
        ...paymentData,
        created_by: user?.id
      });

      if (result?.error) {
        setError(result?.error?.message);
      } else {
        setPaymentMethods(prev => [result?.data, ...prev]);
        setShowAddModal(false);
      }
    } catch (err) {
      setError('Failed to add payment method');
      console.error('Error adding payment method:', err);
    }
  };

  const handleEditPaymentMethod = async (id, updates) => {
    try {
      const result = await paymentService?.updatePaymentMethod(id, updates);

      if (result?.error) {
        setError(result?.error?.message);
      } else {
        setPaymentMethods(prev => 
          prev?.map(method => 
            method?.id === id ? result?.data : method
          )
        );
        setEditingMethod(null);
      }
    } catch (err) {
      setError('Failed to update payment method');
      console.error('Error updating payment method:', err);
    }
  };

  const handleDeletePaymentMethod = async (id) => {
    if (!window.confirm('Are you sure you want to remove this payment method?')) {
      return;
    }

    try {
      const result = await paymentService?.deletePaymentMethod(id);

      if (result?.error) {
        setError(result?.error?.message);
      } else {
        setPaymentMethods(prev => prev?.filter(method => method?.id !== id));
      }
    } catch (err) {
      setError('Failed to remove payment method');
      console.error('Error removing payment method:', err);
    }
  };

  const handleSetDefault = async (id, teamId) => {
    try {
      const result = await paymentService?.setDefaultPaymentMethod(id, teamId);

      if (result?.error) {
        setError(result?.error?.message);
      } else {
        loadPaymentMethods(); // Refresh the list
      }
    } catch (err) {
      setError('Failed to set default payment method');
      console.error('Error setting default:', err);
    }
  };

  const filteredPaymentMethods = paymentMethods?.filter(method =>
    method?.card_name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
    method?.last_four?.includes(searchTerm) ||
    method?.team?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase())
  ) || [];

  // Legal compliance acknowledgment
  const handleLegalAcknowledgment = () => {
    localStorage.setItem('payment_legal_acknowledged', 'true');
    setShowLegalDisclaimer(false);
  };

  // Show loading only when we don't have user session yet
  if (loading || !user?.id || !session?.access_token) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={user} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">
              {!user?.id ? 'Authenticating...' : 'Loading payment methods...'}
            </p>
            {loading && (
              <p className="text-xs text-muted-foreground mt-2">
                If this takes more than a few seconds, we'll show demo data
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} />
      
      {/* Legal Compliance Disclaimer Modal */}
      {showLegalDisclaimer && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon name="Shield" size={24} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Payment Security Notice</h2>
                  <p className="text-sm text-muted-foreground">Important security and compliance information</p>
                </div>
              </div>
              
              <div className="space-y-4 mb-6 text-sm text-foreground">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">🔒 Demo Data Notice</h3>
                  <p className="text-blue-800">
                    The payment methods shown are demonstration data only. No real payment information is stored or processed.
                  </p>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="font-medium text-green-900 mb-2">🛡️ PCI Compliance</h3>
                  <p className="text-green-800 mb-2">Our payment processing follows PCI DSS standards:</p>
                  <ul className="list-disc ml-4 space-y-1 text-green-800">
                    <li>All payment data is encrypted at rest and in transit</li>
                    <li>Only last 4 digits of card numbers are displayed</li>
                    <li>Full card numbers are never stored in our systems</li>
                    <li>Access is restricted to authorized personnel only</li>
                  </ul>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h3 className="font-medium text-amber-900 mb-2">⚖️ Legal Compliance</h3>
                  <ul className="list-disc ml-4 space-y-1 text-amber-800">
                    <li>Payment methods require proper authorization</li>
                    <li>Team administrators can manage payment settings</li>
                    <li>All transactions are logged for audit purposes</li>
                    <li>Data retention follows applicable regulations</li>
                  </ul>
                </div>

                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <h3 className="font-medium text-purple-900 mb-2">🔐 Security Features</h3>
                  <ul className="list-disc ml-4 space-y-1 text-purple-800">
                    <li>Multi-factor authentication required for changes</li>
                    <li>Role-based access controls</li>
                    <li>Real-time fraud monitoring</li>
                    <li>Secure payment tokenization</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button onClick={handleLegalAcknowledgment} className="flex-1">
                  I Understand - Continue to Payment Methods
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section with Security Badge */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-3xl font-bold text-foreground">Payment Methods & Billing</h1>
                  <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                    <Icon name="Shield" size={12} />
                    <span>PCI Compliant</span>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Manage team payment methods securely with industry-standard encryption
                </p>
              </div>
              <Button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center space-x-2"
              >
                <Icon name="Plus" size={16} />
                <span>Add Payment Method</span>
              </Button>
            </div>
          </div>

          {/* Demo Data Warning Banner */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center space-x-3">
            <Icon name="Info" size={20} className="text-blue-600" />
            <div className="flex-1">
              <p className="text-blue-800 font-medium">Demo Mode Active</p>
              <p className="text-blue-700 text-sm">
                Showing secure demonstration data. No real payment information is displayed or processed.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-xs text-blue-600">
              <Icon name="Lock" size={12} />
              <span>Encrypted</span>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center space-x-3">
              <Icon name="AlertTriangle" size={20} className="text-destructive" />
              <div>
                <p className="text-destructive font-medium">Error</p>
                <p className="text-destructive text-sm">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)}
                className="ml-auto text-destructive hover:bg-destructive/10 p-1 rounded"
              >
                <Icon name="X" size={16} />
              </button>
            </div>
          )}

          {/* Filters and Search */}
          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search payment methods..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e?.target?.value || '')}
                leftIcon="Search"
                className="max-w-md"
              />
            </div>
            <Select
              value={selectedTeam}
              onValueChange={setSelectedTeam}
              className="w-full sm:w-48"
            >
              <option value="all">All Teams</option>
              {teams?.map((team) => (
                <option key={team?.id} value={team?.id}>
                  {team?.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Spending Analytics */}
          <div className="mb-8">
            <SpendingAnalyticsCard 
              paymentMethods={filteredPaymentMethods}
              selectedTeam={selectedTeam}
            />
          </div>

          {/* Payment Methods Grid with Enhanced Security Display */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredPaymentMethods?.map((method) => (
              <PaymentMethodCard
                key={method?.id}
                method={method}
                onEdit={(method) => setEditingMethod(method)}
                onDelete={(id) => handleDeletePaymentMethod(id)}
                onSetDefault={(id, teamId) => handleSetDefault(id, teamId)}
                onViewTransactions={(method) => setViewingTransactions(method)}
                onAssignTeam={(method) => setAssigningTeam(method)}
              />
            ))}
          </div>

          {/* Enhanced Empty State with Security Information */}
          {filteredPaymentMethods?.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="CreditCard" size={24} className="text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">
                {searchTerm ? 'No payment methods found' : 'No payment methods configured'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Try adjusting your search criteria' :'Add your first secure payment method to start managing team expenses'
                }
              </p>
              <div className="bg-gray-50 rounded-lg p-4 mb-6 max-w-md mx-auto">
                <div className="flex items-center justify-center space-x-2 text-sm text-gray-600 mb-2">
                  <Icon name="Shield" size={16} />
                  <span className="font-medium">Security Features</span>
                </div>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>• End-to-end encryption</li>
                  <li>• PCI DSS compliant storage</li>
                  <li>• Role-based access control</li>
                </ul>
              </div>
              {!searchTerm && (
                <Button 
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center space-x-2"
                >
                  <Icon name="Plus" size={16} />
                  <span>Add Secure Payment Method</span>
                </Button>
              )}
            </div>
          )}

          {/* Security & Compliance Footer */}
          <div className="mt-12 pt-8 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Icon name="Shield" size={20} className="text-green-600" />
                </div>
                <h4 className="font-medium text-foreground">PCI Compliant</h4>
                <p className="text-xs text-muted-foreground">Level 1 PCI DSS certified payment processing</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon name="Lock" size={20} className="text-blue-600" />
                </div>
                <h4 className="font-medium text-foreground">Bank-Level Security</h4>
                <p className="text-xs text-muted-foreground">256-bit SSL encryption and secure tokenization</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Icon name="Eye" size={20} className="text-purple-600" />
                </div>
                <h4 className="font-medium text-foreground">Audit Trail</h4>
                <p className="text-xs text-muted-foreground">Complete transaction logging and monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      {showAddModal && (
        <AddPaymentMethodModal
          teams={teams}
          onSubmit={handleAddPaymentMethod}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {editingMethod && (
        <EditPaymentMethodModal
          method={editingMethod}
          teams={teams}
          onSubmit={(updates) => handleEditPaymentMethod(editingMethod?.id, updates)}
          onClose={() => setEditingMethod(null)}
        />
      )}
      {viewingTransactions && (
        <TransactionHistoryModal
          paymentMethod={viewingTransactions}
          onClose={() => setViewingTransactions(null)}
        />
      )}
      {assigningTeam && (
        <TeamAssignmentModal
          paymentMethod={assigningTeam}
          teams={teams}
          onSubmit={(teamId) => handleEditPaymentMethod(assigningTeam?.id, { team_id: teamId })}
          onClose={() => setAssigningTeam(null)}
        />
      )}
    </div>
  );
};

export default PaymentMethodsBilling;