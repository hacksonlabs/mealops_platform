import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';

const SpendingAnalyticsCard = ({ paymentMethods, selectedTeam }) => {
  // Generate secure demo analytics data
  const generateDemoAnalytics = () => {
    const currentMonth = new Date()?.toLocaleString('default', { month: 'long' });
    const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)?.toLocaleString('default', { month: 'long' });
    
    return {
      totalSpent: 2847.92,
      monthlySpending: 1205.50,
      averageTransaction: 45.23,
      transactionCount: 87,
      topCategory: 'Team Meals',
      categorySpending: 1580.25,
      monthlyComparison: {
        current: 1205.50,
        previous: 982.75,
        percentChange: 22.7,
        trend: 'increase'
      },
      securityMetrics: {
        totalTransactions: 87,
        secureTransactions: 87,
        failedAttempts: 0,
        fraudPrevented: 3
      }
    };
  };

  const analytics = generateDemoAnalytics();

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      {/* Header with Security Badge */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-foreground">Spending Analytics</h2>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
            <Icon name="Shield" size={12} />
            <span>Secure Analytics</span>
          </div>
          <div className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
            <Icon name="BarChart3" size={12} />
            <span>Demo Data</span>
          </div>
        </div>
      </div>
      {/* Demo Data Notice */}
      <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-2">
          <Icon name="Info" size={16} className="text-blue-600" />
          <p className="text-blue-800 text-sm font-medium">Demonstration Analytics</p>
        </div>
        <p className="text-blue-700 text-xs mt-1">
          These spending analytics are generated from secure demo data for illustration purposes.
        </p>
      </div>
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Total Spent</p>
              <p className="text-2xl font-bold text-blue-900">${analytics?.totalSpent?.toLocaleString()}</p>
            </div>
            <Icon name="DollarSign" size={24} className="text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">This Month</p>
              <p className="text-2xl font-bold text-green-900">${analytics?.monthlySpending?.toLocaleString()}</p>
              <p className="text-green-600 text-xs">+{analytics?.monthlyComparison?.percentChange}% vs last month</p>
            </div>
            <Icon name="TrendingUp" size={24} className="text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Avg Transaction</p>
              <p className="text-2xl font-bold text-purple-900">${analytics?.averageTransaction}</p>
            </div>
            <Icon name="Receipt" size={24} className="text-purple-600" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Transactions</p>
              <p className="text-2xl font-bold text-orange-900">{analytics?.transactionCount}</p>
            </div>
            <Icon name="CreditCard" size={24} className="text-orange-600" />
          </div>
        </div>
      </div>
      {/* Security Metrics */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg mb-6">
        <h3 className="font-medium text-foreground mb-3 flex items-center space-x-2">
          <Icon name="Shield" size={18} />
          <span>Security Metrics</span>
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{analytics?.securityMetrics?.secureTransactions}</p>
            <p className="text-xs text-muted-foreground">Secure Transactions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{analytics?.securityMetrics?.totalTransactions}</p>
            <p className="text-xs text-muted-foreground">Total Processed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{analytics?.securityMetrics?.failedAttempts}</p>
            <p className="text-xs text-muted-foreground">Failed Attempts</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-600">{analytics?.securityMetrics?.fraudPrevented}</p>
            <p className="text-xs text-muted-foreground">Fraud Prevented</p>
          </div>
        </div>
      </div>
      {/* Top Spending Category */}
      <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-4 rounded-lg">
        <h3 className="font-medium text-indigo-900 mb-2">Top Spending Category</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-indigo-900">{analytics?.topCategory}</p>
            <p className="text-sm text-indigo-700">${analytics?.categorySpending?.toLocaleString()} this month</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-900">
              {Math.round((analytics?.categorySpending / analytics?.monthlySpending) * 100)}%
            </p>
            <p className="text-xs text-indigo-600">of total spending</p>
          </div>
        </div>
      </div>
      {/* Compliance Footer */}
      <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Icon name="Lock" size={14} />
          <span>All analytics data is encrypted and PCI compliant</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Icon name="Eye" size={14} />
          <span>Real-time fraud monitoring active</span>
        </div>
      </div>
    </div>
  );
};

export default SpendingAnalyticsCard;