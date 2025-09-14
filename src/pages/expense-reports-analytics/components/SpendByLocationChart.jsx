import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Button from '../../../components/ui/custom/Button';

const SpendByLocationChart = ({ locationData, teamMemberData, onDrillDown }) => {
  const [viewMode, setViewMode] = useState('location'); // 'location' or 'team'

  const currentData = viewMode === 'location' ? locationData : teamMemberData;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0];
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-athletic-lg">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground">
            Total Spend: <span className="font-medium text-foreground">${data?.value?.toLocaleString()}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Orders: <span className="font-medium text-foreground">{data?.payload?.orders}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Avg per Order: <span className="font-medium text-foreground">
              ${(data?.value / data?.payload?.orders)?.toFixed(2)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">
          Spend by {viewMode === 'location' ? 'Location' : 'Team Member'}
        </h3>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'location' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('location')}
          >
            Location
          </Button>
          <Button
            variant={viewMode === 'team' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('team')}
          >
            Team Members
          </Button>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={currentData}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis 
              dataKey="name" 
              stroke="var(--color-muted-foreground)"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="var(--color-muted-foreground)"
              fontSize={12}
              tickFormatter={(value) => `$${value?.toLocaleString()}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              fill="var(--color-primary)"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={onDrillDown}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SpendByLocationChart;