import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';

const ExpenseTable = ({ 
  expenses, 
  onSort, 
  onSearch, 
  onBulkSelect, 
  selectedItems,
  onReceiptDownload 
}) => {
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const handleSort = (field) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    onSort(field, newDirection);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    onSearch(value);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      onBulkSelect(expenses?.map(expense => expense?.id));
    } else {
      onBulkSelect([]);
    }
  };

  const handleSelectItem = (id, checked) => {
    if (checked) {
      onBulkSelect([...selectedItems, id]);
    } else {
      onBulkSelect(selectedItems?.filter(item => item !== id));
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return 'ArrowUpDown';
    return sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown';
  };

  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isAllSelected = expenses?.length > 0 && selectedItems?.length === expenses?.length;
  const isPartiallySelected = selectedItems?.length > 0 && selectedItems?.length < expenses?.length;

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Expense Details</h3>
          {selectedItems?.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReceiptDownload(selectedItems)}
              iconName="Download"
              iconPosition="left"
            >
              Download Receipts ({selectedItems?.length})
            </Button>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => handleSearch(e?.target?.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            {expenses?.length} total expenses
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="w-12 p-4">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isPartiallySelected}
                  onChange={(e) => handleSelectAll(e?.target?.checked)}
                />
              </th>
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('date')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Date</span>
                  <Icon name={getSortIcon('date')} size={14} />
                </button>
              </th>
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('vendor')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Vendor</span>
                  <Icon name={getSortIcon('vendor')} size={14} />
                </button>
              </th>
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('amount')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Amount</span>
                  <Icon name={getSortIcon('amount')} size={14} />
                </button>
              </th>
              <th className="text-left p-4">
                <button
                  onClick={() => handleSort('attendees')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Attendees</span>
                  <Icon name={getSortIcon('attendees')} size={14} />
                </button>
              </th>
              <th className="text-left p-4">Location</th>
              <th className="text-left p-4">Receipt</th>
            </tr>
          </thead>
          <tbody>
            {expenses?.map((expense, index) => (
              <tr 
                key={expense?.id} 
                className={`border-b border-border hover:bg-muted/50 transition-athletic ${
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                }`}
              >
                <td className="p-4">
                  <Checkbox
                    checked={selectedItems?.includes(expense?.id)}
                    onChange={(e) => handleSelectItem(expense?.id, e?.target?.checked)}
                  />
                </td>
                <td className="p-4">
                  <div className="text-sm font-medium text-foreground">
                    {formatDate(expense?.date)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {expense?.time}
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <Icon name="Store" size={16} className="text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {expense?.vendor}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {expense?.orderType}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm font-semibold text-foreground">
                    ${expense?.amount?.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ${(expense?.amount / expense?.attendees)?.toFixed(2)} per person
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm text-foreground">
                    {expense?.attendees} people
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-sm text-foreground">
                    {expense?.location}
                  </div>
                </td>
                <td className="p-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReceiptDownload([expense?.id])}
                    iconName="FileText"
                    iconPosition="left"
                  >
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {expenses?.length === 0 && (
        <div className="p-12 text-center">
          <Icon name="Receipt" size={48} className="text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">No expenses found</p>
          <p className="text-muted-foreground">
            Try adjusting your filters or search criteria
          </p>
        </div>
      )}
    </div>
  );
};

export default ExpenseTable;