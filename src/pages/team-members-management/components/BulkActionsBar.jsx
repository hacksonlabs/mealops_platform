import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const BulkActionsBar = ({ selectedCount, onBulkAction, onClearSelection }) => {
  return (
    <div className="bg-primary text-primary-foreground rounded-lg p-4 mb-6 shadow-athletic">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Icon name="Users" size={20} />
            <span className="font-medium">
              {selectedCount} member{selectedCount !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onBulkAction('activate')}
            iconName="UserCheck"
            iconPosition="left"
          >
            Activate
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onBulkAction('deactivate')}
            iconName="UserX"
            iconPosition="left"
          >
            Deactivate
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onBulkAction('export')}
            iconName="Download"
            iconPosition="left"
          >
            Export
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onBulkAction('delete')}
            iconName="Trash2"
            iconPosition="left"
          >
            Delete
          </Button>
          <div className="h-4 w-px bg-primary-foreground/20 mx-2" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            iconName="X"
            className="text-primary-foreground hover:text-primary-foreground"
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsBar;