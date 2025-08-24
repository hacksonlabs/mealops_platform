import React, { useState, useRef } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';
import { toTitleCase, normalizePhoneNumber, normalizeBirthday, formatDateToMMDDYYYY } from '../../../utils/stringUtils';

const CSVImportModal = ({ onClose, onImport, existingMembers = [], currentUser = null }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewData, setPreviewData] = useState(null);
  const fileInputRef = useRef(null);

  const memberRolesOptions = [
    { value: 'player', label: 'Player' },
    { value: 'coach', label: 'Coach' },
    { value: 'staff', label: 'Staff' },
  ];
  const canonicalOrder = ['name', 'email', 'phoneNumber', 'role', 'allergies', 'birthday'];

  const prettyLabelFor = (k) => ({
        name: 'Name',
        email: 'Email',
        phoneNumber: 'Phone Number',
        role: 'Role',
        allergies: 'Allergies',
        birthday: 'Birthday',
      }[k] || toTitleCase(k));

  const handleClearError = () => {
    setError('');
  };

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
      }
    };
    reader.onerror = () => {
      setError('Failed to read file.');
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
      // strip BOM if present (Excel/Numbers export)
      let text = String(csvText || '').replace(/^\uFEFF/, '');
      const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');
      if (lines.length <= 1) {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
        setError('CSV file is empty or contains only headers.');
        setPreviewData(null);
        return;
      }

      // --- headers (skip empty header cells) ---
      const rawHeaders = splitCsvLine(lines[0]).map(h => h.trim());
      const headerMeta = rawHeaders
        .map((raw, idx) => ({ raw, canon: normalizeHeader(raw), idx }))
        .filter(h => h.raw.length > 0 && h.canon.length > 0);
      
      const headers = headerMeta.map(h => h.canon);

      // required
      const requiredKeys = ['name', 'email', 'phoneNumber'];
      const missing = requiredKeys.filter(k => !headers.includes(k));
      if (missing.length) {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
        const pretty = missing.map(prettyLabelFor).join(', ');
        setError(`CSV is missing required headers: ${pretty}.`);
        setPreviewData(null);
        return;
      }

       // unknown headers
      const allowedCanonicalKeys = new Set(canonicalOrder);
      const unknownOriginalHeaders = headerMeta
        .filter(h => !allowedCanonicalKeys.has(h.canon))
        .map(h => h.raw);
      if (unknownOriginalHeaders.length) {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
        const allowedPretty = canonicalOrder.map(prettyLabelFor).join(', ');
        setError(
          `Unrecognized header${unknownOriginalHeaders.length > 1 ? 's' : ''}: ` +
          `${unknownOriginalHeaders.join(', ')}. Allowed headers are: ${allowedPretty}.`
        );
        setPreviewData(null);
        return;
      }

      // existing team emails
      const existingEmailsLower = new Set(
        (existingMembers || [])
          .map(m => (m?.email || '').toString().toLowerCase())
          .filter(Boolean)
      );

      const parsedMembers = [];
      const csvEmailsSeen = new Set();
      const duplicateCsvEmails = new Set();
      const existingAlready = new Set();

      // --- rows ---
      lines.slice(1).forEach((line, rowIdx) => {
        const values = splitCsvLine(line);
        if (values.every(v => v === '')) return; // blank row

        // build member from kept headers, using original column index
        const member = {};
        headerMeta.forEach(({ canon, idx }) => {
          let value = values[idx] ?? '';
          switch (canon) {
            case 'name':        value = toTitleCase(value); break;
            case 'email':       value = String(value).toLowerCase(); break;
            case 'phoneNumber': value = normalizePhoneNumber(value); break;
            case 'birthday':    value = normalizeBirthday(value); break; // keep YYYY-MM-DD
            case 'allergies':   value = toTitleCase(value); break;
            default: break;
          }
          member[canon] = value;
        });

        // ensure all canonical fields exist
        canonicalOrder.forEach((k) => {
          if (member[k] == null) member[k] = k === 'role' ? 'player' : '';
        });
      
        // required per-row validation
        if (!member.name || !member.email || !member.phoneNumber) {
          console.warn(`Skipping row ${rowIdx + 2}: missing required data.`);
          return;
        }

        const emailLower = member.email.toLowerCase();
        // block if already on team (collect message; do not count as CSV duplicate)
        if (existingEmailsLower.has(emailLower)) {
          existingAlready.add(emailLower);
          return;
        }

        // de-dupe within CSV (only among not-already-on-team rows)
        if (csvEmailsSeen.has(emailLower)) {
          duplicateCsvEmails.add(emailLower);
          return;
        }
        csvEmailsSeen.add(emailLower);

        // normalize role
        const roleLower = String(member.role || '').toLowerCase();
        member.role = ['player', 'coach', 'staff'].includes(roleLower) ? roleLower : 'player';

        parsedMembers.push(member);
      });

      if (!parsedMembers.length) {
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
        setError('CSV file does not contain any valid member data rows.');
        setPreviewData(null);
        return;
      }

      if (currentUser?.email) {
        const idx = parsedMembers.findIndex(
          m => m.email?.toLowerCase() === currentUser.email.toLowerCase()
        );
        if (idx !== -1) parsedMembers[idx].role = 'coach';
      }

      // build payload for preview/editor
      const payload = {
        rows: parsedMembers,
        totalRows: parsedMembers.length,
        fullParsedData: parsedMembers,
      };

      setPreviewData(payload);

      // --- friendly messages (existing first, then CSV dupes) ---
      const msgs = [];

      if (existingAlready.size) {
        const list = [...existingAlready].join(', ');
        msgs.push(
          `${existingAlready.size === 1
            ? 'User with email'
            : 'Users with emails'} ${list} ${existingAlready.size === 1
            ? 'is'
            : 'are'} already part of your team — skipping ${existingAlready.size === 1 ? 'entry' : 'entries'}.`
        );
      }
      if (duplicateCsvEmails.size) {
        const list = [...duplicateCsvEmails].join(', ');
        msgs.push(
          `Ignored ${duplicateCsvEmails.size} duplicate entr${duplicateCsvEmails.size > 1 ? 'ies' : 'y'} with email: ${list}. Only the first occurrence was kept.`
        );
      }
      if (msgs.length) {
        setError(msgs.join('\n'));
      } else {
        setError('');
      }
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError('Failed to parse CSV file. Please check the format and try again.');
      setPreviewData(null);
    }
  };


  const handlePreviewEdit = (rowIndex, key, value) => {
  setPreviewData(prev => {
    if (!prev) return prev;
    const rows = [...prev.rows];
    const updated = { ...rows[rowIndex] };

    let v = value;
    switch (key) {
      case 'name':        v = toTitleCase(value); break;
      case 'email':       v = String(value).toLowerCase(); break;
      case 'phoneNumber': v = normalizePhoneNumber(value); break;
      case 'allergies':   v = toTitleCase(value); break;
      case 'birthday':
        // accept only ISO yyyy-mm-dd on change; avoid reformatting here
        v = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
        break;
      default: break;
    }
    updated[key] = v;

    if (key === 'role' && !['player','coach','staff'].includes(String(v).toLowerCase())) {
      updated.role = 'player';
    }

    rows[rowIndex] = updated;
    return { ...prev, rows, fullParsedData: rows, totalRows: rows.length };
  });
};

  const addPreviewRow = () => {
    setPreviewData(prev => {
      if (!prev) return prev;
      const rows = [
        ...prev.rows,
        { name: '', email: '', phoneNumber: '', role: 'player', allergies: '', birthday: '' },
      ];
      return { ...prev, rows, fullParsedData: rows, totalRows: rows.length };
    });
  };

  const removePreviewRow = (index) => {
    setPreviewData(prev => {
      if (!prev) return prev;
      const rows = prev.rows.filter((_, i) => i !== index);
      return { ...prev, rows, fullParsedData: rows, totalRows: rows.length };
    });
  };

  const handleImport = async () => {
    if (!previewData || !previewData.fullParsedData) return;
    setLoading(true);
    setError('');
    try {
      await onImport(previewData.fullParsedData);
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
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                      <Icon name="ClipboardList" size={20} className="mr-2" /> Team Roster
                    </h2>
                    <div className="flex space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addPreviewRow}
                      >
                        <Icon name="Plus" size={16} className="mr-2" /> Add Member
                      </Button>
                    </div>
                  </div>

                  {previewData.rows.length > 0 && (
                    <div className="">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th scope="col" className="w-1/4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th scope="col" className="w-1/5 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone #</th>
                            <th scope="col" className="w-1/6 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th scope="col" className="px-3 py-2 pr-5 text-left text-xs font-medium text-gray-500 tracking-wider italic">allergies</th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 tracking-wider italic">birthday</th>
                            <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {previewData.rows.map((member, index) => (
                            <tr key={index}>
                              <td className="px-2 py-2 whitespace-nowrap">
                                <Input
                                  type="text"
                                  value={member.name}
                                  onChange={(e) => handlePreviewEdit(index, 'name', e.target.value)}
                                  placeholder=" Name"
                                  className="!border-none !ring-0 !shadow-none !p-0"
                                />
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                <Input
                                  type="email"
                                  value={member.email}
                                  onChange={(e) => handlePreviewEdit(index, 'email', e.target.value)}
                                  placeholder=" Email"
                                  className="!border-none !ring-0 !shadow-none !p-0"
                                />
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                <Input
                                  type="tel"
                                  value={member.phoneNumber}
                                  onChange={(e) => handlePreviewEdit(index, 'phoneNumber', e.target.value)}
                                  placeholder=" (xxx) xxx-xxxx"
                                  className="!border-none !ring-0 !shadow-none !p-0"
                                />
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                <Select
                                  value={member.role}
                                  options={memberRolesOptions}
                                  onChange={(value) => handlePreviewEdit(index, 'role', value)}
                                  className="!border-none !ring-0 !shadow-none !p-0"
                                />
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                <Input
                                  type="text"
                                  value={member.allergies}
                                  onChange={(e) => handlePreviewEdit(index, 'allergies', e.target.value)}
                                  placeholder=" Optional.."
                                  className="!border-none !ring-0 !shadow-none !p-0 italic"
                                />
                              </td>
                              <td className="px-2 py-2 whitespace-nowrap">
                                <Input
                                  type="date"
                                  value={member.birthday || ''}
                                  onChange={(e) => handlePreviewEdit(index, 'birthday', e.target.value)}
                                  className="!border-none !ring-0 !shadow-none !p-0"
                                />
                              </td>
                              <td className="px-0.5 py-0.5 whitespace-nowrap text-right text-sm font-medium">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removePreviewRow(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Icon name="Trash" size={16} />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground mt-2">
                    {previewData.rows.length} member{previewData.rows.length === 1 ? '' : 's'} will be imported.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md relative pr-20">
              <p className="text-red-800 flex items-center text-sm whitespace-pre-line">
                <Icon name="XCircle" size={20} className="mr-2" /> {error}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearError}
                className="absolute top-1 right-1 text-red-600 hover:text-red-700 p-1"
              >
                <Icon name="X" size={16} />
              </Button>
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
                {loading ? 'Importing...' : `Import ${(previewData?.rows?.length ?? 0)} Member${(previewData?.rows?.length ?? 0) === 1 ? '' : 's'}`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSVImportModal;