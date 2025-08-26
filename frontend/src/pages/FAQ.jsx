import '../styles/FAQ.css';
import { Link } from 'react-router-dom';
import { useState } from 'react';

function FAQ() {
  const faqItems = [
    {
      question: "What is the RealSense Web Viewer?",
      answer: "The RealSense Web Viewer is a browser-based platform that allows users to view and interact with RealSense camera streams in real time. It provides visual access to RGB, Depth, Infrared, and IMU data using a user-friendly web interface."
    },
    {
      question: "Which RealSense streams are supported?",
      answer: "The application supports RGB, Infrared 1, Infrared 2, Depth, and IMU (accelerometer and gyroscope) streams. Users can enable one or more streams simultaneously and view live data directly in their browser."
    },
    {
      question: "Do I need to install any software or drivers?",
      answer: "You don’t need to install anything on the client side. However, the backend must run on a computer that has the RealSense SDK installed and a connected RealSense camera. The backend handles communication with the device and streams data to the frontend."
    },
    {
      question: "Can I adjust camera settings or sensor values?",
      answer: "Yes. The viewer includes a sensor control panel where you can view and adjust supported settings such as exposure, gain, resolution, and FPS for each active stream. You can also reset all settings to their default values."
    },
    {
      question: "Can I run multiple streams at the same time?",
      answer: "Yes. The system supports multi-streaming, including combinations of RGB, Infrared, Depth, and IMU."
    },
    {
      question: "Can I access this viewer remotely or over a network?",
      answer: "Yes. As long as the backend is running on a publicly accessible machine or LAN and ports are correctly configured, the frontend can connect remotely. Make sure to configure CORS and security settings appropriately for production."
    },
    {
      question: "Is there support for recording or exporting data?",
      answer: "Yes. The web supports both screenshots and video recording. Captured content is downloaded to your computer and can be saved or exported as needed."
    },
    {
      question: "How do I troubleshoot if a stream fails to start?",
      answer: "Check that the RealSense camera is properly connected, not in use by another application, and that the backend is running. Also ensure that all necessary streams (e.g., infrared or depth) are supported by your device model."
    },
    {
    question: "What is Focus Mode and how do I use it?",
    answer: "Focus Mode blurs everything in the live RGB stream except your dragged selection—just click Focus Mode, draw a box over the area to keep sharp, release to apply, and click again to turn it off."
  }

  ];

  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="page-container">
      <header className="navbar">
        <div className="logo">RealSense</div>
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/live-viewer">Live Viewer</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
          </ul>
        </nav>
      </header>

      <div className="faq-container">
        <h1 className="faq-title">Frequently Asked Questions</h1>
        {faqItems.map((item, index) => (
          <div key={index} className={`faq-item ${openIndex === index ? 'open' : ''}`}>
            <div className="faq-question" onClick={() => toggle(index)}>
              {item.question}
              <span className="arrow">{openIndex === index ? '−' : '+'}</span>
            </div>
            {openIndex === index && (
              <div className="faq-answer">{item.answer}</div>
            )}
          </div>
        ))}
      </div>
      
        <footer className="contact-footer">
        Contact: your.email@example.com
      </footer>
    </div>
  );
}

export default FAQ;
