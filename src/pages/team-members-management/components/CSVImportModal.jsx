import React, { useState, useRef } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { toTitleCase, normalizePhoneNumber, normalizeBirthday, formatDateToMMDDYYYY } from '../../../utils/stringUtils';

const CSVImportModal = ({ onClose, onImport, existingMembers = [], currentUser = null }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = useRef(null);
  const [parsedMembersData, setParsedMembersData] = useState(null);

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
    setParsedMembersData(null);
    setPreviewData(null);
    
    if (!selectedFile?.name?.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    // if (selectedFile?.size > 5 * 1024 * 1024) { // 5MB limit
    //   setError('File size must be less than 5MB');
    //   return;
    // }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        parseCsvText(csvText);
      } catch (err) {
        console.error("Error reading or initiating CSV parsing:", err);
        setError('Failed to read or parse CSV file. Please check the format.');
        setParsedMembersData(null);
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
      setParsedMembersData(null);
    };
    reader.readAsText(selectedFile);
  };



    const splitCsvLine = (line) => {
      const out = [];
      let cur = '', inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          out.push(cur.trim()); cur = '';
        } else cur += ch;
      }
      out.push(cur.trim());
      return out;
    };

  const headerMap = {
    'name': 'name',
    'Name': 'name',
    'email': 'email',
    'Email': 'email',
    'Phone Number': 'phoneNumber',
    'phone #': 'phoneNumber',
    'Phone #': 'phoneNumber',
    'phone number': 'phoneNumber',
    'phone_number': 'phoneNumber',
    'phone': 'phoneNumber',
    'role': 'role',
    'Role': 'role',
    'allergies': 'allergies',
    'Allergies': 'allergies',
    'birthday': 'birthday',
    'Birthday': 'birthday',
    'bday': 'birthday',
    'Bday': 'birthday',
  };
  
  const normalizeHeader = (h) => headerMap[h.toLowerCase()] || h.toLowerCase();

  const parseCsvText = (csvText) => {
    try {
      const lines = csvText.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');
      if (lines.length <= 1) {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
        setError('CSV file is empty or contains only headers.');
        setParsedMembersData(null);
        setPreviewData(null);
        return;
      }

      const prettyLabelFor = (k) => ({
        name: 'Name',
        email: 'Email',
        phoneNumber: 'Phone Number',
        role: 'Role',
        allergies: 'Allergies',
        birthday: 'Birthday',
      }[k] || toTitleCase(k)); // fallback for unknown columns

      const rawHeaders = splitCsvLine(lines[0]).map(h => h.trim());      
      const headers = rawHeaders.map(normalizeHeader);

      const headerDefs = [];
      const seen = new Set();
      headers.forEach((k) => {
        if (!seen.has(k)) {
          seen.add(k);
          headerDefs.push({ key: k, label: prettyLabelFor(k) });
        }
      });

      const requiredKeys = ['name', 'email', 'phoneNumber'];
      const missing = requiredKeys.filter(k => !headers.includes(k));
      if (missing.length) {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
        const pretty = missing
          .map(k => (k === 'phoneNumber' ? 'Phone Number' : k[0].toUpperCase() + k.slice(1)))
          .join(', ');
        setError(`CSV is missing required headers: ${pretty}.`);
        setParsedMembersData(null);
        setPreviewData(null);
        return;
      }
      const allowedCanonicalKeys = new Set(['name', 'email', 'phoneNumber', 'role', 'allergies', 'birthday']);
      const unknownOriginalHeaders = rawHeaders.filter(h => {
        const canon = normalizeHeader(h);
        return !allowedCanonicalKeys.has(canon);
      });
      if (unknownOriginalHeaders.length) {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
        const allowedPretty = Array.from(allowedCanonicalKeys).map(prettyLabelFor).join(', ');
        setError(
          `Unrecognized header${unknownOriginalHeaders.length > 1 ? 's' : ''}: ` +
          `${unknownOriginalHeaders.join(', ')}. ` +
          `Allowed headers are: ${allowedPretty}.`
        );
        setParsedMembersData(null);
        setPreviewData(null);
        return;
      }

      const existingEmailsLower = new Set(
        (existingMembers || [])
          .map(m => (m?.email || '').toString().toLowerCase())
          .filter(Boolean)
      );

      const parsedMembers = [];
      const csvEmailsSeen = new Set();

      lines.slice(1).forEach((line, rowIdx) => {
        const values = splitCsvLine(line);
        if (values.every(v => v === '')) return; // blank row

        const member = {};
        headers.forEach((key, i) => {
          let value = values[i] ?? '';
          switch (key) {
            case 'name':        value = toTitleCase(value); break;
            case 'email':       value = String(value).toLowerCase(); break;
            case 'phoneNumber': value = normalizePhoneNumber(value); break;
            case 'birthday':    value = normalizeBirthday(value); break;
            case 'allergies':   value = toTitleCase(value); break;
            default: break;
          }
          member[key] = value;
        });

        if (!member.name || !member.email || !member.phoneNumber) {
          console.warn(`Skipping row ${rowIdx + 2}: missing required data.`);
          return;
        }

        if (csvEmailsSeen.has(member.email.toLowerCase())) {
          console.warn(`Skipping row ${rowIdx + 2}: Duplicate email "${member.email}" found within the CSV file. Only the first instance will be processed.`);
          return; // Skip this duplicate entry
        }
        csvEmailsSeen.add(member.email.toLowerCase());


        const roleLower = String(member.role || '').toLowerCase();
        member.role = ['player', 'coach', 'staff'].includes(roleLower) ? roleLower : 'player';

        parsedMembers.push(member);
      });

      if (!parsedMembers.length) {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
        setError('CSV file does not contain any valid member data rows.');
        setParsedMembersData(null);
        setPreviewData(null);
        return;
      }

      if (currentUser?.email) {
        const idx = parsedMembers.findIndex(
          m => m.email?.toLowerCase() === currentUser.email.toLowerCase()
        );
        if (idx !== -1) parsedMembers[idx].role = 'coach';
      }

      const uniqueNewMembers = parsedMembers.filter(
        m => !existingEmailsLower.has(m.email.toLowerCase())
      );

      if (!uniqueNewMembers.length) {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
        setError('No new unique members found in the CSV file.');
        setParsedMembersData(null);
        setPreviewData(null);
        return;
      }

      const previewRows = uniqueNewMembers.slice(0, 5).map(member => {
      const row = {};
      headerDefs.forEach(({ key, label }) => {
        let value = member[key] ?? '';
        if (key === 'birthday') {
          value = formatDateToMMDDYYYY(value);
        }
        row[label] = value;
      });
      return row;
    });

      const payload = {
        headers: headerDefs.map(h => h.label), 
        rows: previewRows,
        totalRows: uniqueNewMembers.length,
        fullParsedData: uniqueNewMembers,
      };

      setParsedMembersData(payload);
      setPreviewData(payload);
      setError('');
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Failed to parse CSV file. Please check the format and try again.');
      setParsedMembersData(null);
      setPreviewData(null);
    }
  };



  const handleImport = async () => {
    if (!parsedMembersData || !parsedMembersData.fullParsedData) return;

    setLoading(true);
    setError('');

    try {
      await onImport(parsedMembersData.fullParsedData);
      onClose();
    } catch (importError) {
      setError(`Failed to import members: ${importError.message || 'Please try again.'}`);
      console.error('Final import failed:', importError);
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
      <div className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
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
                  <p>• Required columns: <strong>name, email, phone number</strong></p>
                  <p>• Optional columns: role, allergies, birthday</p>
                  <p>• Role values: player, coach, staff</p>
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
                    {previewData?.totalRows} members will be imported.
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