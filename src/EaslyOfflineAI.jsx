import React, { useRef, useState, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";
import ProductImageTrainer from "./training/ImageTrainer";

// Enhanced Offline AI component for Easly AI: image classification with training
export default function EaslyOfflineAI() {
  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState("");
  const [loading, setLoading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [trainer, setTrainer] = useState(null);
  const imgRef = useRef();

  useEffect(() => {
    const initTrainer = async () => {
      const imageTrainer = new ProductImageTrainer();
      await imageTrainer.initialize();
      setTrainer(imageTrainer);
      
      // Check for existing trained model
      const status = imageTrainer.getTrainingStatus();
      setTrainingStatus(status);
    };
    
    initTrainer();
  }, []);

  // Load model (try custom first, fallback to MobileNet)
  const loadModel = async () => {
    setLoading(true);
    try {
      if (trainer) {
        // Try to load custom trained model
        const customModel = await trainer.loadModel();
        if (customModel) {
          setModel(customModel);
          console.log('✅ Loaded custom trained model');
          setLoading(false);
          return;
        }
      }
      
      // Fallback to MobileNet
      const loadedModel = await mobilenet.load();
      setModel(loadedModel);
      console.log('📱 Loaded MobileNet model');
    } catch (error) {
      console.error('Error loading model:', error);
    }
    setLoading(false);
  };

  // Train a new custom model
  const trainNewModel = async () => {
    if (!trainer) {
      alert('Training system not initialized');
      return;
    }

    setIsTraining(true);
    try {
      console.log('📚 Starting model training...');
      
      // Load training data
      const { images, labels } = await trainer.loadTrainingData();
      
      if (images.length === 0) {
        alert('No training data available. Add some product images first.');
        setIsTraining(false);
        return;
      }

      console.log(`🎯 Training with ${images.length} images`);
      
      // Train the model
      const results = await trainer.trainModel(images, labels, {
        epochs: 20, // Reduced for demo
        batchSize: 8,
        validationSplit: 0.2
      });

      setModel(results.model);
      
      // Update training status
      const status = trainer.getTrainingStatus();
      setTrainingStatus(status);
      
      alert(`Training completed! Final accuracy: ${(results.finalAccuracy * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error('Training failed:', error);
      alert('Training failed: ' + error.message);
    }
    
    setIsTraining(false);
  };

  // Handle image selection and run prediction
  const handleImageChange = async (e) => {
    if (!model) await loadModel();
    const file = e.target.files[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    imgRef.current.src = url;
    imgRef.current.onload = async () => {
      try {
        let results;
        
        if (trainer && model && trainingStatus?.hasTrainedModel) {
          // Use custom trained model
          results = await trainer.classifyImage(imgRef.current);
          const topResult = results[0];
          setPrediction(`${topResult.category} (${topResult.confidence})`);
        } else {
          // Use MobileNet
          results = await model.classify(imgRef.current);
          const topResult = results[0];
          setPrediction(`${topResult.className} (${(topResult.probability * 100).toFixed(1)}%)`);
        }
        
      } catch (error) {
        console.error('Prediction error:', error);
        setPrediction('Error during classification');
      }
      
      URL.revokeObjectURL(url);
    };
  };

  return (
    <div style={{ maxWidth: 600, margin: "2em auto", textAlign: "center" }}>
      <h2>🤖 Easly AI: Smart Product Classifier</h2>
      
      {/* Training Status */}
      {trainingStatus && (
        <div style={{ 
          background: trainingStatus.hasTrainedModel ? '#e8f5e8' : '#fff3cd', 
          padding: '10px', 
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '0.9em'
        }}>
          <strong>🧠 Training Status:</strong> {trainingStatus.hasTrainedModel ? 
            `Custom model trained (${trainingStatus.categories?.length || 10} categories)` : 
            'Using pre-trained MobileNet'
          }
          {trainingStatus.lastTrained && (
            <div>Last trained: {new Date(trainingStatus.lastTrained).toLocaleDateString()}</div>
          )}
        </div>
      )}
      
      {/* File Upload */}
      <div style={{ margin: "1em 0" }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleImageChange}
          style={{ marginRight: '10px' }}
        />
        <button 
          onClick={trainNewModel} 
          disabled={isTraining || !trainer}
          style={{ 
            marginLeft: '10px',
            padding: '8px 16px',
            backgroundColor: isTraining ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isTraining ? 'not-allowed' : 'pointer'
          }}
        >
          {isTraining ? '🏋️ Training...' : '📚 Train Custom Model'}
        </button>
      </div>
      
      {/* Image Display */}
      <div style={{ margin: "1em 0" }}>
        <img 
          ref={imgRef} 
          alt="" 
          style={{ 
            maxWidth: "100%", 
            maxHeight: 300, 
            display: prediction ? "block" : "none",
            border: "2px solid #ddd",
            borderRadius: "8px",
            margin: "0 auto"
          }} 
        />
      </div>
      
      {/* Status Messages */}
      {loading && <div style={{ color: '#007bff' }}>🔄 Loading model...</div>}
      {isTraining && (
        <div style={{ color: '#28a745', marginTop: '10px' }}>
          🏋️ Training in progress... This may take several minutes.
          <div style={{ fontSize: '0.8em', marginTop: '5px' }}>
            Building custom model for your product categories
          </div>
        </div>
      )}
      
      {/* Prediction Result */}
      {prediction && (
        <div style={{ 
          background: '#e8f5e8', 
          padding: '15px', 
          borderRadius: '8px',
          margin: '15px 0',
          border: '1px solid #d4edda'
        }}>
          <strong>🎯 Prediction:</strong> {prediction}
          {trainingStatus?.hasTrainedModel && (
            <div style={{ fontSize: '0.8em', color: '#666', marginTop: '5px' }}>
              Using your custom trained model
            </div>
          )}
        </div>
      )}
      
      {/* Info */}
      <div style={{ fontSize: "0.9em", color: "#666", marginTop: "1em" }}>
        📱 Model is cached for offline use • 📚 Train with your product images for better accuracy
        {trainingStatus?.categories && (
          <div style={{ marginTop: '5px' }}>
            🏷️ Categories: {trainingStatus.categories.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}
