import React, { useState, useEffect } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const TransactionHistoryModal = ({ paymentMethod, onClose }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [amountFilter, setAmountFilter] = useState('all');

  // Mock transaction data since this would typically come from a payment processor
  const mockTransactions = [
    {
      id: '1',
      date: '2025-08-07',
      amount: 156.75,
      merchant: "Tony\'s Pizza Palace",
      team_member: 'Alex Smith',
      status: 'completed',
      receipt_url: '#',
      category: 'Meals'
    },
    {
      id: '2',
      date: '2025-08-05',
      amount: 89.50,
      merchant: 'Subway Downtown',
      team_member: 'Jordan Davis',
      status: 'completed',
      receipt_url: '#',
      category: 'Meals'
    },
    {
      id: '3',
      date: '2025-08-03',
      amount: 234.25,
      merchant: 'Catering Express',
      team_member: 'Coach Johnson',
      status: 'completed',
      receipt_url: '#',
      category: 'Team Events'
    },
    {
      id: '4',
      date: '2025-08-01',
      amount: 67.80,
      merchant: 'QuickBites',
      team_member: 'Sam Wilson',
      status: 'completed',
      receipt_url: '#',
      category: 'Meals'
    }
  ];

  useEffect(() => {
    // Simulate loading transaction data
    const timer = setTimeout(() => {
      setTransactions(mockTransactions);
      setLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const filteredTransactions = transactions?.filter(transaction => {
    const matchesSearch = 
      transaction?.merchant?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      transaction?.team_member?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      transaction?.category?.toLowerCase()?.includes(searchTerm?.toLowerCase());

    const matchesDate = dateFilter === 'all' || (() => {
      const transactionDate = new Date(transaction?.date);
      const now = new Date();
      switch (dateFilter) {
        case 'week':
          return transactionDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case 'month':
          return transactionDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case 'quarter':
          return transactionDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        default:
          return true;
      }
    })();

    const matchesAmount = amountFilter === 'all' || (() => {
      const amount = transaction?.amount;
      switch (amountFilter) {
        case 'under50':
          return amount < 50;
        case '50to100':
          return amount >= 50 && amount <= 100;
        case 'over100':
          return amount > 100;
        default:
          return true;
      }
    })();

    return matchesSearch && matchesDate && matchesAmount;
  }) || [];

  const totalAmount = filteredTransactions?.reduce((sum, t) => sum + (t?.amount || 0), 0) || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Transaction History</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {paymentMethod?.card_name} (•••• {paymentMethod?.last_four})
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-md transition-colors"
            >
              <Icon name="X" size={20} />
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e?.target?.value || '')}
              leftIcon="Search"
            />
            <Select
              value={dateFilter}
              onValueChange={setDateFilter}
            >
              <option value="all">All Time</option>
              <option value="week">Past Week</option>
              <option value="month">Past Month</option>
              <option value="quarter">Past Quarter</option>
            </Select>
            <Select
              value={amountFilter}
              onValueChange={setAmountFilter}
            >
              <option value="all">All Amounts</option>
              <option value="under50">Under $50</option>
              <option value="50to100">$50 - $100</option>
              <option value="over100">Over $100</option>
            </Select>
          </div>

          {/* Summary Stats */}
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-lg font-semibold text-foreground">
                  {filteredTransactions?.length || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-lg font-semibold text-foreground">
                  ${totalAmount?.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average</p>
                <p className="text-lg font-semibold text-foreground">
                  ${filteredTransactions?.length ? (totalAmount / filteredTransactions?.length)?.toFixed(2) : '0.00'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="flex items-center space-x-2">
                  <Icon name="CheckCircle" size={16} className="text-green-500" />
                  <span className="text-sm text-green-700">All Successful</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transaction Table */}
          <div className="border border-border rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading transactions...</p>
              </div>
            ) : filteredTransactions?.length === 0 ? (
              <div className="p-8 text-center">
                <Icon name="Receipt" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium text-foreground mb-2">No transactions found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || dateFilter !== 'all' || amountFilter !== 'all' ?'Try adjusting your filters' :'No transactions have been made with this payment method yet'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-foreground">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-foreground">Merchant</th>
                      <th className="text-left p-4 text-sm font-medium text-foreground">Team Member</th>
                      <th className="text-left p-4 text-sm font-medium text-foreground">Category</th>
                      <th className="text-right p-4 text-sm font-medium text-foreground">Amount</th>
                      <th className="text-center p-4 text-sm font-medium text-foreground">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions?.map((transaction, index) => (
                      <tr key={transaction?.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/25'}>
                        <td className="p-4 text-sm text-foreground">
                          {new Date(transaction?.date)?.toLocaleDateString()}
                        </td>
                        <td className="p-4 text-sm text-foreground font-medium">
                          {transaction?.merchant}
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {transaction?.team_member}
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {transaction?.category}
                          </span>
                        </td>
                        <td className="p-4 text-sm font-semibold text-foreground text-right">
                          ${transaction?.amount?.toFixed(2)}
                        </td>
                        <td className="p-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(transaction?.receipt_url, '_blank')}
                            className="text-primary hover:bg-primary/10"
                          >
                            <Icon name="ExternalLink" size={14} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Export Actions */}
          <div className="flex justify-between items-center mt-6">
            <div className="text-sm text-muted-foreground">
              Showing {filteredTransactions?.length} of {transactions?.length} transactions
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                <Icon name="Download" size={14} className="mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm">
                <Icon name="FileText" size={14} className="mr-2" />
                Generate Report
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistoryModal;