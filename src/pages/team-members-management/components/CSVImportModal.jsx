import React, { useState, useRef } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const CSVImportModal = ({ onClose, onImport }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (e?.type === "dragenter" || e?.type === "dragover") {
      setDragActive(true);
    } else if (e?.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    setDragActive(false);
    
    const droppedFile = e?.dataTransfer?.files?.[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e?.target?.files?.[0];
    if (selectedFile) {
      handleFile(selectedFile);
    }
  };

  const handleFile = (selectedFile) => {
    setError('');
    
    if (!selectedFile?.name?.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    if (selectedFile?.size > 5 * 1024 * 1024) { // 5MB limit
      setError('File size must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = (csvFile) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e?.target?.result;
        const lines = text?.split('\n');
        
        if (lines?.length < 2) {
          setError('CSV file must contain at least a header and one data row');
          return;
        }

        const headers = lines?.[0]?.split(',')?.map(h => h?.trim());
        const requiredHeaders = ['name', 'email', 'role'];
        
        const missingHeaders = requiredHeaders?.filter(header => 
          !headers?.some(h => h?.toLowerCase()?.includes(header?.toLowerCase()))
        );

        if (missingHeaders?.length > 0) {
          setError(`Missing required columns: ${missingHeaders?.join(', ')}`);
          return;
        }

        // Parse first few rows for preview
        const previewRows = lines?.slice(1, 6)?.map(line => {
          const values = line?.split(',')?.map(v => v?.trim());
          return headers?.reduce((obj, header, index) => {
            obj[header] = values?.[index] || '';
            return obj;
          }, {});
        })?.filter(row => Object.values(row)?.some(val => val)); // Remove empty rows

        setPreviewData({
          headers,
          rows: previewRows,
          totalRows: lines?.length - 1
        });

      } catch (error) {
        setError('Failed to parse CSV file. Please check the format.');
      }
    };

    reader.onerror = () => {
      setError('Failed to read file');
    };

    reader?.readAsText(csvFile);
  };

  const handleImport = async () => {
    if (!previewData) return;

    setLoading(true);
    setError('');

    try {
      await onImport(previewData);
    } catch (error) {
      setError('Failed to import members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetFile = () => {
    setFile(null);
    setPreviewData(null);
    setError('');
    if (fileInputRef?.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Import Team Members</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            iconName="X"
            disabled={loading}
          />
        </div>

        <div className="p-6">
          {!file ? (
            <>
              {/* File Upload Area */}
              <div
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center transition-colors
                  ${dragActive 
                    ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
                  }
                `}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Icon name="Upload" size={48} className="text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-medium text-foreground mb-2">
                  Drop your CSV file here, or click to browse
                </h4>
                <p className="text-muted-foreground mb-4">
                  Upload a CSV file with team member information
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef?.current?.click()}
                  iconName="FolderOpen"
                  iconPosition="left"
                >
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* CSV Format Guide */}
              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium text-foreground mb-2">CSV Format Requirements</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Required columns: <strong>name, email, role</strong></p>
                  <p>• Optional columns: phone, allergies</p>
                  <p>• Role values: player, coach, admin</p>
                  <p>• Example: name,email,role,phone,allergies</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* File Info */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg mb-6">
                <div className="flex items-center space-x-3">
                  <Icon name="FileText" size={20} className="text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{file?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file?.size / 1024)?.toFixed(1)} KB • {previewData?.totalRows} rows
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFile}
                  iconName="X"
                  disabled={loading}
                />
              </div>

              {/* Preview */}
              {previewData && (
                <div className="mb-6">
                  <h4 className="font-medium text-foreground mb-3">Preview</h4>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            {previewData?.headers?.map((header, index) => (
                              <th key={index} className="px-4 py-2 text-left text-sm font-medium text-foreground">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {previewData?.rows?.map((row, index) => (
                            <tr key={index}>
                              {previewData?.headers?.map((header, colIndex) => (
                                <td key={colIndex} className="px-4 py-2 text-sm text-foreground">
                                  {row?.[header] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Showing first 5 rows • {previewData?.totalRows} total rows will be imported
                  </p>
                </div>
              )}
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2 mb-6">
              <Icon name="AlertCircle" size={16} className="text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-border">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            {file && (
              <Button
                onClick={handleImport}
                disabled={loading || !previewData}
                iconName={loading ? "Loader2" : "Upload"}
                iconPosition="left"
                className={loading ? "animate-spin" : ""}
              >
                {loading ? 'Importing...' : `Import ${previewData?.totalRows || 0} Members`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSVImportModal;