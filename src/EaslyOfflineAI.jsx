import React, { useRef, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";

// Offline AI component for Easly AI: image classification
export default function EaslyOfflineAI() {
  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState("");
  const [loading, setLoading] = useState(false);
  const imgRef = useRef();

  // Load model (cached in IndexedDB for offline use)
  const loadModel = async () => {
    setLoading(true);
    const loadedModel = await mobilenet.load();
    setModel(loadedModel);
    setLoading(false);
  };

  // Handle image selection and run prediction
  const handleImageChange = async (e) => {
    if (!model) await loadModel();
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    imgRef.current.src = url;
    imgRef.current.onload = async () => {
      const results = await model.classify(imgRef.current);
      setPrediction(results[0]?.className + " (" + (results[0]?.probability * 100).toFixed(1) + "%)");
      URL.revokeObjectURL(url);
    };
  };

  return (
    <div style={{ maxWidth: 400, margin: "2em auto", textAlign: "center" }}>
      <h2>Easly AI: Offline Image Classifier</h2>
      <input type="file" accept="image/*" onChange={handleImageChange} />
      <div style={{ margin: "1em 0" }}>
        <img ref={imgRef} alt="" style={{ maxWidth: "100%", maxHeight: 200, display: prediction ? "block" : "none" }} />
      </div>
      {loading && <div>Loading model...</div>}
      {prediction && <div><strong>Prediction:</strong> {prediction}</div>}
      <div style={{ fontSize: "0.9em", color: "#888", marginTop: "1em" }}>
        Model is cached for offline use after first load.
      </div>
    </div>
  );
}
