'use client';

import React from 'react';

interface AutoSubmitSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: { value: string; label: string }[];
  children?: React.ReactNode;
}

export default function AutoSubmitSelect({
  options,
  children,
  onChange,
  className,
  ...props
}: AutoSubmitSelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onChange) {
      onChange(e);
    }
    const form = e.target.form;
    if (form) {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.submit();
      }
    }
  };

  return (
    <select onChange={handleChange} className={className} {...props}>
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  );
}
