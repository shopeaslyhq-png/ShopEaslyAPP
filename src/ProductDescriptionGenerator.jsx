import React, { useState } from "react";

/**
 * ProductDescriptionGenerator
 * A simple, production-ready product description generator for ShopEasly.
 * Accepts product name, features, and tone, and generates a description using a template or AI (if available).
 */
export default function ProductDescriptionGenerator() {
  const [productName, setProductName] = useState("");
  const [features, setFeatures] = useState("");
  const [tone, setTone] = useState("Friendly");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  function generateDescription() {
    setLoading(true);
    // Simple template-based generation; replace with AI API if desired
    const featureList = features
      .split(/[,\n]/)
      .map(f => f.trim())
      .filter(Boolean)
      .map(f => `• ${f}`)
      .join("\n");
    const desc = `Introducing ${productName}!\n\n${featureList}\n\nPerfect for anyone looking for quality and value.\n\nTone: ${tone}`;
    setTimeout(() => {
      setDescription(desc);
      setLoading(false);
    }, 500); // Simulate async
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 24, border: "1px solid #eee", borderRadius: 12, background: "#fafbfc" }}>
      <h3>Product Description Generator</h3>
      <label style={{ display: "block", marginBottom: 8 }}>
        Product Name:
        <input
          type="text"
          value={productName}
          onChange={e => setProductName(e.target.value)}
          style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Features (comma or newline separated):
        <textarea
          value={features}
          onChange={e => setFeatures(e.target.value)}
          rows={3}
          style={{ width: "100%", marginTop: 4, marginBottom: 12 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Tone:
        <select value={tone} onChange={e => setTone(e.target.value)} style={{ marginLeft: 8 }}>
          <option>Friendly</option>
          <option>Professional</option>
          <option>Playful</option>
          <option>Luxury</option>
        </select>
      </label>
      <button onClick={generateDescription} disabled={loading || !productName} style={{ marginTop: 8, width: "100%" }}>
        {loading ? "Generating..." : "Generate Description"}
      </button>
      {description && (
        <div style={{ marginTop: 24, background: "#fff", padding: 16, borderRadius: 8, border: "1px solid #eee" }}>
          <strong>Generated Description:</strong>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{description}</pre>
        </div>
      )}
    </div>
  );
}
