import React from 'react';
import Button from '../../../components/ui/custom/Button';
import Icon from '../../../components/AppIcon';

const BulkActionsBar = ({ selectedCount, onBulkAction, onClearSelection }) => {
  return (
    <div className="bg-primary text-primary-foreground rounded-lg p-4 mb-6 shadow-athletic">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Icon name="Users" size={20} />
          <span className="font-medium">
            {selectedCount} member{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onBulkAction('export')}
            iconName="Download"
            iconPosition="left"
            className="w-full sm:w-auto"
          >
            Export
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onBulkAction('delete')}
            iconName="Trash2"
            iconPosition="left"
            className="w-full sm:w-auto"
          >
            Delete
          </Button>
          <div className="hidden sm:block h-4 w-px bg-primary-foreground/20 mx-2" />
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            iconName="X"
            className="w-full sm:w-auto text-primary-foreground hover:text-primary-foreground"
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BulkActionsBar;
