import React, { useRef, useEffect, useCallback } from 'react';
import './Options.css';

export interface OptionInfo {
    option_id: string;
    name: string;
    description?: string;
    current_value: number;
    default_value: number;
    min_value?: number;
    max_value?: number;
    step?: number;
    units?: string;
    read_only?: boolean;
}

const isReadOnly = (option: OptionInfo): boolean => {
    return option.read_only ?? false;
};

interface OptionControlProps {
  option: OptionInfo;
  onChange: (optionId: string, value: number) => void;
}

// Component to render the appropriate control based on option properties
const OptionControl: React.FC<OptionControlProps> = ({ option, onChange }) => {
  const timeoutRef = useRef<number | null>(null);

  const handleDebouncedChange = useCallback((value: number) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      onChange(option.option_id, value);
    }, 300); // Adjust delay as needed
  }, [onChange, option.option_id]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleChange = (value: number) => {
    onChange(option.option_id, value);
  };

  // Helper function to create a label with tooltip
  const LabelWithTooltip = (labelId: string, text: string) => (
    <label
      htmlFor={labelId}
      className="mr-2 cursor-help"
      title={option.description || ''}
    >
      {text}
    </label>
  );

  // Read-only display
  if (isReadOnly(option)) {
    return (
      <div className="flex items-center mb-2">
        <span className="font-medium mr-2 cursor-help" title={option.description || ''}>
          {option.name}:
        </span>
        <span>{option.current_value}{option.units && ` ${option.units}`}</span>
      </div>
    );
  }

  // Boolean value (0/1)
  if (option.min_value === 0 && option.max_value === 1 && (!option.step || option.step === 1)) {
    return (
      <div className="flex items-center mb-2">
        <input
          type="checkbox"
          id={option.option_id}
          checked={option.current_value === 1}
          onChange={(e) => handleChange(e.target.checked ? 1 : 0)}
          disabled={isReadOnly(option)}
          className="mr-2"
        />
        {LabelWithTooltip(option.option_id, option.name)}
      </div>
    );
  }

  // Dropdown for options with few discrete values (less than 10 options)
  if (option.min_value !== undefined &&
      option.max_value !== undefined &&
      option.step &&
      (option.max_value - option.min_value) / option.step < 10) {

    const options = [];
    for (let value = option.min_value; value <= option.max_value; value += option.step) {
      options.push(value);
    }

    return (
      <div className="mb-2">
        {LabelWithTooltip(option.option_id, option.name)}
        <select
          id={option.option_id}
          value={option.current_value}
          onChange={(e) => handleChange(Number(e.target.value))}
          disabled={isReadOnly(option)}
          className="p-1 border rounded"
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {value}{option.units && ` ${option.units}`}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // Slider for continuous range
  if (option.min_value !== undefined && option.max_value !== undefined) {
    return (
      <div className="mb-3">
        <div className="block mb-1 cursor-help" title={option.description || ''}>
          {option.name}: {option.current_value}{option.units && ` ${option.units}`}
        </div>
        <div className="flex items-center">
          <span className="text-sm mr-2">{option.min_value}</span>
          <input
            type="range"
            id={option.option_id}
            min={option.min_value}
            max={option.max_value}
            step={option.step || 1}
            value={option.current_value}
            onChange={(e) => handleDebouncedChange(Number(e.target.value))}
            disabled={isReadOnly(option)}
            className="flex-1"
          />
          <span className="text-sm ml-2">{option.max_value}</span>
        </div>
      </div>
    );
  }

  // Default: numeric input
  return (
    <div className="mb-2">
      {LabelWithTooltip(option.option_id, option.name)}
      <div className="flex items-center">
        <input
          type="number"
          id={option.option_id}
          value={option.current_value}
          onChange={(e) => handleDebouncedChange(Number(e.target.value))}
          min={option.min_value}
          max={option.max_value}
          step={option.step || 1}
          disabled={isReadOnly(option)}
          className="p-1 border rounded"
        />
        {option.units && <span className="ml-1">{option.units}</span>}
      </div>
    </div>
  );
};

// Component to handle all options for a sensor
interface SensorOptionsProps {
  options: OptionInfo[];
  onOptionChange: (optionId: string, value: number) => void;
}

const SensorOptions: React.FC<SensorOptionsProps> = ({ options, onOptionChange }) => {
  return (
    <div className="p-4 border rounded">
      <h3 className="font-bold mb-3">Sensor Options</h3>
      {options.length === 0 ? (
        <p>No options available for this sensor</p>
      ) : (
        options.map((option) => (
          <OptionControl
            key={option.option_id}
            option={option}
            onChange={onOptionChange}
          />
        ))
      )}
    </div>
  );
};

export default SensorOptions;