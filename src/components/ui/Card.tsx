import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'light' | 'dark';
  padding?: 'sm' | 'md' | 'lg';
}

const PADDING_CLASS: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-7 md:p-9',
};

export const Card: React.FC<CardProps> = ({ tone = 'light', padding = 'md', className, children, ...rest }) => {
  const toneClass =
    tone === 'dark'
      ? 'bg-obsidian text-white border border-obsidian-border shadow-obsidian'
      : 'bg-white text-gray-900 border border-gray-100 shadow-sm';

  return (
    <div className={twMerge('rounded-3xl', toneClass, PADDING_CLASS[padding], className)} {...rest}>
      {children}
    </div>
  );
};
