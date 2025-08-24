import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import { formatDateToMMDDYYYY } from '../../../utils/stringUtils'
import { ROLE_CONFIG } from '../../../utils/addingTeamMembersUtils';

const MembersTable = ({ 
  members, 
  selectedMembers, 
  onMemberSelect, 
  onSelectAll, 
  onEditMember,
  onRemoveMember,
  onViewDetails,
  loading 
}) => {
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return 'ArrowUpDown';
    return sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown';
  };

  const getRoleBadge = (role) => {
    const config = ROLE_CONFIG?.[role] || ROLE_CONFIG?.player;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.bg} ${config?.text}`}>
        {config?.label}
      </span>
    );
  };

  const getStatusBadge = (isActive) => {
    if (isActive) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5"></div>
          Active
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <div className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5"></div>
          Inactive
        </span>
      );
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isAllSelected = members?.length > 0 && selectedMembers?.length === members?.length;
  const isIndeterminate = selectedMembers?.length > 0 && selectedMembers?.length < members?.length;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-athletic p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-2">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={(e) => onSelectAll(e?.target?.checked)}
                />
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Name & Contact</span>
                  <Icon name={getSortIcon('name')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('role')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Role</span>
                  <Icon name={getSortIcon('role')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-sm font-medium text-foreground">Allergies</span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-sm font-medium text-foreground">Birthday</span>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Status</span>
                  <Icon name={getSortIcon('status')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-right">
                <span className="text-sm font-medium text-foreground">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members?.map((member) => (
              <tr key={member?.id} className="hover:bg-muted/50 transition-athletic">
                <td className="px-4 py-4">
                  <Checkbox
                    checked={selectedMembers?.includes(member?.id)}
                    onChange={(e) => onMemberSelect(member?.id, e?.target?.checked)}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Icon name="User" size={18} className="text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {member?.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member?.email}
                      </div>
                      {member?.phone_number && (
                        <div className="text-xs text-muted-foreground">
                          {member?.phone_number}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {getRoleBadge(member?.role)}
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm text-foreground">
                    {member?.allergies ? (
                      <div className="max-w-xs">
                        <p className="text-foreground line-clamp-2">{member?.allergies}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm text-foreground">
                    {member?.birthday ? (
                      <div className="max-w-xs">
                        <p className="text-foreground line-clamp-2">{formatDateToMMDDYYYY(member.birthday)}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4">
                  {getStatusBadge(member?.is_active)}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(member)}
                      iconName="Eye"
                      title="View Details"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditMember(member)}
                      iconName="Edit"
                      title="Edit Member"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveMember(member)}
                      iconName="Trash2"
                      title="Remove Member"
                      className="text-red-600 hover:text-red-700"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Empty State */}
      {members?.length === 0 && (
        <div className="text-center py-12">
          <Icon name="Users" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No team members found</h3>
          <p className="text-muted-foreground mb-4">
            Get started by adding your first team member.
          </p>
          {/* <Button
            onClick={() => {}} // This would trigger add member modal
            iconName="Plus"
            iconPosition="left"
          >
            Add First Member
          </Button> */}
        </div>
      )}
    </div>
  );
};

export default MembersTable;