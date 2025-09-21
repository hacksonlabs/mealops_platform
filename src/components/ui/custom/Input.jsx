import React, { useState, forwardRef } from "react";
import { cn } from "../../../utils/cn";

const Input = forwardRef(({
  className,
  type = "text",
  label,
  description,
  error,
  required = false,
  id,
  hideNativeSearchClear = true, // <— NEW (defaults to hiding)
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random()?.toString(36)?.substr(2, 9)}`;
  const [showPassword, setShowPassword] = useState(false);
  const currentType = type === "password" && showPassword ? "text" : type;

  const baseInputClasses =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background " +
    "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
    "disabled:cursor-not-allowed disabled:opacity-50";

  // Checkbox
  if (type === "checkbox") {
    return (
      <input
        type="checkbox"
        className={cn(
          "h-4 w-4 rounded border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        id={inputId}
        {...props}
      />
    );
  }

  // Radio
  if (type === "radio") {
    return (
      <input
        type="radio"
        className={cn(
          "h-4 w-4 rounded-full border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        id={inputId}
        {...props}
      />
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            error ? "text-destructive" : "text-foreground"
          )}
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          type={currentType}
          id={inputId}
          ref={ref}
          className={cn(
            baseInputClasses,
            error && "border-destructive focus-visible:ring-destructive",
            // Give room for a trailing icon/button (password toggle or custom clear button)
            (type === "password" || type === "search") && "pr-10",
                // Hide native clear for search inputs (Chrome/Safari/Edge)
                type === "search" &&
                "appearance-none " +
                "[&::-webkit-search-cancel-button]:hidden " +
                "[&::-webkit-search-decoration]:hidden " +
                "[&::-webkit-search-results-button]:hidden " +
                "[&::-webkit-search-results-decoration]:hidden " +
                "[&::-ms-clear]:hidden",
                className
            )}
            {...props}
        />

        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(prev => !prev)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.54 18.54 0 0 1 2.56-3.88m2.28-2.28A10 10 0 0 1 12 4c7 0 11 8 11 8a18.54 18.54 0 0 1-2.56 3.88m-2.28 2.28L2 2"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        )}
      </div>

      {description && !error && <p className="text-sm text-muted-foreground">{description}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
});

Input.displayName = "Input";
export default Input;
