// src/components/ui//custom/Select.jsx
import React, { useState, useRef, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { cn } from "../../../utils/cn";
import Button from "./Button";
import Input from "./Input";
import { Checkbox } from "./Checkbox";

const Select = React.forwardRef(({
  className,
  options = [],
  value,
  defaultValue,
  placeholder = "Select an option",
  multiple = false,
  disabled = false,
  required = false,
  label,
  description,
  error,
  searchable = false,
  clearable = false,
  loading = false,
  id,
  name,
  onChange,
  onOpenChange,
  selectedNoun = "items",
  menuPortalTarget,
  menuPosition = "fixed", // "absolute" | "fixed"
  groupBy,
  groupConfig = {},
  ...props
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const dropdownRef = useRef(null);     // container for outside-click (trigger area)
  const searchInputRef = useRef(null);  // focus search when opened
  const buttonRef = useRef(null);       // NEW: measure trigger for fixed menu
  const menuRef = useRef(null);         // NEW: outside-click when menu is portaled
  const [menuRect, setMenuRect] = useState(null);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  // Generate unique ID if not provided
  const selectId = id || `select-${Math.random()?.toString(36)?.substr(2, 9)}`;

  const normalizedValue = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : [];
    }
    return Array.isArray(value) ? (value.length > 0 ? value[0] : null) : value;
  }, [value, multiple]);

  // Close on outside click (consider both trigger area and the portaled menu)
  useEffect(() => {
    const handleClickOutside = (event) => {
      const inTrigger = dropdownRef.current?.contains(event.target);
      const inMenu = menuRef.current?.contains(event.target);
      if (inTrigger || inMenu) return; // don't close if clicking inside either
      setIsOpen(false);
      setSearchTerm("");
      onOpenChange?.(false);
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, [onOpenChange]);

  // Close on Escape; resize/scroll behavior depends on menuPosition
useEffect(() => {
  if (!isOpen) return;

  const onKey = (e) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchTerm("");
      onOpenChange?.(false);
    }
  };

  // For fixed/portaled menus: reposition on resize/scroll instead of closing
  const onResize = () => {
    if (menuPosition === "fixed") {
      updateMenuRect();
    } else {
      setIsOpen(false);
      onOpenChange?.(false);
    }
  };

  const onScroll = () => {
    if (menuPosition === "fixed") {
      // keep open, just follow the trigger
      updateMenuRect();
    } else {
      setIsOpen(false);
      onOpenChange?.(false);
    }
  };

  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", onResize, true);
  window.addEventListener("scroll", onScroll, true);

  return () => {
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize, true);
    window.removeEventListener("scroll", onScroll, true);
  };
}, [isOpen, onOpenChange, menuPosition]);


  // Autofocus search box on open
  useEffect(() => {
    if (isOpen && searchable) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // measure trigger rect for fixed-position menu
  const updateMenuRect = () => {
    if (!buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setMenuRect({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!isOpen || menuPosition !== "fixed") return;
    updateMenuRect();
    const onWin = () => updateMenuRect();
    window.addEventListener("resize", onWin, true);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin, true);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [isOpen, menuPosition]);

  // Filter options (label, value, description, optional .search blob)
  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) return options;
    const tokens = searchTerm.trim().toLowerCase().split(/\s+/);
    return options?.filter((option) => {
      const hay = [
        option?.label,
        option?.value,
        option?.search,
        option?.description,
      ]
        .filter(Boolean)
        .map(String)
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [options, searchable, searchTerm]);

  const {
    order: groupOrder,
    fallbackLabel: groupFallbackLabel = 'Other',
    columnMinWidth: groupColumnMinWidth = 180,
    maxColumns: groupMaxColumns = 4,
    headerFormatter: groupHeaderFormatter,
  } = groupConfig || {};

  const groupAccessor = useMemo(() => {
    if (!groupBy) return null;
    if (typeof groupBy === 'function') return groupBy;
    if (typeof groupBy === 'string') {
      return (option) => option?.[groupBy];
    }
    return null;
  }, [groupBy]);

  const resolveOrderIndex = useMemo(() => {
    if (!Array.isArray(groupOrder) || groupOrder.length === 0) return null;
    const lookup = new Map(groupOrder.map((label, idx) => [String(label).toLowerCase(), idx]));
    return (label) => {
      const key = String(label || '').toLowerCase();
      return lookup.has(key) ? lookup.get(key) : -1;
    };
  }, [groupOrder]);

  const groupLayout = useMemo(() => {
    if (!groupAccessor) return null;
    if (!filteredOptions?.length) return null;

    const groups = new Map();

    filteredOptions.forEach((option) => {
      const raw = groupAccessor(option);
      let label;
      let sortHint = null;

      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        label = raw.label ?? raw.value ?? raw.key;
        if (raw.sortKey != null) sortHint = Number(raw.sortKey);
      } else {
        label = raw;
      }

      const resolvedLabel = String(label || '').trim() || groupFallbackLabel;
      if (!groups.has(resolvedLabel)) {
        groups.set(resolvedLabel, { label: resolvedLabel, options: [], sortHint: sortHint });
      }
      const entry = groups.get(resolvedLabel);
      entry.options.push(option);
      if (sortHint != null && (entry.sortHint == null || sortHint < entry.sortHint)) {
        entry.sortHint = sortHint;
      }
    });

    if (!groups.size) return null;

    const defaultWeight = (label) => {
      const lower = String(label || '').toLowerCase();
      if (lower.includes('player')) return 0;
      if (lower.includes('coach')) return 1;
      if (lower.includes('staff')) return 2;
      if (lower.includes('extra')) return 90;
      if (lower.includes('other')) return 99;
      return 50;
    };

    const entries = Array.from(groups.values()).map((entry) => {
      const sortedOptions = entry.options.slice().sort((a, b) => {
        const aLabel = String(a?.label || '').toLowerCase();
        const bLabel = String(b?.label || '').toLowerCase();
        return aLabel.localeCompare(bLabel);
      });
      return { ...entry, options: sortedOptions };
    });

    entries.sort((a, b) => {
      const orderA = resolveOrderIndex ? resolveOrderIndex(a.label) : -1;
      const orderB = resolveOrderIndex ? resolveOrderIndex(b.label) : -1;
      const weightA = orderA !== -1 ? orderA : (a.sortHint != null ? a.sortHint : defaultWeight(a.label));
      const weightB = orderB !== -1 ? orderB : (b.sortHint != null ? b.sortHint : defaultWeight(b.label));
      if (weightA !== weightB) return weightA - weightB;
      return String(a.label).localeCompare(String(b.label));
    });

    const minColumnWidth = groupColumnMinWidth || 180;
    const isMobileViewport = viewportWidth && viewportWidth < 640;
    const viewportCap = viewportWidth
      ? Math.max(1, Math.floor((viewportWidth - 32) / minColumnWidth))
      : (groupMaxColumns || entries.length);
    const resolvedMax = groupMaxColumns || entries.length;
    const derivedColumns = Math.min(
      entries.length,
      Math.max(1, Math.min(resolvedMax, viewportCap))
    );
    const columns = isMobileViewport ? 1 : derivedColumns;
    const gridClass = columns === 1
      ? 'grid-cols-1'
      : columns === 2
      ? 'grid-cols-2'
      : columns === 3
      ? 'grid-cols-3'
      : 'grid-cols-4';

    const minWidth = Math.max(0, columns) * minColumnWidth;

    return {
      entries,
      gridClass,
      minWidth,
      headerFormatter: groupHeaderFormatter,
    };
  }, [filteredOptions, groupAccessor, groupFallbackLabel, groupColumnMinWidth, groupMaxColumns, groupHeaderFormatter, resolveOrderIndex, viewportWidth]);

  const computedMenuStyle = useMemo(() => {
    const viewportLimit = viewportWidth ? Math.max(240, viewportWidth - 24) : null;
    if (menuPosition === "fixed" && menuRect) {
      const base = {
        top: menuRect.top,
        left: menuRect.left,
      };
      let width = menuRect.width;
      if (groupLayout?.minWidth) {
        width = Math.max(width, groupLayout.minWidth);
      }
      if (viewportLimit) {
        width = Math.min(width, viewportLimit);
      }
      return {
        ...base,
        width,
      };
    }

    if (groupLayout?.minWidth) {
      return {
        minWidth: groupLayout.minWidth,
        maxWidth: viewportLimit || undefined,
      };
    }

    return viewportLimit ? { maxWidth: viewportLimit } : undefined;
  }, [menuPosition, menuRect, groupLayout, viewportWidth]);

  // Display string
  const getSelectedDisplay = () => {
    if (!normalizedValue || (Array.isArray(normalizedValue) && normalizedValue.length === 0)) {
      return placeholder;
    }
    if (multiple) {
      const selectedOptions = options?.filter(opt => normalizedValue?.includes(opt?.value));
      if (!selectedOptions?.length) return placeholder;
      if (selectedOptions.length <= 2) return selectedOptions.map(opt => opt.label).join(", ");
      return `${selectedOptions.length} ${selectedNoun} selected`;
    }
    const selectedOption = options?.find(opt => opt?.value === normalizedValue);
    return selectedOption ? selectedOption.label : placeholder;
  };

  // Toggle open/closed
  const handleToggle = () => {
    if (disabled) return;
    const next = !isOpen;
    setIsOpen(next);
    onOpenChange?.(next);
    if (!next) setSearchTerm("");
  };

  // Select option
  const handleOptionSelect = (option) => {
    if (multiple) {
      const arr = Array.isArray(normalizedValue) ? normalizedValue : [];
      const exists = arr.includes(option?.value);
      const updated = exists ? arr.filter(v => v !== option?.value) : [...arr, option?.value];
      onChange?.(updated);
    } else {
      onChange?.(option?.value);
      setIsOpen(false);
      onOpenChange?.(false);
    }
  };

  const handleClear = (e) => {
    e?.stopPropagation();
    onChange?.(multiple ? [] : "");
    setSearchTerm("");
  };

  const isSelected = (optionValue) => {
    return multiple ? (normalizedValue?.includes(optionValue) || false) : normalizedValue === optionValue;
  };

  const renderOption = (option, idx, { compact = false } = {}) => {
    const optionKey = option?.value ?? `option-${idx}`;
    const selected = isSelected(option?.value);

    return (
      <div
        key={optionKey}
        role="option"
        aria-selected={selected}
        tabIndex={0}
        onClick={() => !option?.disabled && handleOptionSelect(option)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!option?.disabled) handleOptionSelect(option);
          }
        }}
        className={cn(
          "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
          option?.disabled && "pointer-events-none opacity-50",
          !multiple && selected && "bg-primary text-primary-foreground",
          compact && "px-2 py-1.5"
        )}
      >
        {multiple ? (
          <div className="pointer-events-none">
            <Checkbox checked={selected} readOnly className="mr-0" />
          </div>
        ) : (
          <span
            className={cn(
              "mr-1 inline-block h-2 w-2 rounded-full border border-border",
              selected && "border-transparent bg-current"
            )}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate">{option?.label}</div>
          {option?.description && (
            <div className="truncate text-xs text-muted-foreground">{option?.description}</div>
          )}
        </div>

        {!multiple && selected && <Check className="h-4 w-4" />}
      </div>
    );
  };

  const hasValue = multiple
    ? (normalizedValue?.length > 0)
    : (normalizedValue !== undefined && normalizedValue !== null && normalizedValue !== "");

  const menuEl = (
    <div
      ref={menuRef}
      className={
        menuPosition === "fixed"
          ? "fixed z-[1200] rounded-md border border-border bg-white text-black shadow-md"
          : "absolute z-[1200] mt-1 rounded-md border border-border bg-white text-black shadow-md"
      }
      style={computedMenuStyle}
      role="listbox"
      aria-labelledby={selectId}
    >
      {searchable && (
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      )}

      <div className={cn("max-h-60 overflow-auto py-1 pb-2", groupLayout ? "px-1 pb-10" : undefined)}>
        {(filteredOptions?.length ?? 0) === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            {searchTerm ? "No options found" : "No options available"}
          </div>
        ) : groupLayout ? (
          <div className={cn("grid gap-3 pr-1", groupLayout.gridClass)}>
            {groupLayout.entries.map((entry) => (
              <div key={entry.label} className="min-w-0">
                <div className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                  {typeof groupLayout.headerFormatter === 'function'
                    ? groupLayout.headerFormatter(entry.label)
                    : entry.label}
                </div>
                <div className="space-y-1">
                  {entry.options.map((option, idx) => renderOption(option, idx, { compact: true }))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          filteredOptions.map((option, idx) => renderOption(option, idx))
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {label && (
        <label
          htmlFor={selectId}
          className={cn(
            "mb-2 block text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            error ? "text-destructive" : "text-foreground"
          )}
        >
          {label}{required && <span className="ml-1 text-destructive">*</span>}
        </label>
      )}

      <div className="relative">
        {/* NEW: merge forwarded ref + local buttonRef so we can measure the trigger */}
        <button
          ref={(el) => {
            buttonRef.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
          }}
          id={selectId}
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-gray-50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-destructive focus:ring-destructive",
            !hasValue && "text-muted-foreground"
          )}
          onClick={handleToggle}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          {...props}
        >
          <span className="truncate">{getSelectedDisplay()}</span>

          <div className="flex items-center gap-1">
            {loading && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {clearable && hasValue && !loading && (
              <Button variant="ghost" size="icon" className="h-4 w-4" onClick={handleClear}>
                <X className="h-3 w-3" />
              </Button>
            )}
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-180")} />
          </div>
        </button>

        {/* Hidden native select for forms */}
        <select
          name={name}
          value={normalizedValue}
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
          multiple={multiple}
          required={required}
        >
          <option value="">Select...</option>
          {options?.map((option) => (
            <option key={option?.value} value={option?.value}>
              {option?.label}
            </option>
          ))}
        </select>

        {/* NEW: render dropdown (portaled if requested) */}
        {isOpen && (
          menuPortalTarget && menuPosition === "fixed"
            ? ReactDOM.createPortal(menuEl, menuPortalTarget)
            : menuEl
        )}
      </div>

      {description && !error && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {error && (
        <p className="mt-1 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
});

Select.displayName = "Select";
export default Select;
