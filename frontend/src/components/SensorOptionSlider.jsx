import React, { useState, useMemo, useEffect } from 'react';
import { debounce } from '../utils/debounce.js';
import '../styles/sensorOptionSlider.css';
import { FaEdit, FaQuestionCircle } from 'react-icons/fa';

function formatValue(value) {
  if (value == null) return "-";
  const abs = Math.abs(value);

  if (abs === 0) return "0";
  if (abs >= 1) return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);
  if (abs >= 0.01) return (value * 100).toFixed(0) + '%';
  if (abs >= 0.001) return (value * 1000).toFixed(0) + ' mm';
  if (abs >= 0.000001) return (value * 1_000_000).toFixed(0) + ' µm';
  return value.toFixed(5);
}

function SensorOptionSlider({ option, deviceId, sensorId, resetSignal }) {
  const [value, setValue] = useState(option.default_value ?? 1);
  const [inputVisible, setInputVisible] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const isReadOnly = option.read_only === true;


  useEffect(() => {
    const defaultVal = option.default_value ?? 1;
    setValue(defaultVal);
    sendUpdate(defaultVal);
  }, [resetSignal]);

  const sendUpdate = (newValue) => {
    fetch(`http://localhost:8000/api/devices/${deviceId}/sensors/${sensorId}/options/${option.option_id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: newValue }),
    }).catch((err) => {
      console.error(`Failed to update ${option.name}:`, err);
    });
  };

  const debouncedUpdate = useMemo(() => debounce(sendUpdate, 300), []);

  const handleChange = (e) => {
    const newValue = Number(e.target.value);
    setValue(newValue);
    debouncedUpdate(newValue);
  };

  const handleCheckboxChange = (e) => {
    const newValue = e.target.checked ? 1 : 0;
    setValue(newValue);
    debouncedUpdate(newValue);
  };

  const handleReset = () => {
    const defaultVal = option.default_value ?? 1;
    setValue(defaultVal);
    sendUpdate(defaultVal);
  };

  const handleManualSubmit = () => {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val < option.min_value || val > option.max_value) {
      alert(`${val} is out of bounds [${option.min_value}, ${option.max_value}]`);
      return;
    }
    setValue(val);
    sendUpdate(val);
    setInputVisible(false);
  };

  if (option.min_value === option.max_value) return null;

  const checkboxOptions = [
    "Enable Motion Correction",
    "Global Time Enabled",
    "Enable Auto Exposure",
    "Enable Auto White Balance",
    "Auto Exposure Priority",
    "Backlight Compensation",
    "Emitter On Off",
    "Emitter Always On",
    "Hdr Enabled",
    "Auto Exposure Limit Toggle",
    "Auto Gain Limit Toggle"
  ];

  const isCheckbox = checkboxOptions.includes(option.name);

  return (
    <div className="sensor-option">
      <div className="sensor-label-row">
        <div className="sensor-label-with-icon">
          <span className="sensor-label">
            {option.name}
            {!isCheckbox && (
              <span className="sensor-value">: {formatValue(value)}</span>
            )}
          </span>
          {!isCheckbox && !isReadOnly && (
            <div className="icon-group">
<div className="tooltip-wrapper">
<FaQuestionCircle className="tooltip-icon" aria-hidden="true" focusable="false" />
  <span className="tooltip-text">
    {option.description || "No description available"}
  </span>
</div>

              <button className="edit-icon-button no-outline" onClick={() => setInputVisible(!inputVisible)}>
                <FaEdit />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sensor-control-row">
        {isCheckbox ? (
          <div className="checkbox-wrapper">
            <input
              type="checkbox"
              checked={value === 1}
              onChange={handleCheckboxChange}
            />
            <span className="checkbox-label">Enable</span>
          </div>
        ) : (
          <>
            <input
              type="range"
              min={option.min_value}
              max={option.max_value}
              step={1}
              value={value}
              onChange={handleChange}
              disabled={isReadOnly}
            />
            <button onClick={handleReset} className="reset-button-small no-outline">
              Reset
            </button>
          </>
        )}
      </div>

      {inputVisible && !isCheckbox && (
        <div className="sensor-control-row">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            min={option.min_value}
            max={option.max_value}
            step={1}
            className="manual-input"
          />
          <button onClick={handleManualSubmit} className="submit-button-small no-outline">Set</button>
        </div>
      )}

      {!isCheckbox && (
        <div className="sensor-meta">
          Range: {option.min_value}–{option.max_value} | Default: {option.default_value ?? 1}
        </div>
      )}
    </div>
  );
}

export default SensorOptionSlider;
