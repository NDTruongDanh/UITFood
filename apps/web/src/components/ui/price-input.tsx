import * as React from 'react';
import { Input } from './input';

export interface PriceInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value?: number;
  onChange?: (value: number | undefined) => void;
}

export function PriceInput({ value, onChange, className, ...props }: PriceInputProps) {
  const [textValue, setTextValue] = React.useState<string>(
    value !== undefined && value !== null ? value.toLocaleString('en-US') : ''
  );

  // Sync the formatted text when the external `value` prop changes. Done during
  // render (not in an effect) per React's "adjusting state on prop change"
  // guidance: https://react.dev/learn/you-might-not-need-an-effect
  const [prevValue, setPrevValue] = React.useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value === undefined || value === null) {
      setTextValue('');
    } else if (parseFloat(textValue.replace(/,/g, '')) !== value) {
      setTextValue(value.toLocaleString('en-US'));
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Remove all non-digits
    inputValue = inputValue.replace(/\D/g, '');
    
    const numericValue = parseInt(inputValue, 10);
    
    if (isNaN(numericValue)) {
      setTextValue('');
      onChange?.(undefined);
    } else {
      setTextValue(numericValue.toLocaleString('en-US'));
      onChange?.(numericValue);
    }
  };

  return (
    <Input
      type="text"
      value={textValue}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
}
