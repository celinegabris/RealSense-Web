import SensorOptionSlider from './SensorOptionSlider';

function SensorOptionsPanel({ options, deviceId, sensorId, resetSignal }) {
  if (!options || options.length === 0) {
    return <p>No options available</p>;
  }

  return (
    <div className="sensor-options-panel">
      {options.map((option) => (
        <SensorOptionSlider
          key={option.option_id}
          option={option}
          deviceId={deviceId}
          sensorId={sensorId}
          resetSignal={resetSignal}
        />
      ))}
    </div>
  );
}

export default SensorOptionsPanel;